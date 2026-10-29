// ============================================================
// Home controller — scale-degree identification (Faculty II).
//
// Each round plants a key with an I-IV-V-I cadence in a roved
// tonic, sounds one diatonic probe, and takes a degree answer —
// by tap (seven buttons) or, in mic mode, by singing or playing
// the degree. Tap answers rate under 'home' with a 1/7 guess
// floor and refine the item difficulties; mic answers rate under
// 'home-sing' with no guess floor and leave the items untouched,
// so the tap-calibrated yardsticks stay pure. Comparing the two
// ratings is the ear-vs-voice diagnostic.
//
// A wrong answer replays the probe and then the tonic, so the
// ear hears the distance it just misjudged.
//
// After the answer the native room can sound the round again (Hear it
// again: the probe falling home) and, after a tapped miss, Compare it
// (the answer's probe, then the pick's, in the round's key). Both are
// replays, as in use-identification-controller.ts: listen-only, never
// over a sound, and silenced by the next round, Stop, the sound taken
// away and the room closing, each with a token so a silenced one never
// clears a newer one's flag. A sung answer is a take, not a pick, so it
// offers no Compare.
//
// A slip on the native room's rated plate can start a pair practice
// (pair-practice.ts): a short run over just the two degrees it mixed
// up, which rates nothing and books nothing for Today.
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { SungFrame } from '@/lib/ear/degree-detect'
import { detectSungDegree } from '@/lib/ear/degree-detect'
import type { Rating } from '@/lib/ear/elo'
import type { HomeDegree } from '@/lib/ear/item-bank'
import type { DegreeSet } from '@/lib/ear/item-bank'
import { cadenceChordMidis, HOME_SET, homeItemState, pickHomeItem, probeMidi, roveRootMidi, } from '@/lib/ear/item-bank'
import { COMPARE_TIMING, HOME_TIMING } from '@/lib/ear/timing'
import { trackFirstValue } from '@/lib/first-value'
import { midiToFreq } from '@/lib/scale-data'
import type { RatedRunMark } from '@/stores/ear-lab-store'
import { creditEarSession, earItemStates, earPlayerRating, markRatedRun, markSprintSegmentDone, recordIdentificationAnswer, rollBackRatedRun, takeSprintRunLength, } from '@/stores/ear-lab-store'
import { PAIR_PRACTICE_ROUNDS, pairOrder } from './pair-practice'
import { createRevealPacer } from './reveal-pacing'

export type HomePhase =
  | 'idle'
  | 'cadence'
  | 'probe'
  | 'answer'
  | 'reveal'
  | 'done'

export type HomeAnswerMode = 'tap' | 'mic'

export interface HomeRoundOutcome {
  degree: number
  /** 0 = no usable answer (the mic window stayed unclear). */
  answered: number
  correct: boolean
  /** Mic mode: signed cents the voice was off the answered degree. */
  centsOff?: number
}

export interface HomeResult {
  correct: number
  total: number
  /** Rounds skipped because the mic never got a clear answer. */
  skipped: number
  rating: Rating
  ratingDelta: number
  mode: HomeAnswerMode
  /** Median |cents| across correctly answered mic rounds. */
  medianAbsCents: number | null
  outcomes: HomeRoundOutcome[]
}

/** The mic answer window: the drill component owns the microphone
 *  and pitch stream; the controller only opens windows and reads
 *  frames, so it stays testable without audio hardware. */
export interface SingCapture {
  /** Clear the frame window (called as the answer window opens). */
  startWindow: () => void
  /** Frames captured since startWindow(). */
  takeFrames: () => SungFrame[]
}

export const HOME_ROUNDS = 12

export interface HomeOptions {
  /** Silence anything already sounding. Called on stop and unmount,
   *  before the phase flips — a cadence committed to the audio clock
   *  outlives its setTimeout. */
  cancelAudio?: () => void
  /** The degrees to run over; Home's seven unless told otherwise. */
  set?: DegreeSet
}

interface AudioLike {
  playChord: (frequencies: number[], durationMs: number) => Promise<void>
  playTone: (
    freq: number,
    durationMs?: number,
    effectType?: undefined,
    targetFreq?: undefined,
    vibratoAmplitude?: undefined,
    tremoloRate?: undefined,
    tremoloDepth?: undefined,
    trillInterval?: undefined,
    trillRate?: undefined,
    staccatoRatio?: undefined,
    chordIntervals?: number[],
  ) => Promise<void>
}

function drillIdFor(set: DegreeSet, mode: HomeAnswerMode): string {
  return mode === 'mic' ? set.micDrillId : set.tapDrillId
}

