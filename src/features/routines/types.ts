import type { ExerciseType } from '@/features/exercises/types'

export type SegmentKind = 'warmup' | 'exercise' | 'challenge-prep' | 'cooldown'

export interface RoutineSegment {
  type: SegmentKind
  durationSec: number
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
}
