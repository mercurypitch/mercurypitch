// Solver contracts — types for headless trajectory exploration and security verification.

import type { MovementInput, PlayerState, Vec3 } from '../contracts'

export interface MacroInput {
  moveX: number
  moveZ: number
  jumpDown: boolean
  durationTicks: number
}

export interface SolverStateKey {
  cellX: number
  cellY: number
  cellZ: number
  vSignX: number
  vSignZ: number
  grounded: boolean
  activeSolidsHash: string
}

export interface TrajectoryNode {
  player: PlayerState
  elapsedSeconds: number
  ticks: number
  inputs: MovementInput[]
  parent?: TrajectoryNode
}

export interface ReachabilityTarget {
  id: string
  label: string
  anchor: Vec3
  interactionRadius: number
  requiresCompleted?: readonly string[]
}

export interface ReachabilityProof {
  targetId: string
  reachable: boolean
  elapsedSeconds?: number
  totalTicks?: number
  witnessInputSequence?: MovementInput[]
  exploredStatesCount: number
  reason?: string
}

export interface SequenceBreakProof {
  bridgeOrGateId: string
  secure: boolean
  gapWidthMetres: number
  maximumReachMetres: number
  clearanceMarginMetres: number
  testedTrajectoriesCount: number
  exploitWitnessSequence?: MovementInput[]
}
