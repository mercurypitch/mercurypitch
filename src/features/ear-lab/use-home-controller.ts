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

import { batch, createSignal } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { SungFrame } from '@/lib/ear/degree-detect'
import { detectSungDegree } from '@/lib/ear/degree-detect'
import type { Rating } from '@/lib/ear/elo'
import type { HomeDegree } from '@/lib/ear/item-bank'
import { cadenceChordMidis, HOME_CHOICES, HOME_DRILL_ID, HOME_SING_DRILL_ID, homeItemId, homeItemState, pickHomeItem, probeMidi, roveRootMidi, } from '@/lib/ear/item-bank'
import { midiToFreq } from '@/lib/scale-data'
import { creditEarSession, earItemStates, earPlayerRating, recordIdentificationAnswer, } from '@/stores/ear-lab-store'

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

const CHORD_MS = 520
const CHORD_GAP_MS = 130
const PROBE_MS = 950
const REVEAL_CORRECT_MS = 650
const REVEAL_WRONG_MS = 1500
/** How long the mic listens for a sung answer. */
const SING_WINDOW_MS = 2600

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

function drillIdFor(mode: HomeAnswerMode): string {
  return mode === 'mic' ? HOME_SING_DRILL_ID : HOME_DRILL_ID
}

export function useHomeController(
  audioEngine: AudioLike,
  singCapture?: SingCapture,
) {
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
    earPlayerRating(HOME_DRILL_ID),
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

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      timer = setTimeout(resolve, ms)
    })
  }

  async function playChord(midis: number[], ms: number): Promise<void> {
    const [root, ...rest] = midis
    const intervals = rest.map((m) => m - root)
    await audioEngine.playTone(
      midiToFreq(root),
      ms,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      intervals,
    )
  }

  function start(runMode: HomeAnswerMode): void {
    cancelled = false
    startedAt = performance.now()
    outcomes = []
    skipped = 0
    ratingAtStart = earPlayerRating(drillIdFor(runMode)).rating
    batch(() => {
      setMode(runMode)
      setRound(0)
      setResult(null)
      setLastCents(null)
      setUnclear(false)
      setRating(earPlayerRating(drillIdFor(runMode)))
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
      await playChord(chords[i], CHORD_MS)
      await wait(CHORD_GAP_MS)
    }
    if (cancelled) return

    setPhase('probe')
    await audioEngine.playTone(
      midiToFreq(probeMidi(rootMidi, pick.degree.degree)),
      PROBE_MS,
    )
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
    await wait(SING_WINDOW_MS)
    if (cancelled || phase() !== 'answer') return

    const sung = detectSungDegree(singCapture.takeFrames(), rootMidi)
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
    timer = setTimeout(() => {
      if (cancelled) return
      setRound((r) => r + 1)
      void playRound()
    }, REVEAL_WRONG_MS)
  }

  function submit(degree: number, centsOff?: number): void {
    const target = currentDegree()
    if (!target || cancelled) return

    const isMic = mode() === 'mic'
    const correct = degree === target.degree
    const itemDifficulty = homeItemState(earItemStates(), target.degree)
    const nextRating = recordIdentificationAnswer({
      drillId: drillIdFor(mode()),
      itemId: homeItemId(target.degree),
      itemDifficulty,
      correct,
      guessRate: isMic ? 0 : 1 / HOME_CHOICES,
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

    if (!correct) void playResolution(target.degree)

    timer = setTimeout(
      () => {
        if (cancelled) return
        setRound((r) => r + 1)
        void playRound()
      },
      correct ? REVEAL_CORRECT_MS : REVEAL_WRONG_MS,
    )
  }

  /** Tap answer (the seven buttons). */
  function answer(degree: number): void {
    if (phase() !== 'answer' || mode() !== 'tap' || cancelled) return
    submit(degree)
  }

  /** Replay the probe, then land on the tonic — the distance the ear
   *  just misjudged, heard once more with the answer known. */
  async function playResolution(degree: number): Promise<void> {
    await audioEngine.playTone(midiToFreq(probeMidi(rootMidi, degree)), 420)
    if (cancelled) return
    await audioEngine.playTone(midiToFreq(rootMidi), 500)
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
    setPhase('done')
  }

  /** Stop early: rounds already answered are already rated (Elo has
   *  no take-backs), so the end card just reports what happened. */
  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    clearTimeout(timer)
    finish()
  }

  function reset(): void {
    clearTimeout(timer)
    setPhase('idle')
    setResult(null)
    setCurrentDegree(null)
    setAnsweredDegree(null)
  }

  function dispose(): void {
    cancelled = true
    clearTimeout(timer)
  }

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
    start,
    answer,
    stop,
    reset,
    dispose,
  }
}
