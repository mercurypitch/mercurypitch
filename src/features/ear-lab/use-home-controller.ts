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
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { SungFrame } from '@/lib/ear/degree-detect'
import { detectSungDegree } from '@/lib/ear/degree-detect'
import type { Rating } from '@/lib/ear/elo'
import type { HomeDegree } from '@/lib/ear/item-bank'
import type { DegreeSet } from '@/lib/ear/item-bank'
import { cadenceChordMidis, HOME_SET, homeItemState, pickHomeItem, probeMidi, roveRootMidi, } from '@/lib/ear/item-bank'
import { HOME_TIMING } from '@/lib/ear/timing'
import { midiToFreq } from '@/lib/scale-data'
import { creditEarSession, earItemStates, earPlayerRating, markSprintSegmentDone, recordIdentificationAnswer, } from '@/stores/ear-lab-store'
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

  let rootMidi = 60
  let lastItemId: string | undefined
  let outcomes: HomeRoundOutcome[] = []
  let skipped = 0
  let retriedThisRound = false
  let ratingAtStart = 0
  let startedAt = 0
  let cancelled = false
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

  /** The chord as a chord: every member a full voice of the engine's
   *  instrument, started together. (The engine's own chord members are
   *  faint sines meant to colour one note, not to carry a cadence —
   *  through them a cadence came out as four bare roots.) playTone
   *  resolves once the tone is scheduled, so the chord's length is
   *  waited out here: the lamp lit for it stays lit exactly as long as
   *  it sounds, and the next chord waits its turn. */
  async function playChord(midis: number[], ms: number): Promise<void> {
    await Promise.all(
      midis.map((midi) => audioEngine.playTone(midiToFreq(midi), ms)),
    )
    await wait(ms)
  }

  function start(runMode: HomeAnswerMode): void {
    cancelled = false
    startedAt = performance.now()
    outcomes = []
    skipped = 0
    ratingAtStart = earPlayerRating(drillIdFor(set, runMode)).rating
    batch(() => {
      setMode(runMode)
      setRound(0)
      setResult(null)
      setLastCents(null)
      setUnclear(false)
      setRating(earPlayerRating(drillIdFor(set, runMode)))
    })
    void playRound()
  }

  async function playRound(): Promise<void> {
    if (cancelled) return
    if (round() >= HOME_ROUNDS) {
      finish()
      return
    }

    const pick = pickHomeItem(earItemStates(), rating().rating, {
      avoidItemId: lastItemId,
      set,
    })
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

    const chords = cadenceChordMidis(rootMidi)
    for (let i = 0; i < chords.length; i++) {
      if (cancelled) return
      setCadenceStep(i + 1)
      await playChord(chords[i], HOME_TIMING.chordMs)
      await wait(HOME_TIMING.chordGapMs)
    }
    if (cancelled) return

    setPhase('probe')
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, pick.degree.degree, set)),
      HOME_TIMING.probeMs,
    )
    // The answer opens once the probe has died away, so a sung answer
    // is never captured over the probe still sounding from the speakers.
    await wait(HOME_TIMING.probeMs)
    // Stop may have landed while the probe was sounding; arming the
    // answer here would resurrect a finished run.
    if (cancelled) return
    setPhase('answer')

    if (mode() === 'mic') void listenForAnswer()
  }

  /** One mic answer window; an unclear take gets exactly one retry,
   *  then the round is skipped without touching the rating —
   *  production noise must not masquerade as a perception error. */
  async function listenForAnswer(): Promise<void> {
    if (!singCapture) return
    singCapture.startWindow()
    await wait(HOME_TIMING.singWindowMs)
    if (cancelled || phase() !== 'answer') return

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

    const isMic = mode() === 'mic'
    const correct = degree === target.degree
    const itemDifficulty = homeItemState(earItemStates(), target.degree, set)
    const nextRating = recordIdentificationAnswer({
      drillId: drillIdFor(set, mode()),
      itemId: set.itemId(target.degree),
      itemDifficulty,
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

    batch(() => {
      setRating(nextRating)
      setAnsweredDegree(degree)
      setLastCents(centsOff ?? null)
      setUnclear(false)
      setPhase('reveal')
    })

    // A miss hears the probe fall home first; the hold — and the next
    // round — count from the end of that, or the two would overlap.
    const resolution = correct
      ? Promise.resolve()
      : playResolution(target.degree)
    void resolution
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return
        pacer.hold()
      })
  }

  /** Tap answer (the seven buttons). */
  function answer(degree: number): void {
    if (phase() !== 'answer' || mode() !== 'tap' || cancelled) return
    submit(degree)
  }

  /** Replay the probe, then land on the tonic — the distance the ear
   *  just misjudged, heard once more with the answer known. */
  async function playResolution(degree: number): Promise<void> {
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, degree, set)),
      HOME_TIMING.resolutionProbeMs,
    )
    await wait(HOME_TIMING.resolutionProbeMs)
    if (cancelled) return
    await audioEngine.playTone(
      midiToFreq(rootMidi),
      HOME_TIMING.resolutionTonicMs,
    )
    await wait(HOME_TIMING.resolutionTonicMs)
  }

  function finish(): void {
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
    // you chose to answer it, and singing your answers is still Home.
    markSprintSegmentDone(set.tapDrillId)
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
    finish()
  }

  function reset(): void {
    clearTimeout(timer)
    pacer.cancel()
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
  }

  onCleanup(dispose)

  return {
    phase,
    mode,
    cadenceStep,
    round,
    totalRounds: HOME_ROUNDS,
    currentDegree,
    answeredDegree,
    lastCents,
    unclear,
    rating,
    result,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    start,
    answer,
    stop,
    reset,
    dispose,
  }
}
