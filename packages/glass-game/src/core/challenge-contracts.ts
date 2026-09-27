// Challenge judge contracts — shared capture-clock progress for every lesson.

import type { ChallengeProgress, PitchObservation } from '../contracts'

export type { ChallengeProgress } from '../contracts'

export type ChallengeJudgeEvent =
  | { type: 'step-complete'; completedSteps: number }
  | { type: 'reset'; reason: 'wrong-order' }
  | { type: 'complete' }

export interface ChallengeJudge {
  feed(frame: PitchObservation, nowMs: number): readonly ChallengeJudgeEvent[]
  tick(seconds: number): void
  advanceTo(nowMs: number): void
  snapshot(): ChallengeProgress
}
