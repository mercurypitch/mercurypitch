// ============================================================
// useIdentificationController — the shared engine under every
// Ruler-B button drill (Leap, Stack, Contour; Home stays bespoke
// for its cadence and mic mode).
//
// A drill supplies its bank and a makeTrial() that turns the
// picked item into sound plus the expected answer id. Everything
// else — Elo-targeted picking without repeats, rating and item
// updates, confusion bookkeeping, reveal pacing, the end card
// numbers — is identical across drills and lives here once.
//
// A rated run writes each answer as it lands (the Elo moves round by
// round), so leaving one part-way keeps those answers. The native room
// promises the opposite on its way out ("Nothing from it is kept"), and
// abandon() makes it true: it puts back what the run wrote.
//
// Sound taken away before a prompt is answered (a call, headphones out,
// the app put away) voids it, and its answer is shut while it is held.
// Once the sound is back the same prompt plays again from its start
// (a take, Pulse's or the Chart's, from its count-in). One heard through
// and waiting on its answer is heard again too, since the ear no longer
// holds it (owner, 29 Oct): a rated question is otherwise heard once
// before its answer, so that hearing counts as a replay, and the plate
// shows it.
//
// Hear it again after the answer sounds the prompt to listen to: the
// verdict and what the answer left on the stage stay. A drill whose
// play() also opens its answer (Pulse's and the Chart's takes) gives
// the trial a replay() that only sounds. The next question, Stop and
// the sound taken away each silence a replay still sounding.
//
// Compare, after a miss, sounds the answer and then the pick, from the
// question's own root, key or register. It is a replay in every other
// way: listen-only, as often as wanted, never over a sound, and
// silenced by the same things. Only a drill whose pick is a sound of
// its own gives the trial a compare(); a take (Pulse, the Chart) is not.
//
// A slip on the native room's rated plate can start a pair practice
// (pair-practice.ts): a short run over just the two items it mixed up,
// which rates nothing and books nothing for Today.
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { EarBankItem } from '@/lib/ear/banks'
import { bankItemState, pickBankItem } from '@/lib/ear/banks'
import type { IdentificationDrill } from '@/lib/ear/drills'
import { guessRate } from '@/lib/ear/drills'
import type { Rating } from '@/lib/ear/elo'
import { trackFirstValue } from '@/lib/first-value'
import type { RatedRunMark } from '@/stores/ear-lab-store'
import { creditEarSession, earItemStates, earPlayerRating, markRatedRun, markSprintSegmentDone, recordIdentificationAnswer, rollBackRatedRun, takeSprintRunLength, } from '@/stores/ear-lab-store'
import { PAIR_PRACTICE_ROUNDS, pairOrder } from './pair-practice'
import { createRevealPacer } from './reveal-pacing'

export type IdentificationPhase =
  | 'idle'
  | 'playing'
  | 'answer'
  | 'reveal'
  | 'done'

export interface IdentificationTrial {
  /** The choice id that counts as correct this round. */
  expectedId: string
  /** Sound the prompt. */
  play: () => Promise<void>
  /** Optional slower replay after a wrong answer. */
  replayOnWrong?: () => Promise<void>
  /** Sound the prompt again after the answer, to listen to only: no
   *  answer opens and the verdict's stage stays. Resolves when the
   *  sound has ended. Without one, Hear it again calls play(). */
  replay?: () => Promise<void>
  /** After a miss: the answer, then the pick, side by side, from the
   *  reference the question was asked from (its root, key or register).
   *  Listen-only, like replay(); resolves when the sound has ended.
   *  Without one, a miss offers no Compare. */
  compare?: (pickedId: string) => Promise<void>
}

export interface IdentificationOutcome {
  expectedId: string
  answeredId: string
  correct: boolean
}

export interface IdentificationResult {
  correct: number
  total: number
  rating: Rating
  ratingDelta: number
  outcomes: IdentificationOutcome[]
}

export const IDENTIFICATION_ROUNDS = 12

/** Where a run's answers are rated when not under the drill's own
 *  id — Echo's sung answers go to 'echo-sing' with no guess floor
 *  and leave the items' difficulties untouched. */
export interface RunTrack {
  drillId: string
  guessRate: number
  updateItem: boolean
}

