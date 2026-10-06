// State lattice — spatial quantization and visited state deduplication.

import type { PlayerState } from '../contracts'

export const LATTICE_RESOLUTION = {
  horizontalStepMetres: 0.10,
  verticalStepMetres: 0.05,
  velocityVelocityThreshold: 0.20,
} as const

export class StateLattice {
  private readonly visited = new Set<string>()

  constructor(
    private readonly stepXZ = LATTICE_RESOLUTION.horizontalStepMetres,
    private readonly stepY = LATTICE_RESOLUTION.verticalStepMetres,
  ) {}

  hash(player: PlayerState, activeSolidIds: readonly string[] = []): string {
    const cx = Math.round(player.position.x / this.stepXZ)
    const cy = Math.round(player.position.y / this.stepY)
    const cz = Math.round(player.position.z / this.stepXZ)

    const vx = Math.abs(player.velocity.x) < LATTICE_RESOLUTION.velocityVelocityThreshold
      ? 0
      : Math.sign(player.velocity.x)
    const vz = Math.abs(player.velocity.z) < LATTICE_RESOLUTION.velocityVelocityThreshold
      ? 0
      : Math.sign(player.velocity.z)

    const grounded = player.grounded ? 1 : 0
    // Compact stable hash of active solids
    const solidsKey = activeSolidIds.length > 0 ? activeSolidIds.slice().sort().join('|') : '_'

    return `${cx}:${cy}:${cz}:${vx}:${vz}:${grounded}:${solidsKey}`
  }

  has(player: PlayerState, activeSolidIds: readonly string[] = []): boolean {
    return this.visited.has(this.hash(player, activeSolidIds))
  }

  add(player: PlayerState, activeSolidIds: readonly string[] = []): boolean {
    const key = this.hash(player, activeSolidIds)
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
