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
// Sound taken away mid-question (a call, headphones out) voids the
// question in flight: holdQuestion() silences it and resumeQuestion()
// plays the same prompt again from its start. A drill whose answer is
// itself timed (Pulse's take) counts the answer as in flight too.
//
// Hear it again after the answer sounds the prompt to listen to: the
// verdict and what the answer left on the stage stay. A drill whose
// play() also opens its answer (Pulse's and the Chart's takes) gives
// the trial a replay() that only sounds; the next question silences a
// replay still sounding.
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
  /** Read at start(): the track this run rates under, or null for
   *  the drill's own. */
  track?: () => RunTrack | null
  /** The answer is a timed take on the prompt's clock (Pulse, The
   *  Chart): sound taken away during it voids the round as well. */
  timedAnswer?: boolean
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
    cancelled = false
    run += 1
    startedAt = performance.now()
    outcomes = []
    runTrack = options?.track?.() ?? null
    ratingAtStart = earPlayerRating(trackId()).rating
    mark = markRatedRun(trackId())
    const armed = takeSprintRunLength(drill.id)
    batch(() => {
      setShort(armed?.rounds !== undefined)
      setTotalRounds(armed?.rounds ?? IDENTIFICATION_ROUNDS)
      setRound(0)
      setResult(null)
      setReplaying(false)
      setHeld(false)
      setRating(earPlayerRating(trackId()))
    })
    void playRound()
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
      replayToken += 1
      options?.cancelAudio?.()
      setReplaying(false)
    }
    if (round() >= totalRounds()) {
      finish(true)
      return
    }

    currentItem = pickBankItem(bank, earItemStates(), rating().rating, {
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
    const nextRating = recordIdentificationAnswer({
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
    const mine = run
    replayToken += 1
    const token = replayToken
    const sound = trial.replay ?? trial.play
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
    // abandoned part-way.
    if (complete) {
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
  }

  /** The sound was taken away. A prompt still sounding (or a timed
   *  take on it) is void; a verdict counting down waits for Next. */
  function holdQuestion(): void {
    if (phase() === 'reveal') {
      pacer.pause()
      return
    }
    const inFlight =
      phase() === 'playing' ||
      (phase() === 'answer' && options?.timedAnswer === true)
    if (!inFlight || cancelled) return
    question += 1
    options?.cancelAudio?.()
    setHeld(true)
  }

  /** The voided prompt, from its start. */
  async function resumeQuestion(): Promise<void> {
    if (!held() || cancelled || trial === null) return
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    batch(() => {
      setHeld(false)
      setPhase('playing')
    })
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
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    /** A hold counting down waits for Next instead. */
    pause: pacer.pause,
    replayAllowed,
    replay,
    /** A Today's short run. */
    short,
    held,
    holdQuestion,
    resumeQuestion,
    track: () => runTrack,
    start,
    answer,
    stop,
    dispose,
    abandon,
  }
}
