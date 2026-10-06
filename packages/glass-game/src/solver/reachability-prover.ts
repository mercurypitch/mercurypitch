// Reachability prover — goal-directed forward exploration proving physical route accessibility.

import type { LevelDefinition, MovementInput, Vec3 } from '../contracts'
import { BREAKABLE_INTERACTION_RADIUS } from '../core/exhibit-interaction'
import { createGlassGame } from '../core/game'
import { MOVEMENT } from '../core/movement'
import type { ReachabilityProof, ReachabilityTarget } from './contracts'
import { expandMacroToInputs, generateGoalDirectedActions } from './macro-inputs'
import { StateLattice } from './state-lattice'
import { distXZ, isWithinInteraction, replayTrajectory } from './trajectory-stepper'

export interface ReachabilitySearchOptions {
  maxFrontierExpansions?: number
  macroTickDuration?: number
  savedProgress?: unknown
}

interface SearchNode {
  inputs: MovementInput[]
  position: Vec3
  grounded: boolean
  costG: number // elapsed seconds
  heuristicH: number // distance estimate / speed
}

export function proveReachability(
  level: LevelDefinition,
  target: ReachabilityTarget,
  options: ReachabilitySearchOptions = {},
): ReachabilityProof {
  const maxExpansions = options.maxFrontierExpansions ?? 3500
  const macroDuration = options.macroTickDuration ?? 8
  const lattice = new StateLattice()

  // Initial node from spawn
  const initialGame = createGlassGame(level, options.savedProgress)
  const initialPlayer = initialGame.snapshot().player
  const initialSolids = initialGame.snapshot().activeSolidIds

  lattice.add(initialPlayer, initialSolids)

  const initialDistance = distXZ(initialPlayer.position, target.anchor)
  if (isWithinInteraction(initialPlayer.position, target.anchor, target.interactionRadius) && initialPlayer.grounded) {
    return {
      targetId: target.id,
      reachable: true,
      elapsedSeconds: 0,
      totalTicks: 0,
      witnessInputSequence: [],
      exploredStatesCount: 1,
    }
  }

  const frontier: SearchNode[] = [
    {
      inputs: [],
      position: initialPlayer.position,
      grounded: initialPlayer.grounded,
      costG: 0,
      heuristicH: initialDistance / MOVEMENT.speed,
    },
  ]

  let expansions = 0

  while (frontier.length > 0 && expansions < maxExpansions) {
    expansions++

    // Pop node with smallest f = g + h
    let bestIdx = 0
    let bestF = frontier[0].costG + frontier[0].heuristicH
    for (let i = 1; i < frontier.length; i++) {
      const f = frontier[i].costG + frontier[i].heuristicH
      if (f < bestF) {
        bestF = f
        bestIdx = i
      }
    }

    const current = frontier.splice(bestIdx, 1)[0]

    // Generate goal-directed candidate actions
    const candidateMacros = generateGoalDirectedActions(
      current.position,
      target.anchor,
      current.grounded,
      macroDuration,
    )

    for (const macro of candidateMacros) {
      const newInputs = [...current.inputs, ...expandMacroToInputs(macro)]
      const replay = replayTrajectory(level, options.savedProgress, newInputs)

      if (replay.fell) continue

      const player = replay.player
      const solids = replay.game.snapshot().activeSolidIds

      // Check if goal is reached
      if (
        isWithinInteraction(player.position, target.anchor, target.interactionRadius ?? BREAKABLE_INTERACTION_RADIUS) &&
        player.grounded
      ) {
        return {
          targetId: target.id,
          reachable: true,
          elapsedSeconds: newInputs.length * MOVEMENT.fixedStep,
          totalTicks: newInputs.length,
          witnessInputSequence: newInputs,
          exploredStatesCount: lattice.size,
        }
      }

      // Check lattice deduplication
      if (lattice.add(player, solids)) {
        const d = distXZ(player.position, target.anchor)
        frontier.push({
          inputs: newInputs,
          position: player.position,
          grounded: player.grounded,
          costG: newInputs.length * MOVEMENT.fixedStep,
          heuristicH: d / MOVEMENT.speed,
        })

        // Keep frontier bounded if necessary
        if (frontier.length > 5000) {
          frontier.sort((a, b) => (a.costG + a.heuristicH) - (b.costG + b.heuristicH))
          frontier.length = 3500
        }
      }
    }
  }

  return {
    targetId: target.id,
    reachable: false,
    exploredStatesCount: lattice.size,
    reason: `Frontier exhausted after ${expansions} expansions (${lattice.size} states explored)`,
  }
}
