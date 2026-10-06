// Runner movement contracts — shared mutable physics state without coupling the lane and continuous solvers.

import type { RunnerLateralSegment } from './continuous-lateral'
import type { RunnerLane } from './contracts'

export interface LaneTransition {
  fromX: number
  toX: number
  startCourseSeconds: number
  endCourseSeconds: number
}

export interface RunnerMovementState {
  targetLane: RunnerLane
  lateralX: number
  lateralVelocityMetersPerSecond: number
  steeringAxis: number
  feetY: number
  verticalVelocityMetersPerSecond: number
  grounded: boolean
  coyoteRemainingSeconds: number
  jumpBufferRemainingSeconds: number
  laneTransition: LaneTransition | null
}

export interface RunnerMovementStepResult {
  readonly lateralSegments?: readonly RunnerLateralSegment[]
  readonly collided: boolean
  readonly fell: boolean
}
