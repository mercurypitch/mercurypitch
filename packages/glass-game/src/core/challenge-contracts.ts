// Challenge judge contracts — shared capture-clock progress for every lesson.

import type { ChallengeDefinition, PitchObservation, PitchTargetId, } from '../contracts'

export interface ChallengeProgress {
  kind: ChallengeDefinition['kind']
  stepIndex: number
  stepCount: number
  stepCharge: number
  charge: number
  target: PitchTargetId
  targetMidi: number
}

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
