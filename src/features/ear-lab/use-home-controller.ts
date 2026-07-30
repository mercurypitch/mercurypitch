// ============================================================
// Home controller — scale-degree identification (Faculty II).
//
// Each round plants a key with an I-IV-V-I cadence in a roved
// tonic, sounds one diatonic probe, and takes a degree answer.
// Ratings move through the store's Elo path (guess floor 1/7);
// a wrong answer replays the probe and then the tonic, so the
// ear hears the distance it just misjudged.
// ============================================================

import { batch, createSignal } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { Rating } from '@/lib/ear/elo'
import type { HomeDegree } from '@/lib/ear/item-bank'
import { cadenceChordMidis, HOME_CHOICES, HOME_DRILL_ID, homeItemId, homeItemState, pickHomeItem, probeMidi, roveRootMidi, } from '@/lib/ear/item-bank'
import { midiToFreq } from '@/lib/scale-data'
import { creditEarSession, earItemStates, earPlayerRating, recordIdentificationAnswer, } from '@/stores/ear-lab-store'

export type HomePhase =
  | 'idle'
  | 'cadence'
  | 'probe'
  | 'answer'
  | 'reveal'
  | 'done'

export interface HomeRoundOutcome {
  degree: number
  answered: number
  correct: boolean
}

export interface HomeResult {
  correct: number
  total: number
  rating: Rating
  ratingDelta: number
  outcomes: HomeRoundOutcome[]
}

export const HOME_ROUNDS = 12

const CHORD_MS = 380
const CHORD_GAP_MS = 90
const PROBE_MS = 850
const REVEAL_CORRECT_MS = 650
const REVEAL_WRONG_MS = 1500

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

export function useHomeController(audioEngine: AudioLike) {
  const [phase, setPhase] = createSignal<HomePhase>('idle')
  const [cadenceStep, setCadenceStep] = createSignal(0)
  const [round, setRound] = createSignal(0)
  const [currentDegree, setCurrentDegree] = createSignal<HomeDegree | null>(
    null,
  )
  const [answeredDegree, setAnsweredDegree] = createSignal<number | null>(null)
  const [rating, setRating] = createSignal<Rating>(
    earPlayerRating(HOME_DRILL_ID),
  )
  const [result, setResult] = createSignal<HomeResult | null>(null)

  let rootMidi = 60
  let lastItemId: string | undefined
  let outcomes: HomeRoundOutcome[] = []
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

  function start(): void {
    cancelled = false
    startedAt = performance.now()
    outcomes = []
    ratingAtStart = earPlayerRating(HOME_DRILL_ID).rating
    batch(() => {
      setRound(0)
      setResult(null)
      setRating(earPlayerRating(HOME_DRILL_ID))
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

    batch(() => {
      setCurrentDegree(pick.degree)
      setAnsweredDegree(null)
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
  }

  /** Replay the probe, then land on the tonic — the distance the ear
   *  just misjudged, heard once more with the answer known. */
  async function playResolution(degree: number): Promise<void> {
    await audioEngine.playTone(midiToFreq(probeMidi(rootMidi, degree)), 420)
    if (cancelled) return
    await audioEngine.playTone(midiToFreq(rootMidi), 500)
  }

  function answer(degree: number): void {
    if (phase() !== 'answer' || cancelled) return
    const target = currentDegree()
    if (!target) return

    const correct = degree === target.degree
    const itemDifficulty = homeItemState(earItemStates(), target.degree)
    const nextRating = recordIdentificationAnswer({
      drillId: HOME_DRILL_ID,
      itemId: homeItemId(target.degree),
      itemDifficulty,
      correct,
      guessRate: 1 / HOME_CHOICES,
      expected: `deg-${target.degree}`,
      answered: `deg-${degree}`,
    })
    outcomes.push({ degree: target.degree, answered: degree, correct })

    playTierSfx(
      correct
        ? { label: 'Perfect', className: 'perfect' }
        : { label: 'Missed', className: 'missed' },
    )

    batch(() => {
      setRating(nextRating)
      setAnsweredDegree(degree)
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

  function finish(): void {
    const current = rating()
    setResult({
      correct: outcomes.filter((o) => o.correct).length,
      total: outcomes.length,
      rating: current,
      ratingDelta: Math.round(current.rating - ratingAtStart),
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
    cadenceStep,
    round,
    totalRounds: HOME_ROUNDS,
    currentDegree,
    answeredDegree,
    rating,
    result,
    start,
    answer,
    stop,
    reset,
    dispose,
  }
}