export interface IdentificationOptions {
  /** Silence anything already sounding. Called on stop and unmount,
   *  before the phase flips — a prompt committed to the audio clock
   *  outlives its setTimeout. */
  cancelAudio?: () => void
  /** Silence a replay at the reveal and nothing else, leaving what the
   *  answer put on the stage. Without one, cancelAudio does it. */
  silenceReplay?: () => void
  /** Read at start(): the track this run rates under, or null for
   *  the drill's own. */
  track?: () => RunTrack | null
}

export function useIdentificationController(
  drill: IdentificationDrill,
  bank: readonly EarBankItem[],
  makeTrial: (item: EarBankItem) => IdentificationTrial,
  options?: IdentificationOptions,
) {
  const [phase, setPhase] = createSignal<IdentificationPhase>('idle')
  const [round, setRound] = createSignal(0)
  const [expectedId, setExpectedId] = createSignal<string | null>(null)
  const [answeredId, setAnsweredId] = createSignal<string | null>(null)
  const [rating, setRating] = createSignal<Rating>(earPlayerRating(drill.id))
  let runTrack: RunTrack | null = null
  const trackId = () => runTrack?.drillId ?? drill.id
  const [result, setResult] = createSignal<IdentificationResult | null>(null)
  /** True while a miss's slow replay is sounding. */
  const [replaying, setReplaying] = createSignal(false)
  /** The question in flight was voided; it waits for resumeQuestion(). */
  const [held, setHeld] = createSignal(false)
  /** The held prompt had been heard through: heard again, it is a
   *  replay. */
  let heardThrough = false
  /** Prompts heard again before their answer this run: those resumed
   *  after being heard through. */
  const [replays, setReplays] = createSignal(0)
  /** A pair practice's two item ids, while it runs and on its plate;
   *  null for a rated run. */
  const [practice, setPractice] = createSignal<
    readonly [string, string] | null
  >(null)
  /** A pair practice's questions, in order. */
  let practiceOrder: EarBankItem[] = []

  let currentItem: EarBankItem | null = null
  let trial: IdentificationTrial | null = null
  let lastItemId: string | undefined
  let outcomes: IdentificationOutcome[] = []
  let ratingAtStart = 0
  let startedAt = 0
  let cancelled = false
  /** The ledger as this run found it, for abandon(). */
  let mark: RatedRunMark | null = null
  /** Bumped when a prompt is sounded again from its start: the sound it
   *  replaces must not arm the answer when it resolves. */
  let question = 0
  /** Bumped by every start(): a round still awaiting its prompt when the
   *  run was stopped and started again must not arm the new run's
   *  answer when that prompt resolves. */
  let run = 0
  /** Bumped by every replay and by the next round, which silences one
   *  still sounding: only the latest replay's end clears the flag. */
  let replayToken = 0
  const pacer = createRevealPacer(
    () => {
      setRound((r) => r + 1)
      void playRound()
    },
    () => cancelled,
  )

  /** Rounds in this run: the catalogue's dozen, or the fewer a
   *  sprint segment promised on its card. */
  const [totalRounds, setTotalRounds] = createSignal(IDENTIFICATION_ROUNDS)
  /** The run took the shorter length a Today's segment armed. */
  const [short, setShort] = createSignal(false)

  function start(): void {
    begin(null)
  }

  /** The two items a slip names, as a pair practice takes them: null
   *  unless both are items of this bank. A tapped-back line, a direction
   *  or "the first" is an answer, not an item, and has no practice. */
  function practicePair(
    expectedId: string,
    answeredId: string,
  ): readonly [string, string] | null {
    const has = (id: string): boolean => bank.some((item) => item.itemId === id)
    return expectedId !== answeredId && has(expectedId) && has(answeredId)
      ? [expectedId, answeredId]
      : null
  }

  /** A short practice run over two items of the bank, asked in a
   *  balanced, shuffled order. It rates nothing (pair-practice.ts). */
  function practise(pair: readonly [string, string]): void {
    if (practicePair(pair[0], pair[1]) === null) return
    begin(pair)
  }

  function begin(pair: readonly [string, string] | null): void {
    cancelled = false
    run += 1
    startedAt = performance.now()
    outcomes = []
    runTrack = options?.track?.() ?? null
    ratingAtStart = earPlayerRating(trackId()).rating
    // A practice writes nothing to put back, and leaves a length Today
    // armed to the run it was armed for.
    mark = pair === null ? markRatedRun(trackId()) : null
    const armed = pair === null ? takeSprintRunLength(drill.id) : null
    practiceOrder =
      pair === null
        ? []
        : pairOrder([itemOf(pair[0]), itemOf(pair[1])], PAIR_PRACTICE_ROUNDS)
    batch(() => {
      setPractice(pair)
      setShort(armed?.rounds !== undefined)
      setTotalRounds(
        pair === null
          ? (armed?.rounds ?? IDENTIFICATION_ROUNDS)
          : PAIR_PRACTICE_ROUNDS,
      )
      setRound(0)
      setResult(null)
      setReplaying(false)
      setHeld(false)
      setReplays(0)
      setRating(earPlayerRating(trackId()))
    })
    heardThrough = false
    void playRound()
  }

  /** An item of the bank, by id; practicePair() has vouched for it. */
  function itemOf(id: string): EarBankItem {
    const found = bank.find((item) => item.itemId === id)
    if (found === undefined) throw new Error(`${id} is not in the bank`)
    return found
  }

  async function playRound(): Promise<void> {
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    if (stale()) return
    // A replay of the last verdict still sounding stops: the next
    // question is not asked over it.
    if (replaying()) {
      options?.cancelAudio?.()
      endReplay()
    }
    if (round() >= totalRounds()) {
      finish(true)
      return
    }

    currentItem =
      practiceOrder[round()] ??
      pickBankItem(bank, earItemStates(), rating().rating, {
        avoidItemId: lastItemId,
        guessRate: guessRate(drill),
      })
    lastItemId = currentItem.itemId
    trial = makeTrial(currentItem)

    batch(() => {
      setExpectedId(trial?.expectedId ?? null)
      setAnsweredId(null)
      setPhase('playing')
    })

    await trial.play()
    // Stop may have landed while the prompt was sounding, or the run may
    // have been started again; arming the answer here would resurrect a
    // finished run.
    if (stale()) return
    setPhase('answer')
  }

  function answer(choiceId: string): void {
    if (phase() !== 'answer' || cancelled) return
    const mine = run
    const item = currentItem
    const expected = trial?.expectedId
    if (!item || expected === undefined) return

    const correct = choiceId === expected
    // A pair practice rates nothing: the rating stays where it was.
    const nextRating =
      practice() !== null
        ? rating()
        : recordIdentificationAnswer({
            drillId: trackId(),
            itemId: item.itemId,
            itemDifficulty: bankItemState(earItemStates(), item),
            correct,
            guessRate: runTrack?.guessRate ?? guessRate(drill),
            expected,
            answered: choiceId,
            ...(runTrack ? { updateItem: runTrack.updateItem } : {}),
          })
    outcomes.push({ expectedId: expected, answeredId: choiceId, correct })

    playTierSfx(
      correct
        ? { label: 'Perfect', className: 'perfect' }
        : { label: 'Missed', className: 'missed' },
    )

    batch(() => {
      setRating(nextRating)
      setAnsweredId(choiceId)
      setPhase('reveal')
    })

    // A miss replays the item slowly; the hold — and the next round —
    // count from the end of the replay, or the two would sound over
    // each other. Stop still cuts it: cancelled is checked after the
    // replay, and the pacer checks it again when the hold ends.
    const replay =
      !correct && trial?.replayOnWrong
        ? trial.replayOnWrong()
        : Promise.resolve()
    replayToken += 1
    const token = replayToken
    setReplaying(!correct && trial?.replayOnWrong !== undefined)
    void replay
      .catch(() => undefined)
      .then(() => {
        // A stale run's replay resolving must not flick the new run's flag.
        if (mine === run && token === replayToken) setReplaying(false)
        if (cancelled || mine !== run) return
        pacer.hold(correct)
      })
  }

  /** Hear the answered question again, as often as wanted. A hold
   *  counting down stops and waits for Next. Never before the answer:
   *  a rated question is heard once. */
  function replayAllowed(): boolean {
    return phase() === 'reveal' && !replaying() && trial !== null
  }

  async function replay(): Promise<void> {
    if (!replayAllowed() || trial === null) return
    await listenAgain(trial.replay ?? trial.play)
  }

  /** The verdict on the stage is a miss whose pick can be sounded. */
  function comparable(): boolean {
    const picked = answeredId()
    return (
      phase() === 'reveal' &&
      trial?.compare !== undefined &&
      picked !== null &&
      picked !== expectedId()
    )
  }

  /** Compare, as often as wanted after a miss, never over a sound. */
  function compareAllowed(): boolean {
    return comparable() && !replaying()
  }

  /** The answer, then the pick, side by side. */
  async function compare(): Promise<void> {
    const picked = answeredId()
    const sound = trial?.compare
    if (!compareAllowed() || sound === undefined || picked === null) return
    await listenAgain(() => sound(picked))
  }

  /** A sound after the answer, to listen to only (Hear it again,
   *  Compare): a hold counting down waits for Next, and the flag goes
   *  when it ends, unless something newer silenced it first. */
  async function listenAgain(sound: () => Promise<void>): Promise<void> {
    const mine = run
    replayToken += 1
    const token = replayToken
    pacer.pause()
    setReplaying(true)
    try {
      await sound()
    } catch {
      // A prompt that failed to sound is no reason to strand the verdict.
    } finally {
      if (mine === run && token === replayToken) setReplaying(false)
    }
  }

  function finish(complete: boolean): void {
    const current = rating()
    setResult({
      correct: outcomes.filter((o) => o.correct).length,
      total: outcomes.length,
      rating: current,
      ratingDelta: Math.round(current.rating - ratingAtStart),
      outcomes: [...outcomes],
    })
    creditEarSession(performance.now() - startedAt)
    // A segment counts when the run reached its end, not when it was
    // abandoned part-way, and never for a pair practice: Today asked for
    // the drill, not for two of its items.
    if (complete && practice() === null) {
      markSprintSegmentDone(drill.id)
      trackFirstValue('ear')
    }
    setPhase('done')
  }

  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    // Cancel FIRST — see playRound()'s post-await guard.
    cancelled = true
    pacer.cancel()
    options?.cancelAudio?.()
    endReplay()
    if (outcomes.length === 0) {
      // Nothing answered: the end card reports an empty run, and no sprint
      // segment, session or streak is booked for it.
      setResult({
        correct: 0,
        total: 0,
        rating: rating(),
        ratingDelta: 0,
        outcomes: [],
      })
      setPhase('done')
      return
    }
    finish(false)
  }

  function dispose(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelAudio?.()
    endReplay()
  }

  /** A replay silenced from outside never ends on its own: its flag
   *  goes now, and its end, if it comes, finds a newer token. */
  function endReplay(): void {
    replayToken += 1
    setReplaying(false)
  }

  /** The sound was taken away. A prompt still sounding, or waiting on
   *  its answer, is void, and back to playing, so no answer (a pad, a
   *  key, a sung window, a take) lands while it is held; one already
   *  held stays as it is. A verdict counting down waits for Next, and a
   *  replay of it stops, to be heard whole once the sound is back. */
  function holdQuestion(): void {
    if (phase() === 'reveal') {
      const silence = options?.silenceReplay ?? options?.cancelAudio
      if (replaying() && silence) {
        silence()
        endReplay()
      }
      pacer.pause()
      return
    }
    const sounding = phase() === 'playing'
    if ((!sounding && phase() !== 'answer') || held() || cancelled) return
    question += 1
    options?.cancelAudio?.()
    heardThrough = !sounding
    batch(() => {
      setPhase('playing')
      setHeld(true)
    })
  }

  /** The voided prompt, from its start; one heard through counts a
   *  replay. */
  async function resumeQuestion(): Promise<void> {
    if (!held() || cancelled || trial === null) return
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    batch(() => {
      if (heardThrough) setReplays((n) => n + 1)
      setHeld(false)
      setPhase('playing')
    })
    heardThrough = false
    await trial.play()
    if (stale()) return
    setPhase('answer')
  }

  /** Leave mid-run keeping nothing: the answers this run wrote are put
   *  back, and nothing is credited or booked. */
  function abandon(): void {
    const running = phase() !== 'idle' && phase() !== 'done'
    dispose()
    if (running && mark !== null && outcomes.length > 0) {
      rollBackRatedRun(mark)
    }
    mark = null
  }

  onCleanup(dispose)

  return {
    phase,
    round,
    get totalRounds() {
      return totalRounds()
    },
    expectedId,
    answeredId,
    rating,
    result,
    replaying,
    /** Prompts heard again before their answer this run. */
    replays,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    /** A hold counting down waits for Next instead. */
    pause: pacer.pause,
    replayAllowed,
    replay,
    /** A miss on the stage that Compare can sound. */
    comparable,
    compareAllowed,
    compare,
    /** A Today's short run. */
    short,
    held,
    holdQuestion,
    resumeQuestion,
    track: () => runTrack,
    /** The pair a practice runs over, or null for a rated run. */
    practice,
    practicePair,
    practise,
    start,
    answer,
    stop,
    dispose,
    abandon,
  }
}
