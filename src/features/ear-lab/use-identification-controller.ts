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

import { batch, createSignal } from 'solid-js'
import { playTierSfx } from '@/features/exercises/feedback'
import type { EarBankItem } from '@/lib/ear/banks'
import { bankItemState, pickBankItem } from '@/lib/ear/banks'
import type { IdentificationDrill } from '@/lib/ear/drills'
import { guessRate } from '@/lib/ear/drills'
import type { Rating } from '@/lib/ear/elo'
import { creditEarSession, earItemStates, earPlayerRating, recordIdentificationAnswer, } from '@/stores/ear-lab-store'

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

const REVEAL_CORRECT_MS = 650
const REVEAL_WRONG_MS = 1500

export function useIdentificationController(
  drill: IdentificationDrill,
  bank: readonly EarBankItem[],
  makeTrial: (item: EarBankItem) => IdentificationTrial,
) {
  const [phase, setPhase] = createSignal<IdentificationPhase>('idle')
  const [round, setRound] = createSignal(0)
  const [expectedId, setExpectedId] = createSignal<string | null>(null)
  const [answeredId, setAnsweredId] = createSignal<string | null>(null)
  const [rating, setRating] = createSignal<Rating>(earPlayerRating(drill.id))
  const [result, setResult] = createSignal<IdentificationResult | null>(null)

  let currentItem: EarBankItem | null = null
  let trial: IdentificationTrial | null = null
  let lastItemId: string | undefined
  let outcomes: IdentificationOutcome[] = []
  let ratingAtStart = 0
  let startedAt = 0
  let cancelled = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function start(): void {
    cancelled = false
    startedAt = performance.now()
    outcomes = []
    ratingAtStart = earPlayerRating(drill.id).rating
    batch(() => {
      setRound(0)
      setResult(null)
      setRating(earPlayerRating(drill.id))
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
      drillId: drill.id,
      itemId: item.itemId,
      itemDifficulty: bankItemState(earItemStates(), item),
      correct,
      guessRate: guessRate(drill),
      expected,
      answered: choiceId,
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

    if (!correct && trial?.replayOnWrong) void trial.replayOnWrong()

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

  function stop(): void {
    if (phase() === 'idle' || phase() === 'done') return
    clearTimeout(timer)
    finish()
  }

  function dispose(): void {
    cancelled = true
    clearTimeout(timer)
  }

  return {
    phase,
    round,
    totalRounds: IDENTIFICATION_ROUNDS,
    expectedId,
    answeredId,
    rating,
    result,
    start,
    answer,
    stop,
    dispose,
  }
}
