import type { ExerciseType } from '@/features/exercises/types'

export type SegmentKind = 'warmup' | 'exercise' | 'challenge-prep' | 'cooldown'

export interface RoutineSegment {
  type: SegmentKind
  durationSec: number
  /**
   * Runs of the drill this segment asks for before it ticks off. Absent means
   * one — which is what every routine persisted or shared before reps existed
   * means, and moving their finish line mid-session would be worse than
   * leaving them short. See segment-reps.ts.
   */
  reps?: number
  config: {
    exercise?: ExerciseType
    notes?: string[]
    pattern?: string
    challengeCategory?: string
    mode?: string
  }
}

export interface RoutineTemplate {
  id: string
  name: string
  description: string
  segments: RoutineSegment[]
}

export type RoutineStatus = 'ready' | 'in-progress' | 'complete'

export interface RoutineState {
  status: RoutineStatus
  currentSegmentIndex: number
  segmentElapsedMs: number
  totalElapsedMs: number
  templateId: string | null
  completedSegments: number[]
  /** Runs banked against the current segment, cleared when it ticks off. */
  segmentRuns: number
}
