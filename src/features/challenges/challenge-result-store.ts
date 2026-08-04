// ============================================================
// Challenge result — the after-run moment above the frozen challenge stage
// ============================================================
//
// A consumed weekly Legend attempt publishes here without changing tabs.
// App.tsx owns the card so it can appear over the challenge stage whether
// the singer launched from Home or Challenges. Dismissing it reveals the
// frozen trace; another scored attempt must be armed explicitly.

import { createSignal } from 'solid-js'
import type { ExerciseVoiceCaptureOutcome } from '@/features/exercises/use-base-exercise'
import type { MelodyItem } from '@/types'
import type { WeeklyTier } from './weekly-attempt'

export interface ChallengeResult {
  challengeId: string
  title: string
  score: number
  targetScore: number
  tier: WeeklyTier
  /** True when this run granted the challenge's reward badge. */
  badgeGranted: boolean
  /** Present for stage-launched attempts so the line can move into Zen. */
  targetItems?: MelodyItem[]
  /** Temporary local replay handed off before the Exercise page unmounts. */
  voiceCapture?: ExerciseVoiceCaptureOutcome
}

const [lastChallengeResult, setLastChallengeResult] =
  createSignal<ChallengeResult | null>(null)

export { lastChallengeResult }

/**
 * True while a finished run is being written up.
 *
 * Between the last note and the result card there are three sequential
 * round trips — the session record, the reward badge, then the grant
 * engine re-reading 200 records. That is a second or two on a decent
 * connection and longer on a phone, and the screen showed NOTHING: the
 * stage sat frozen, so singers thought it had hung and left the
 * exercise, only for the card to appear over whatever they opened next.
 */
const [finalizingResult, setFinalizingResult] = createSignal(false)

export { finalizingResult }

/** Wrap the after-run work so the UI can say it is happening. */
export async function whileFinalizing<T>(work: () => Promise<T>): Promise<T> {
  setFinalizingResult(true)
  try {
    return await work()
  } finally {
    setFinalizingResult(false)
  }
}

export function presentChallengeResult(result: ChallengeResult): void {
  setFinalizingResult(false)
  setLastChallengeResult(result)
}

export function clearChallengeResult(): void {
  setLastChallengeResult(null)
  setFinalizingResult(false)
}

export function discardChallengeVoiceCapture(): void {
  setLastChallengeResult((result) =>
    result === null || result.voiceCapture === undefined
      ? result
      : {
          ...result,
          voiceCapture: { state: 'discarded', take: null },
        },
  )
}