export function useHomeController(
  audioEngine: AudioLike,
  singCapture?: SingCapture,
  options?: HomeOptions,
) {
  const set = options?.set ?? HOME_SET
  const [phase, setPhase] = createSignal<HomePhase>('idle')
  const [mode, setMode] = createSignal<HomeAnswerMode>('tap')
  const [cadenceStep, setCadenceStep] = createSignal(0)
  const [round, setRound] = createSignal(0)
  const [currentDegree, setCurrentDegree] = createSignal<HomeDegree | null>(
    null,
  )
  const [answeredDegree, setAnsweredDegree] = createSignal<number | null>(null)
  const [lastCents, setLastCents] = createSignal<number | null>(null)
  /** True while the mic window is re-opening after an unclear take —
   *  drives the "once more, louder" hint. */
  const [unclear, setUnclear] = createSignal(false)
  const [rating, setRating] = createSignal<Rating>(
    earPlayerRating(set.tapDrillId),
  )
  const [result, setResult] = createSignal<HomeResult | null>(null)
  /** True while an answered round's probe sounds again (the native
   *  room's Hear it again). */
  const [replaying, setReplaying] = createSignal(false)
  /** The question in flight was voided (the sound was taken away); it
   *  waits for resumeQuestion(). */
  const [held, setHeld] = createSignal(false)
  /** A pair practice's two degrees, while it runs and on its plate; null
   *  for a rated run. */
  const [practice, setPractice] = createSignal<
    readonly [number, number] | null
  >(null)
  /** A pair practice's questions, in order. */
  let practiceOrder: HomeDegree[] = []

  let rootMidi = 60
  let lastItemId: string | undefined
  let outcomes: HomeRoundOutcome[] = []
  let skipped = 0
  let retriedThisRound = false
  let ratingAtStart = 0
  let startedAt = 0
  let cancelled = false
  /** The ledger as this run found it, for abandon(). */
  let mark: RatedRunMark | null = null
  /** Bumped each time a question is sounded from its start: the sound
   *  it replaces must not arm the answer when it resolves. */
  let question = 0
  /** Bumped by every start(): a round still sounding its cadence when the
   *  run was stopped and started again must not carry on into the new
   *  run once its await resolves. */
  let run = 0
  /** Bumped by every replay (a miss's resolution, Hear it again,
   *  Compare) and by whatever silences one: only the latest one's end
   *  clears the flag, and a silenced one stops between its notes. */
  let replayToken = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const pacer = createRevealPacer(
    () => {
      setRound((r) => r + 1)
      void playRound()
    },
    () => cancelled,
  )

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      timer = setTimeout(resolve, ms)
    })
  }

  /** A replay's own wait. Not the question's timer: the next round
   *  starting its cadence would otherwise take that timer over, and a
   *  Stop that cleared it would leave the replay waiting for good. A
   *  silenced replay checks its token when this ends. */
  function rest(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** The chord as a chord: every member a full voice of the engine's
   *  instrument, started on one clock tick. (The engine's own chord
   *  members are faint sines meant to colour one note, and playTone is
   *  monophonic — a second call releases the first — so neither route
   *  carries a cadence.) playChord resolves once the chord is scheduled,
   *  so its length is waited out here: the lamp lit for it stays lit
   *  exactly as long as it sounds, and the next chord waits its turn. */
  async function playChord(midis: number[], ms: number): Promise<void> {
    await audioEngine.playChord(midis.map(midiToFreq), ms)
    await wait(ms)
  }

  /** Rounds in this run: the catalogue's dozen, or the fewer a
   *  sprint segment promised on its card. */
  const [totalRounds, setTotalRounds] = createSignal(HOME_ROUNDS)
  /** The run took the shorter length a Today's segment armed. */
  const [short, setShort] = createSignal(false)

  function start(runMode: HomeAnswerMode): void {
    begin(runMode, null)
  }

  /** A short practice run over two degrees of the set, asked in a
   *  balanced, shuffled order. It rates nothing (pair-practice.ts). */
  function practise(
    runMode: HomeAnswerMode,
    pair: readonly [number, number],
  ): void {
    const first = set.degrees.find((entry) => entry.degree === pair[0])
    const second = set.degrees.find((entry) => entry.degree === pair[1])
    if (first === undefined || second === undefined || first === second) return
    begin(runMode, [first, second])
  }

  function begin(
    runMode: HomeAnswerMode,
    pair: readonly [HomeDegree, HomeDegree] | null,
  ): void {
    cancelled = false
    run += 1
    startedAt = performance.now()
    outcomes = []
    skipped = 0
    ratingAtStart = earPlayerRating(drillIdFor(set, runMode)).rating
    // A practice writes nothing to put back, and leaves a length Today
    // armed to the run it was armed for.
    mark = pair === null ? markRatedRun(drillIdFor(set, runMode)) : null
    const armed = pair === null ? takeSprintRunLength(set.tapDrillId) : null
    practiceOrder = pair === null ? [] : pairOrder(pair, PAIR_PRACTICE_ROUNDS)
    batch(() => {
      setPractice(pair === null ? null : [pair[0].degree, pair[1].degree])
      setShort(armed?.rounds !== undefined)
      setTotalRounds(
        pair === null ? (armed?.rounds ?? HOME_ROUNDS) : PAIR_PRACTICE_ROUNDS,
      )
      setMode(runMode)
      setRound(0)
      setResult(null)
      setLastCents(null)
      setUnclear(false)
      setReplaying(false)
      setHeld(false)
      setRating(earPlayerRating(drillIdFor(set, runMode)))
    })
    void playRound()
  }

  async function playRound(): Promise<void> {
    const mine = run
    const stale = (): boolean => cancelled || mine !== run
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

    const ordered = practiceOrder.at(round())
    const pick =
      ordered === undefined
        ? pickHomeItem(earItemStates(), rating().rating, {
            avoidItemId: lastItemId,
            set,
          })
        : { degree: ordered, itemId: set.itemId(ordered.degree) }
    lastItemId = pick.itemId
    rootMidi = roveRootMidi()
    retriedThisRound = false

    batch(() => {
      setCurrentDegree(pick.degree)
      setAnsweredDegree(null)
      setLastCents(null)
      setUnclear(false)
      setCadenceStep(0)
      setPhase('cadence')
    })
    await soundQuestion(pick.degree)
  }

  /** The cadence, then the probe, then the answer opens: one question
   *  from its start, the first time or again after the sound was taken
   *  away. */
  async function soundQuestion(degree: HomeDegree): Promise<void> {
    const mine = run
    question += 1
    const asked = question
    const stale = (): boolean => cancelled || mine !== run || asked !== question
    batch(() => {
      setCadenceStep(0)
      setPhase('cadence')
    })

    const chords = cadenceChordMidis(rootMidi)
    for (let i = 0; i < chords.length; i++) {
      if (stale()) return
      setCadenceStep(i + 1)
      await playChord(chords[i], HOME_TIMING.chordMs)
      await wait(HOME_TIMING.chordGapMs)
    }
    if (stale()) return

    setPhase('probe')
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, degree.degree, set)),
      HOME_TIMING.probeMs,
    )
    // The answer opens once the probe has died away, so a sung answer
    // is never captured over the probe still sounding from the speakers.
    await wait(HOME_TIMING.probeMs)
    // Stop may have landed while the probe was sounding, or the run may
    // have been started again; arming the answer here would resurrect a
    // finished run.
    if (stale()) return
    setPhase('answer')

    if (mode() === 'mic') void listenForAnswer()
  }

  /** One mic answer window; an unclear take gets exactly one retry,
   *  then the round is skipped without touching the rating —
   *  production noise must not masquerade as a perception error. */
  async function listenForAnswer(): Promise<void> {
    if (!singCapture) return
    const mine = run
    singCapture.startWindow()
    await wait(HOME_TIMING.singWindowMs)
    if (cancelled || mine !== run || phase() !== 'answer') return

    const sung = detectSungDegree(
      singCapture.takeFrames(),
      rootMidi,
      set.degrees,
    )
    if (sung !== null) {
      submit(sung.degree.degree, sung.centsOff)
      return
    }

    if (!retriedThisRound) {
      retriedThisRound = true
      setUnclear(true)
      void listenForAnswer()
      return
    }

    // Two unclear takes: skip the round entirely.
    const target = currentDegree()
    if (target) {
      outcomes.push({ degree: target.degree, answered: 0, correct: false })
    }
    skipped++
    batch(() => {
      setUnclear(false)
      setAnsweredDegree(null)
      setPhase('reveal')
    })
    pacer.hold()
  }

  function submit(degree: number, centsOff?: number): void {
    const target = currentDegree()
    if (!target || cancelled) return
    const mine = run

    const isMic = mode() === 'mic'
    const correct = degree === target.degree
    // A pair practice rates nothing: the rating stays where it was.
    const nextRating =
      practice() !== null
        ? rating()
        : recordIdentificationAnswer({
            drillId: drillIdFor(set, mode()),
            itemId: set.itemId(target.degree),
            itemDifficulty: homeItemState(earItemStates(), target.degree, set),
            correct,
            guessRate: isMic ? 0 : 1 / set.choices,
            expected: `deg-${target.degree}`,
            answered: `deg-${degree}`,
            updateItem: !isMic,
          })
    outcomes.push({
      degree: target.degree,
      answered: degree,
      correct,
      ...(centsOff !== undefined ? { centsOff } : {}),
    })

    playTierSfx(
      correct
        ? { label: 'Perfect', className: 'perfect' }
        : { label: 'Missed', className: 'missed' },
    )

    // A miss hears the probe fall home first; the hold — and the next
    // round — count from the end of that, or the two would overlap. It
    // is a replay while it sounds: nothing else plays over it.
    replayToken += 1
    const token = replayToken
    batch(() => {
      setRating(nextRating)
      setAnsweredDegree(degree)
      setLastCents(centsOff ?? null)
      setUnclear(false)
      setReplaying(!correct)
      setPhase('reveal')
    })

    const resolution = correct
      ? Promise.resolve()
      : playResolution(target.degree, token)
    void resolution
      .catch(() => undefined)
      .then(() => {
        // A stale run's resolution must not flick the new run's flag.
        if (mine === run && token === replayToken) setReplaying(false)
        if (cancelled || mine !== run) return
        pacer.hold(correct)
      })
  }

  /** Hear an answered round again: its probe, falling home. Never
   *  before the answer, as often as wanted after; a hold counting down
   *  stops and waits for Next. */
  function replayAllowed(): boolean {
    return phase() === 'reveal' && !replaying() && currentDegree() !== null
  }

  async function replay(): Promise<void> {
    const target = currentDegree()
    if (!replayAllowed() || target === null) return
    await listenAgain((token) => playResolution(target.degree, token))
  }

  /** The verdict on the stage is a tapped miss: its pick is a note of
   *  the key, and can be sounded. A sung answer is a take. */
  function comparable(): boolean {
    const target = currentDegree()
    const picked = answeredDegree()
    return (
      phase() === 'reveal' &&
      mode() === 'tap' &&
      target !== null &&
      picked !== null &&
      picked !== target.degree
    )
  }

  /** Compare, as often as wanted after a tapped miss, never over a
   *  sound. */
  function compareAllowed(): boolean {
    return comparable() && !replaying()
  }

  /** The answer's probe, then the pick's, in the round's key. */
  async function compare(): Promise<void> {
    const target = currentDegree()
    const picked = answeredDegree()
    if (!compareAllowed() || target === null || picked === null) return
    await listenAgain((token) => playCompare(target.degree, picked, token))
  }

  /** A sound after the answer, to listen to only: a hold counting down
   *  waits for Next, and the flag goes when it ends, unless something
   *  newer silenced it first. */
  async function listenAgain(
    sound: (token: number) => Promise<void>,
  ): Promise<void> {
    const mine = run
    replayToken += 1
    const token = replayToken
    pacer.pause()
    setReplaying(true)
    try {
      await sound(token)
    } catch {
      // A probe that failed to sound is no reason to strand the verdict.
    } finally {
      if (mine === run && token === replayToken) setReplaying(false)
    }
  }

  /** A replay silenced from outside may never end on its own: its flag
   *  goes now, and its end, if it comes, finds a newer token. */
  function endReplay(): void {
    replayToken += 1
    setReplaying(false)
  }

  /** Tap answer (the seven buttons). */
  function answer(degree: number): void {
    if (phase() !== 'answer' || mode() !== 'tap' || cancelled) return
    submit(degree)
  }

  /** Replay the probe, then land on the tonic — the distance the ear
   *  just misjudged, heard once more with the answer known. Stops
   *  between its notes once `token` is no longer the latest replay's. */
  async function playResolution(degree: number, token: number): Promise<void> {
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, degree, set)),
      HOME_TIMING.resolutionProbeMs,
    )
    await rest(HOME_TIMING.resolutionProbeMs)
    if (cancelled || token !== replayToken) return
    await audioEngine.playTone(
      midiToFreq(rootMidi),
      HOME_TIMING.resolutionTonicMs,
    )
    await rest(HOME_TIMING.resolutionTonicMs)
  }

  /** The answer's probe, then the pick's, as long as the question's,
   *  in its key and register. Stops between them once silenced. */
  async function playCompare(
    expected: number,
    picked: number,
    token: number,
  ): Promise<void> {
    const live = (): boolean => !cancelled && token === replayToken
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, expected, set)),
      HOME_TIMING.probeMs,
    )
    await rest(HOME_TIMING.probeMs)
    if (!live()) return
    await rest(COMPARE_TIMING.gapMs)
    if (!live()) return
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, picked, set)),
      HOME_TIMING.probeMs,
    )
    await rest(HOME_TIMING.probeMs)
  }

  function finish(complete: boolean): void {
    const current = rating()
    const centsValues = outcomes
      .filter((o) => o.correct && o.centsOff !== undefined)
      .map((o) => Math.abs(o.centsOff ?? 0))
      .sort((a, b) => a - b)
    setResult({
      correct: outcomes.filter((o) => o.correct).length,
      total: outcomes.length,
      skipped,
      rating: current,
      ratingDelta: Math.round(current.rating - ratingAtStart),
      mode: mode(),
      medianAbsCents:
        centsValues.length > 0
          ? centsValues[Math.floor(centsValues.length / 2)]
          : null,
      outcomes: [...outcomes],
    })
    creditEarSession(performance.now() - startedAt)
    // Always the tap id: the sprint schedules the drill, not the way
    // you chose to answer it, and singing your answers is still Home. A
    // segment counts when the run reached its end, not when abandoned,
    // and never for a pair practice: Today asked for the drill.
    if (complete && practice() === null) {
      markSprintSegmentDone(set.tapDrillId)
      // A run of skipped rounds (no clear sung answer) got no result.
      if (outcomes.some((o) => o.answered > 0)) trackFirstValue('ear')
    }
    setPhase('done')
  }

  /** Stop early: rounds already answered are already rated (Elo has
   *  no take-backs), so the end card just reports what happened. */
  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    // Cancel FIRST — the in-flight cadence/probe checks this after
    // every await, and without it the round would re-arm its answer
    // phase after the end card is already showing.
    cancelled = true
    clearTimeout(timer)
    pacer.cancel()
    options?.cancelAudio?.()
    endReplay()
    if (outcomes.length === 0 && skipped === 0) {
      // Nothing answered: the end card reports an empty run, and no sprint
      // segment, session or streak is booked for it.
      setResult({
        correct: 0,
        total: 0,
        skipped: 0,
        rating: rating(),
        ratingDelta: 0,
        mode: mode(),
        medianAbsCents: null,
        outcomes: [],
      })
      setPhase('done')
      return
    }
    finish(false)
  }

  function reset(): void {
    clearTimeout(timer)
    pacer.cancel()
    endReplay()
    setPhase('idle')
    setResult(null)
    setCurrentDegree(null)
    setAnsweredDegree(null)
  }

  function dispose(): void {
    cancelled = true
    clearTimeout(timer)
    pacer.cancel()
    options?.cancelAudio?.()
    endReplay()
  }

  /** The sound was taken away. The cadence or probe still sounding, or
   *  a sung answer's window, is void; a verdict counting down waits for
   *  Next, and a replay of it stops, to be heard whole once the sound is
   *  back. */
  function holdQuestion(): void {
    if (phase() === 'reveal') {
      if (replaying()) {
        options?.cancelAudio?.()
        endReplay()
      }
      pacer.pause()
      return
    }
    const inFlight =
      phase() === 'cadence' ||
      phase() === 'probe' ||
      (phase() === 'answer' && mode() === 'mic')
    if (!inFlight || cancelled) return
    question += 1
    clearTimeout(timer)
    options?.cancelAudio?.()
    setHeld(true)
  }

  /** The voided question, from its start: the same key and the same
   *  note. */
  async function resumeQuestion(): Promise<void> {
    const target = currentDegree()
    if (!held() || cancelled || target === null) return
    setHeld(false)
    await soundQuestion(target)
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
    mode,
    cadenceStep,
    round,
    get totalRounds() {
      return totalRounds()
    },
    currentDegree,
    answeredDegree,
    lastCents,
    unclear,
    rating,
    result,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    /** A hold counting down waits for Next instead. */
    pause: pacer.pause,
    replaying,
    replayAllowed,
    replay,
    /** A tapped miss on the stage that Compare can sound. */
    comparable,
    compareAllowed,
    compare,
    /** A Today's short run. */
    short,
    held,
    holdQuestion,
    resumeQuestion,
    /** The two degrees a practice runs over, or null for a rated run. */
    practice,
    practise,
    start,
    answer,
    stop,
    reset,
    dispose,
    abandon,
  }
}
