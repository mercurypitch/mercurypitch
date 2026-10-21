// Chunk route declarations — sockets attach to real floor edges and routes name their landings.

import { platformContactAtState } from '../compile-cloudway-platforms.ts'
import { compileAssembledPlatform, platformContactEnvelope, } from './chunk-envelopes.ts'
import type { CardinalDirection, ChunkGap, ChunkPlatform, ChunkSocket, } from './contracts.ts'

export function createChunkSocket(
  id: 'entry' | 'exit',
  platform: ChunkPlatform,
  facing: CardinalDirection,
): ChunkSocket {
  const p = {
    ...platform,
    id: platform.localId,
    quarterTurns: platform.quarterTurns ?? 0,
  }
  const axis = facing === 'east' || facing === 'west' ? 'x' : 'z'
  const positive = (facing === 'north' || facing === 'east') === (id === 'exit')
  const compiled = compileAssembledPlatform(p)
  const bounds =
    compiled.definition.behavior?.kind === 'scroll' &&
    compiled.definition.behavior.axis === axis
      ? platformContactAtState(
          compiled,
          'scroll-extended',
          axis,
          positive ? 1 : -1,
          `socket.${id}`,
        ).bounds
      : platformContactEnvelope(p)
  const coordinate =
    axis === 'x'
      ? positive
        ? bounds.maxX
        : bounds.minX
      : positive
        ? bounds.maxZ
        : bounds.minZ
  return {
    id,
    platformLocalId: platform.localId,
    position: { ...platform.center, [axis]: coordinate },
    facing,
    width: axis === 'x' ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX,
    clearanceMargin: 0.6,
  }
}

/** All ordered links remain explicit, including elevated, diagonal and moving landings. */
export function declareChunkRoute(
  platforms: readonly ChunkPlatform[],
  authored: readonly ChunkGap[],
  paths: readonly (readonly string[])[] = [platforms.map((p) => p.localId)],
): readonly ChunkGap[] {
  const links = [...authored]
  for (const path of paths)
    for (let i = 1; i < path.length; i++) {
      const from = platforms.find((p) => p.localId === path[i - 1])
      const to = platforms.find((p) => p.localId === path[i])
      if (from === undefined || to === undefined)
        throw new Error('Chunk route references an unknown platform')
      if (
        links.some(
          (gap) =>
            gap.platformALocalId === from.localId &&
            gap.platformBLocalId === to.localId,
        )
      )
        continue
      const end =
        from.behavior?.kind === 'glide'
          ? {
              x: from.center.x + from.behavior.translation.x,
              z: from.center.z + from.behavior.translation.z,
            }
          : from.center
      links.push({
        localId: `route-${from.localId}-${to.localId}`,
        platformALocalId: from.localId,
        platformBLocalId: to.localId,
        axis:
          Math.abs(to.center.x - end.x) > Math.abs(to.center.z - end.z)
            ? 'x'
            : 'z',
        minimumClearanceMeters: 0,
      })
    }
  return links
}
