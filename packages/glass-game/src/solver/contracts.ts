// Solver contracts — types for headless trajectory exploration and security verification.

import type { MovementInput, PlayerState, Vec3 } from '../contracts.ts'

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
  /** Encounter goals use the live nearby-exhibit contract; position goals are explicit. */
  kind?: 'encounter' | 'position'
}

export interface ReachabilityProof {
  targetId: string
  reachable: boolean
  status: 'reachable' | 'inconclusive'
  elapsedSeconds?: number
  totalTicks?: number
  witnessInputSequence?: MovementInput[]
  exploredStatesCount: number
  reason?: string
}

export interface SequenceBreakProof {
  bridgeOrGateId: string
  /** A finite sample cannot certify security; retained for compatibility and always false. */
  secure: false
  status: 'exploit-found' | 'inconclusive'
  reason: string
  reachedBoundaryTrajectoriesCount: number
  gapWidthMetres: number
  maximumReachMetres: number
  clearanceMarginMetres: number
  testedTrajectoriesCount: number
  exploitWitnessSequence?: MovementInput[]
}

/** Ordered goals visited by one uninterrupted simulation, with no checkpoint teleport. */
export interface MovementRouteResult {
  status: 'reached' | 'inconclusive'
  reachedTargetIds: string[]
  totalTicks: number
  fell: boolean
  reason?: string
}
