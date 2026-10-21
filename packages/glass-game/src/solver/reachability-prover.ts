// Reachability search — bounded forward exploration with runtime-validated positive witnesses.

import type { LevelDefinition, MovementInput, Vec3 } from '../contracts.ts'
import { createGlassGame } from '../core/game.ts'
import { MOVEMENT } from '../core/movement.ts'
import type { ReachabilityProof, ReachabilityTarget } from './contracts.ts'
import { probeGoalWalk } from './goal-walk-probe.ts'
import { boundedInteger, MAX_MACRO_TICKS } from './limits.ts'
import { expandMacroToInputs, generateGoalDirectedActions, } from './macro-inputs.ts'
import { StateLattice } from './state-lattice.ts'
import { distXZ, replayTrajectory, satisfiesTarget, } from './trajectory-stepper.ts'

export interface ReachabilitySearchOptions {
  maxFrontierExpansions?: number
  macroTickDuration?: number
  savedProgress?: unknown
  maxTrajectoryTicks?: number
  /** Counts every replayed tick, not only the retained witness. */
  maxSimulationTicks?: number
  maxFrontierSize?: number
}

interface SearchNode {
  inputs: MovementInput[]
  position: Vec3
  grounded: boolean
  score: number
  history: string
}

/** Failure is inconclusive: finite actions, beam pruning and time budgets are not impossibility proofs. */
export function proveReachability(
  level: LevelDefinition,
  target: ReachabilityTarget,
  options: ReachabilitySearchOptions = {},
): ReachabilityProof {
  const maxExpansions = options.maxFrontierExpansions ?? 3500
  const macroDuration = options.macroTickDuration ?? 12
  const maxTicks = options.maxTrajectoryTicks ?? 1800
  const simulationBudget = options.maxSimulationTicks ?? 1_000_000
  const frontierLimit = options.maxFrontierSize ?? 1000
  const lattice = new StateLattice()
  const inconclusive = (reason: string): ReachabilityProof => ({
    targetId: target.id,
    reachable: false,
    status: 'inconclusive',
    exploredStatesCount: lattice.size,
    reason,
  })
  if (
    !boundedInteger(maxExpansions, 0, 10_000) ||
    !boundedInteger(macroDuration, 1, MAX_MACRO_TICKS) ||
    !boundedInteger(maxTicks, 0, 7200) ||
    !boundedInteger(simulationBudget, 0, 10_000_000) ||
    !boundedInteger(frontierLimit, 1, 5000)
  )
    return inconclusive(
      'Invalid search budget: options must be finite bounded integers.',
    )
  if (
    ![
      target.anchor.x,
      target.anchor.y,
      target.anchor.z,
      target.interactionRadius,
    ].every(Number.isFinite) ||
    target.interactionRadius <= 0
  )
    return inconclusive('Invalid target geometry.')
  const initial = createGlassGame(level, options.savedProgress).snapshot()
  const encounter = level.breakables.find(
    (candidate) => candidate.id === target.id,
  )
  if (target.kind !== 'position' && encounter === undefined)
    return inconclusive(
      'Unknown encounter target; geometric waypoints require kind: position.',
    )
  const requirements = [
    ...(target.requiresCompleted ?? []),
    ...(target.kind === 'position' ? [] : (encounter?.requiresCompleted ?? [])),
  ]
  if (!requirements.every((id) => initial.completedBreakableIds.includes(id)))
    return inconclusive(
      'Required encounters have not been completed in the supplied progress.',
    )
  if (
    target.kind !== 'position' &&
    initial.completedBreakableIds.includes(target.id)
  )
    return inconclusive(
      'Encounter is already completed; it cannot be started again.',
    )
  const anchor = target.kind === 'position' ? target.anchor : encounter!.anchor
  const reached = (inputs: MovementInput[]): ReachabilityProof => ({
    targetId: target.id,
    reachable: true,
    status: 'reachable',
    elapsedSeconds: inputs.length * MOVEMENT.fixedStep,
    totalTicks: inputs.length,
    witnessInputSequence: inputs,
    exploredStatesCount: lattice.size,
  })
  lattice.add(initial.player, initial.activeSolidIds, {
    ticks: 0,
    platformStates: initial.platformStates,
    inputHistory: '',
  })
  if (satisfiesTarget(initial, target)) return reached([])
  // Simple court approaches should not pay for a branching search and repeated
  // prefix replay. A failed walk remains only one sampled route, not a verdict.
  const walk = probeGoalWalk(
    level,
    target,
    options.savedProgress,
    maxExpansions > 0 ? Math.min(maxTicks, simulationBudget, 600) : 0,
  )
  if (walk.reached) return reached(walk.inputs)
  const speed = level.movement?.runSpeed ?? MOVEMENT.speed
  // Deliberately greedy rather than optimal A*: useful routes within a fixed simulation budget.
  const score = (position: Vec3, ticks: number) =>
    (distXZ(position, anchor) + Math.abs(position.y - anchor.y)) / speed +
    ticks * MOVEMENT.fixedStep * 0.05
  const frontier: SearchNode[] = [
    {
      inputs: [],
      position: initial.player.position,
      grounded: initial.player.grounded,
      score: score(initial.player.position, 0),
      history: '',
    },
  ]
  let expansions = 0
  let simulatedTicks = walk.inputs.length
  let pruned = false
  while (frontier.length > 0 && expansions < maxExpansions) {
    expansions++
    let best = 0
    for (let i = 1; i < frontier.length; i++)
      if (frontier[i].score < frontier[best].score) best = i
    const current = frontier.splice(best, 1)[0]
    const actions = generateGoalDirectedActions(
      current.position,
      anchor,
      current.grounded,
      macroDuration,
    )
    // Coarse waits make ferry/scroll timing searchable without dropping stationary states.
    if (level.platforms.some((platform) => platform.behavior !== undefined)) {
      actions.push({ moveX: 0, moveZ: 0, jumpDown: false, durationTicks: 60 })
    }
    for (const macro of actions) {
      const inputs = [...current.inputs, ...expandMacroToInputs(macro)]
      if (inputs.length > maxTicks) {
        pruned = true
        continue
      }
      if (simulatedTicks + inputs.length > simulationBudget)
        return inconclusive(
          'Simulation tick budget exhausted; no valid witness found.',
        )
      simulatedTicks += inputs.length
      const replay = replayTrajectory(level, options.savedProgress, inputs)
      if (replay.fell) continue
      const snapshot = replay.game.snapshot()
      if (satisfiesTarget(snapshot, target)) return reached(inputs)
      const history = `${current.history}/${macro.moveX},${macro.moveZ},${Number(macro.jumpDown)},${macro.durationTicks}`
      if (
        !lattice.add(replay.player, snapshot.activeSolidIds, {
          ticks: inputs.length,
          platformStates: snapshot.platformStates,
          inputHistory: history,
        })
      )
        continue
      frontier.push({
        inputs,
        position: replay.player.position,
        grounded: replay.player.grounded,
        score: score(replay.player.position, inputs.length),
        history,
      })
      if (frontier.length > frontierLimit) {
        frontier.sort((a, b) => a.score - b.score)
        frontier.length = frontierLimit
        pruned = true
      }
    }
  }
  return inconclusive(
    expansions >= maxExpansions
      ? 'Expansion budget exhausted; no valid witness found.'
      : pruned
        ? 'Bounded frontier or trajectory horizon exhausted; no valid witness found.'
        : 'Sampled frontier exhausted; unsampled routes remain unknown.',
  )
}
