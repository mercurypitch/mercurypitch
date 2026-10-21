// Curved and branching platform routes with explicit directed connections.

import { declarePearlButtJoins } from './chunk-envelopes.ts'
import { createChunkSocket, declareChunkRoute } from './chunk-routing.ts'
import type { ChunkCameraSection, ChunkPlatform, ProceduralChunk, } from './contracts.ts'

/** Chunk 9: Arced Viaduct — sweeping 90-degree 3D spiral causeway across the clouds */
export function createArcedViaductChunk(
  idSuffix: string,
  turn: 'east' | 'west',
  warningSeconds = 1.6,
  elevationDelta = 0.36,
): ProceduralChunk {
  const sign = turn === 'east' ? 1 : -1
  const landingTurns = turn === 'east' ? 1 : 3
  const y1 = Number((elevationDelta * 0.25).toFixed(3))
  const y2 = Number((elevationDelta * 0.5).toFixed(3))
  const y3 = Number((elevationDelta * 0.75).toFixed(3))
  const y4 = Number(elevationDelta.toFixed(3))

  const platforms: ChunkPlatform[] = [
    {
      localId: `arc-p1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `arc-p2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: Number((sign * 0.85).toFixed(3)), y: y1, z: 2.17 },
    },
    {
      localId: `arc-p3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: Number((sign * 2.45).toFixed(3)), y: y2, z: 4.49 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `arc-p4-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: Number((sign * 4.885).toFixed(3)), y: y3, z: 4.49 },
      quarterTurns: landingTurns,
    },
    {
      localId: `arc-p5-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: Number((sign * 6.7).toFixed(3)), y: y4, z: 4.49 },
      quarterTurns: landingTurns,
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-arc-${idSuffix}`,
    platformLocalIds: platforms.map((p) => p.localId),
    lookFromPlatformLocalId: platforms[0].localId,
    lookToPlatformLocalId: platforms[platforms.length - 1].localId,
  }

  return {
    id: `chunk-arc-${idSuffix}`,
    kind: 'viaduct-arc',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      turn,
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection,
  }
}

/** Chunk 10: Viaduct S-Curve — serpentine flowing ribbon path weaving laterally and vertically */
export function createViaductSCurveChunk(
  idSuffix: string,
  warningSeconds = 1.6,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `scurve-p1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `scurve-p2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: 0.8, y: 0.14, z: 2.1 },
    },
    {
      localId: `scurve-p3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 1.2, y: 0.28, z: 4.3 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `scurve-p4-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0.0, y: 0.14, z: 6.2 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `scurve-p5-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: -0.8, y: 0.28, z: 8.4 },
    },
    {
      localId: `scurve-p6-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0.0, y: 0.36, z: 10.22 },
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-scurve-${idSuffix}`,
    platformLocalIds: platforms.map((p) => p.localId),
    lookFromPlatformLocalId: platforms[0].localId,
    lookToPlatformLocalId: platforms[platforms.length - 1].localId,
  }

  return {
    id: `chunk-scurve-${idSuffix}`,
    kind: 'viaduct-s-curve',
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

/** Chunk 11: Split Fork Causeway — branching path with choice of high-speed frost or precision hexes */
export function createSplitForkChunk(idSuffix: string): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `fork-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    // Left lane: Frost runway
    {
      localId: `fork-frost-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: -1.0, y: 0.12, z: 2.1 },
    },
    // Right lane: Hex crumble stepping stones
    {
      localId: `fork-hex1-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 1.0, y: 0.1, z: 1.82 },
      behavior: {
        kind: 'crackle',
        warningSeconds: 1.6,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `fork-hex2-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 1.0, y: 0.2, z: 3.78 },
      behavior: {
        kind: 'crackle',
        warningSeconds: 1.6,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    // Arrival overlook
    {
      localId: `fork-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.24, z: 5.32 },
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-fork-${idSuffix}`,
    platformLocalIds: platforms.map((p) => p.localId),
    lookFromPlatformLocalId: platforms[0].localId,
    lookToPlatformLocalId: platforms[platforms.length - 1].localId,
  }

  return {
    id: `chunk-fork-${idSuffix}`,
    kind: 'split-fork',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(
      platforms,
      [],
      [
        [
          `fork-dep-${idSuffix}`,
          `fork-frost-${idSuffix}`,
          `fork-arr-${idSuffix}`,
        ],
        [
          `fork-dep-${idSuffix}`,
          `fork-hex1-${idSuffix}`,
          `fork-hex2-${idSuffix}`,
          `fork-arr-${idSuffix}`,
        ],
      ],
    ),
    cameraSection,
  }
}

/** Chunk 16: Crystal Crossroads — dual parallel frost & rose-crackle lanes converging onto a living-crystal scroll bridge */
export function createCrystalCrossroadsChunk(
  idSuffix: string,
  crystalPreset:
    | 'aurora-heart'
    | 'resonance-veins'
    | 'frost-roots' = 'resonance-veins',
  warningSeconds = 1.5,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `cross-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    // Left lane: frost runway + amethyst crackle
    {
      localId: `cross-frost-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: -1.35, y: 0.12, z: 2.3 },
    },
    {
      localId: `cross-amethyst-${idSuffix}`,
      profileId: 'amethyst-crackle',
      center: { x: -1.35, y: 0.24, z: 4.45 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    // Right lane: twin square rose-crackle stepping stones
    {
      localId: `cross-rose1-${idSuffix}`,
      profileId: 'rose-crackle',
      center: { x: 1.35, y: 0.12, z: 2.02 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `cross-rose2-${idSuffix}`,
      profileId: 'rose-crackle',
      center: { x: 1.35, y: 0.24, z: 4.18 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    // Convergence terrace
    {
      localId: `cross-mid-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.24, z: 5.86 },
    },
    // Living-crystal scroll bridge extending along Z (quarterTurns: 1)
    {
      localId: `cross-scroll-${idSuffix}`,
      profileId: 'gilt-scroll',
      center: { x: 0, y: 0.24, z: 7.66 },
      quarterTurns: 1,
      behavior: {
        kind: 'scroll',
        minLengthRatio: 0.3,
        extendedSeconds: 4.5,
        retractedSeconds: 2.5,
        transitionSeconds: 1.2,
        initialState: 'extended',
      },
      crystalInterior: { preset: crystalPreset, seed: 20261018 },
    },
    // Arrival terrace
    {
      localId: `cross-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.24, z: 9.46 },
    },
  ]

  return {
    id: `chunk-crossroads-${idSuffix}`,
    kind: 'crystal-crossroads',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(
      platforms,
      [],
      [
        [
          `cross-dep-${idSuffix}`,
          `cross-frost-${idSuffix}`,
          `cross-amethyst-${idSuffix}`,
          `cross-mid-${idSuffix}`,
        ],
        [
          `cross-dep-${idSuffix}`,
          `cross-rose1-${idSuffix}`,
          `cross-rose2-${idSuffix}`,
          `cross-mid-${idSuffix}`,
        ],
        [
          `cross-mid-${idSuffix}`,
          `cross-scroll-${idSuffix}`,
          `cross-arr-${idSuffix}`,
        ],
      ],
    ),
    cameraSection: {
      localId: `cam-crossroads-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}
