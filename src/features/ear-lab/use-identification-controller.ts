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
// ============================================================

import { batch, createSignal, onCleanup } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { EarBankItem } from '@/lib/ear/banks'
import { bankItemState, pickBankItem } from '@/lib/ear/banks'
import type { IdentificationDrill } from '@/lib/ear/drills'
import { guessRate } from '@/lib/ear/drills'
import type { Rating } from '@/lib/ear/elo'
import { creditEarSession, earItemStates, earPlayerRating, markSprintSegmentDone, recordIdentificationAnswer, } from '@/stores/ear-lab-store'
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

  let currentItem: EarBankItem | null = null
  let trial: IdentificationTrial | null = null
  let lastItemId: string | undefined
  let outcomes: IdentificationOutcome[] = []
  let ratingAtStart = 0
  let startedAt = 0
  let cancelled = false
  const pacer = createRevealPacer(
    () => {
      setRound((r) => r + 1)
      void playRound()
    },
    () => cancelled,
  )

  function start(): void {
    cancelled = false
    startedAt = performance.now()
    outcomes = []
    runTrack = options?.track?.() ?? null
    ratingAtStart = earPlayerRating(trackId()).rating
    batch(() => {
      setRound(0)
      setResult(null)
      setRating(earPlayerRating(trackId()))
    })
    void playRound()
  }

  async function playRound(): Promise<void> {
    if (cancelled) return
    if (round() >= IDENTIFICATION_ROUNDS) {
      finish()
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
    // Stop may have landed while the prompt was sounding; arming the
    // answer here would resurrect a finished run.
    if (cancelled) return
    setPhase('answer')
  }

  function answer(choiceId: string): void {
    if (phase() !== 'answer' || cancelled) return
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
    setReplaying(!correct && trial?.replayOnWrong !== undefined)
    void replay
      .catch(() => undefined)
      .then(() => {
        setReplaying(false)
        if (cancelled) return
        pacer.hold()
      })
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
    markSprintSegmentDone(drill.id)
    setPhase('done')
  }

  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    // Cancel FIRST — see playRound()'s post-await guard.
    cancelled = true
    pacer.cancel()
    options?.cancelAudio?.()
    finish()
  }

  function dispose(): void {
    cancelled = true
    pacer.cancel()
    options?.cancelAudio?.()
  }

  onCleanup(dispose)

  return {
    phase,
    round,
    totalRounds: IDENTIFICATION_ROUNDS,
    expectedId,
    answeredId,
    rating,
    result,
    replaying,
    /** Auto-advance off: the run waits on the verdict for next(). */
    parked: pacer.parked,
    next: pacer.next,
    track: () => runTrack,
    start,
    answer,
    stop,
    dispose,
  }
}
