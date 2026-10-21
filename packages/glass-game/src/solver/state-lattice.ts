// State lattice — bounded-search ordering keys, never a proof of physical state equivalence.

import type { PlatformRuntimeSnapshot, PlayerState } from '../contracts.ts'

export const LATTICE_RESOLUTION = {
  horizontalStepMetres: 0.1,
  verticalStepMetres: 0.05,
  velocityStepMetresPerSecond: 0.05,
} as const

export interface LatticeContext {
  ticks: number
  platformStates?: readonly PlatformRuntimeSnapshot[]
  /** Full macro history preserves hidden run-up, coyote, jump-latch and contact state. */
  inputHistory: string
}

export class StateLattice {
  private readonly visited = new Set<string>()
  private readonly stepXZ: number
  private readonly stepY: number
  constructor(
    stepXZ: number = LATTICE_RESOLUTION.horizontalStepMetres,
    stepY: number = LATTICE_RESOLUTION.verticalStepMetres,
  ) {
    if (![stepXZ, stepY].every((step) => Number.isFinite(step) && step > 0)) {
      throw new RangeError('Lattice resolution must be finite and positive.')
    }
    this.stepXZ = stepXZ
    this.stepY = stepY
  }

  hash(
    player: PlayerState,
    activeSolidIds: readonly string[] = [],
    context?: LatticeContext,
  ): string {
    const cells = [
      player.position.x / this.stepXZ,
      player.position.y / this.stepY,
      player.position.z / this.stepXZ,
    ].map(Math.round)
    const velocity = [
      player.velocity.x,
      player.velocity.y,
      player.velocity.z,
    ].map((v) => Math.round(v / LATTICE_RESOLUTION.velocityStepMetresPerSecond))
    return JSON.stringify([
      cells,
      velocity,
      player.grounded,
      player.supportPlatformId,
      [...activeSolidIds].sort(),
      context?.ticks,
      context?.platformStates,
      context?.inputHistory,
    ])
  }

  has(
    player: PlayerState,
    activeSolidIds: readonly string[] = [],
    context?: LatticeContext,
  ): boolean {
    return this.visited.has(this.hash(player, activeSolidIds, context))
  }

  add(
    player: PlayerState,
    activeSolidIds: readonly string[] = [],
    context?: LatticeContext,
  ): boolean {
    const key = this.hash(player, activeSolidIds, context)
    if (this.visited.has(key)) return false
    this.visited.add(key)
    return true
  }

  get size(): number {
    return this.visited.size
  }
  clear(): void {
    this.visited.clear()
  }
}
