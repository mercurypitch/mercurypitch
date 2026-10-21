// Moving platform routes with explicit departure, ferry and arrival connections.

import { declarePearlButtJoins } from './chunk-envelopes.ts'
import { createChunkSocket, declareChunkRoute } from './chunk-routing.ts'
import type { ChunkCameraSection, ChunkGap, ChunkPlatform, ProceduralChunk, } from './contracts.ts'

/** Chunk 5: Aurora Glide Chasm — moving ferry with declared departure and arrival contacts */
export function createAuroraGlideChunk(idSuffix: string): ProceduralChunk {
  // Departure landing: pearl-rest at z = 0.36 (bounds: 0.0 to 0.72)
  // Raft: aurora-glide (width 2.55, depth 1.4, half-depth 0.7)
  // Raft initial center: z = 0.72 + 0.55 + 0.70 = 1.97 (bounds at min: 1.27 to 2.67)
  // Translation deltaZ = 2.4m
  // Raft max center: z = 1.97 + 2.4 = 4.37 (bounds at max: 3.67 to 5.07)
  // Arrival dock: pearl-rest at center z = 5.07 + 0.55 + 0.36 = 5.98 (bounds: 5.62 to 6.34)
  // Clearances:
  // Departure to raft min: 1.27 - 0.72 = 0.55m
  // Raft max to arrival dock: 5.62 - 5.07 = 0.55m
  const platforms: ChunkPlatform[] = [
    {
      localId: `glide-depart-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `glide-raft-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: 0, y: 0, z: 1.97 },
      behavior: {
        kind: 'glide',
        translation: { x: 0, y: 0, z: 2.4 },
        travelSeconds: 3.2,
        dwellSeconds: 1.2,
      },
    },
    {
      localId: `glide-arrive-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 5.98 },
    },
  ]

  const gaps: ChunkGap[] = [
    {
      localId: `gap-glide-dep-${idSuffix}`,
      platformALocalId: `glide-depart-${idSuffix}`,
      platformBLocalId: `glide-arrive-${idSuffix}`,
      minimumClearanceMeters: 4.88,
      axis: 'z',
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-glide-${idSuffix}`,
    platformLocalIds: [
      `glide-depart-${idSuffix}`,
      `glide-raft-${idSuffix}`,
      `glide-arrive-${idSuffix}`,
    ],
    lookFromPlatformLocalId: `glide-depart-${idSuffix}`,
    lookToPlatformLocalId: `glide-arrive-${idSuffix}`,
  }

  return {
    id: `chunk-glide-${idSuffix}`,
    kind: 'aurora-glide',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, gaps),
    cameraSection,
  }
}

/** Chunk 12: Diagonal Ferry Glide — kinematic moving raft traversing diagonally across an open chasm */
export function createDiagonalGlideChunk(
  idSuffix: string,
  angle: 'left-to-right' | 'right-to-left' = 'left-to-right',
): ProceduralChunk {
  const sign = angle === 'left-to-right' ? 1 : -1
  const startX = -sign * 0.9
  const raftStartX = -sign * 0.5
  const deltaX = sign * 1.4
  const endX = sign * 0.9

  const platforms: ChunkPlatform[] = [
    {
      localId: `diag-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: startX, y: 0, z: 0.36 },
    },
    {
      localId: `diag-raft-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: raftStartX, y: 0, z: 1.97 },
      behavior: {
        kind: 'glide',
        translation: { x: deltaX, y: 0.32, z: 2.4 },
        travelSeconds: 3.4,
        dwellSeconds: 1.2,
      },
    },
    {
      localId: `diag-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: endX, y: 0.32, z: 5.98 },
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-diag-${idSuffix}`,
    platformLocalIds: platforms.map((p) => p.localId),
    lookFromPlatformLocalId: platforms[0].localId,
    lookToPlatformLocalId: platforms[platforms.length - 1].localId,
  }

  return {
    id: `chunk-diag-glide-${idSuffix}`,
    kind: 'diagonal-glide',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection,
  }
}

/** Chunk 14: Sky Elevator Glide — 3D ascending/descending aurora ferry lifting across a cloud chasm */
export function createSkyElevatorGlideChunk(
  idSuffix: string,
  verticalDelta = 0.56,
): ProceduralChunk {
  const dy = Number(verticalDelta.toFixed(3))
  const platforms: ChunkPlatform[] = [
    {
      localId: `elev-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `elev-raft-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: 0, y: 0, z: 1.97 },
      behavior: {
        kind: 'glide',
        translation: { x: 0, y: dy, z: 2.4 },
        travelSeconds: 3.4,
        dwellSeconds: 1.3,
      },
    },
    {
      localId: `elev-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: dy, z: 5.98 },
    },
  ]

  return {
    id: `chunk-elevator-${idSuffix}`,
    kind: 'sky-elevator-glide',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection: {
      localId: `cam-elev-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}

/** Chunk 17: Frost-to-Raft Transfer — low-friction frost runway launching onto a diagonal aurora ferry and cracking landing stone */
export function createFrostRaftTransferChunk(
  idSuffix: string,
  warningSeconds = 1.5,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `frt-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `frt-frost1-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: -0.45, y: 0.08, z: 2.38 },
    },
    {
      localId: `frt-frost2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: -0.45, y: 0.16, z: 5.14 },
    },
    {
      localId: `frt-raft-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: -0.45, y: 0.24, z: 7.65 },
      behavior: {
        kind: 'glide',
        translation: { x: 0.9, y: 0.24, z: 2.2 },
        travelSeconds: 3.2,
        dwellSeconds: 1.2,
      },
    },
    {
      localId: `frt-hex-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0.45, y: 0.48, z: 11.92 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `frt-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.54, z: 13.5 },
    },
  ]

  return {
    id: `chunk-frost-raft-${idSuffix}`,
    kind: 'frost-raft-transfer',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection: {
      localId: `cam-frt-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}

/** Chunk 18: Twin Glide Crossing — counter-sweeping ferries with a stable ice landing for transfers. */
export function createTwinGlideCrossingChunk(
  idSuffix: string,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `tgc-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `tgc-raft1-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: -0.6, y: 0.08, z: 2.13 },
      behavior: {
        kind: 'glide',
        translation: { x: 1.2, y: 0.2, z: 1.8 },
        travelSeconds: 3.0,
        dwellSeconds: 1.1,
      },
    },
    {
      localId: `tgc-pivot-${idSuffix}`,
      // The ferries share a clock: the second is away when the first arrives.
      // Waiting here must survive a missed cycle, not demand a late jump from
      // the first ferry just as it reverses to beat a cracking-floor deadline.
      profileId: 'frost-lily',
      center: { x: 0.6, y: 0.28, z: 6.08 },
    },
    {
      localId: `tgc-raft2-${idSuffix}`,
      profileId: 'aurora-glide',
      center: { x: 0.6, y: 0.28, z: 8.23 },
      behavior: {
        kind: 'glide',
        translation: { x: -1.2, y: 0.2, z: 1.8 },
        travelSeconds: 3.0,
        dwellSeconds: 1.1,
      },
    },
    {
      localId: `tgc-arr1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.48, z: 11.8 },
    },
    {
      localId: `tgc-arr2-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.48, z: 12.52 },
    },
  ]

  return {
    id: `chunk-twin-glide-${idSuffix}`,
    kind: 'twin-glide-crossing',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection: {
      localId: `cam-tgc-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}
