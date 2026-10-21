// Straight and slalom stepping routes using frost, crumble and scroll platforms.

import { declarePearlButtJoins } from './chunk-envelopes.ts'
import { createChunkSocket, declareChunkRoute } from './chunk-routing.ts'
import type { ChunkCameraSection, ChunkGap, ChunkPlatform, ProceduralChunk, } from './contracts.ts'

/** Chunk 2: Frost Glissade — low friction ice runway requiring momentum hops */
export function createFrostGlissadeChunk(idSuffix: string): ProceduralChunk {
  // 3 frost-lily tiles (1.65m x 2.2m) with 0.60m gaps
  // Tile 1: center z = 1.40 (bounds: 0.30 to 2.50)
  // Gap 1: 0.60m -> Tile 2 bounds: 3.10 to 5.30 -> center z = 4.20
  // Gap 2: 0.60m -> Tile 3 bounds: 5.90 to 8.10 -> center z = 7.00
  // Exit edge: 8.10
  const platforms: ChunkPlatform[] = [
    {
      localId: `frost-1-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: 0, y: 0, z: 1.4 },
    },
    {
      localId: `frost-2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: 0, y: 0, z: 4.2 },
    },
    {
      localId: `frost-3-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: 0, y: 0, z: 7.0 },
    },
  ]

  const gaps: ChunkGap[] = [
    {
      localId: `gap-frost-1-${idSuffix}`,
      platformALocalId: `frost-1-${idSuffix}`,
      platformBLocalId: `frost-2-${idSuffix}`,
      minimumClearanceMeters: 0.58,
      axis: 'z',
    },
    {
      localId: `gap-frost-2-${idSuffix}`,
      platformALocalId: `frost-2-${idSuffix}`,
      platformBLocalId: `frost-3-${idSuffix}`,
      minimumClearanceMeters: 0.58,
      axis: 'z',
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-frost-${idSuffix}`,
    platformLocalIds: [
      `frost-1-${idSuffix}`,
      `frost-2-${idSuffix}`,
      `frost-3-${idSuffix}`,
    ],
    lookFromPlatformLocalId: `frost-1-${idSuffix}`,
    lookToPlatformLocalId: `frost-3-${idSuffix}`,
  }

  return {
    id: `chunk-frost-${idSuffix}`,
    kind: 'frost-glissade',
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

/** Chunk 3: Hex Crumble Cascade — timed cracking hexagon tiles */
export function createHexCascadeChunk(
  idSuffix: string,
  warningSeconds = 1.5,
): ProceduralChunk {
  // Hex platforms (1.969m width, 1.738m depth, half-depth 0.869m)
  // Step 1: center z = 1.25 (bounds: 0.381 to 2.119)
  // Gap 1: 0.662m -> Step 2 center z = 3.65 (bounds: 2.781 to 4.519)
  // Gap 2: 0.662m -> Step 3 center z = 6.05 (bounds: 5.181 to 6.919)
  // Exit edge: 7.30 (gap from Step 3: 0.381m)
  const platforms: ChunkPlatform[] = [
    {
      localId: `hex-1-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0, y: 0, z: 1.25 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `hex-2-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0, y: 0, z: 3.65 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `hex-3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0, y: 0, z: 6.05 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
  ]

  const gaps: ChunkGap[] = [
    {
      localId: `gap-hex-1-${idSuffix}`,
      platformALocalId: `hex-1-${idSuffix}`,
      platformBLocalId: `hex-2-${idSuffix}`,
      minimumClearanceMeters: 0.58,
      axis: 'z',
    },
    {
      localId: `gap-hex-2-${idSuffix}`,
      platformALocalId: `hex-2-${idSuffix}`,
      platformBLocalId: `hex-3-${idSuffix}`,
      minimumClearanceMeters: 0.58,
      axis: 'z',
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-hex-${idSuffix}`,
    platformLocalIds: [
      `hex-1-${idSuffix}`,
      `hex-2-${idSuffix}`,
      `hex-3-${idSuffix}`,
    ],
    lookFromPlatformLocalId: `hex-1-${idSuffix}`,
    lookToPlatformLocalId: `hex-3-${idSuffix}`,
  }

  return {
    id: `chunk-hex-${idSuffix}`,
    kind: 'hex-cascade',
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

/** Chunk 4: Scroll Bridge with Living Crystal Interior */
export function createScrollBridgeChunk(
  idSuffix: string,
  crystalPreset:
    | 'aurora-heart'
    | 'resonance-veins'
    | 'frost-roots' = 'aurora-heart',
): ProceduralChunk {
  // Gilt-scroll (2.206m x 2.206m, half-depth 1.103)
  // Center z = 1.403 (bounds: 0.30 to 2.506)
  const platforms: ChunkPlatform[] = [
    {
      localId: `scroll-${idSuffix}`,
      profileId: 'gilt-scroll',
      center: { x: 0, y: 0, z: 1.403 },
      quarterTurns: 1,
      behavior: {
        kind: 'scroll',
        minLengthRatio: 0.3,
        extendedSeconds: 4.5,
        retractedSeconds: 2.5,
        transitionSeconds: 1.2,
        initialState: 'extended',
      },
      crystalInterior: { preset: crystalPreset, seed: 20261006 },
    },
  ]

  return {
    id: `chunk-scroll-${idSuffix}`,
    kind: 'scroll-bridge',
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
      localId: `cam-scroll-${idSuffix}`,
      platformLocalIds: [`scroll-${idSuffix}`],
      lookFromPlatformLocalId: `scroll-${idSuffix}`,
      lookToPlatformLocalId: `scroll-${idSuffix}`,
    },
  }
}

/** Chunk 8: Slalom Zigzag Cascade — alternating diagonal stepping stones with rising contour */
export function createSlalomZigzagChunk(
  idSuffix: string,
  style: 'frost' | 'hex' | 'hybrid' = 'hybrid',
  warningSeconds = 1.5,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `slalom-dep-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `slalom-s1-${idSuffix}`,
      profileId: style === 'frost' ? 'frost-lily' : 'rose-hex-crumble',
      center: { x: -0.7, y: 0.12, z: 2.2 },
      behavior:
        style !== 'frost'
          ? {
              kind: 'crackle',
              warningSeconds,
              releaseSeconds: 0.4,
              resetSeconds: 2.2,
            }
          : undefined,
    },
    {
      localId: `slalom-s2-${idSuffix}`,
      profileId: style === 'hex' ? 'rose-hex-crumble' : 'frost-lily',
      center: { x: 0.7, y: 0.24, z: 4.8 },
      behavior:
        style === 'hex'
          ? {
              kind: 'crackle',
              warningSeconds,
              releaseSeconds: 0.4,
              resetSeconds: 2.2,
            }
          : undefined,
    },
    {
      localId: `slalom-s3-${idSuffix}`,
      profileId: style === 'frost' ? 'frost-lily' : 'rose-hex-crumble',
      center: { x: -0.7, y: 0.12, z: 7.4 },
      behavior:
        style !== 'frost'
          ? {
              kind: 'crackle',
              warningSeconds,
              releaseSeconds: 0.4,
              resetSeconds: 2.2,
            }
          : undefined,
    },
    {
      localId: `slalom-s4-${idSuffix}`,
      profileId: style === 'hex' ? 'rose-hex-crumble' : 'frost-lily',
      center: { x: 0.7, y: 0.24, z: 10.0 },
      behavior:
        style === 'hex'
          ? {
              kind: 'crackle',
              warningSeconds,
              releaseSeconds: 0.4,
              resetSeconds: 2.2,
            }
          : undefined,
    },
    {
      localId: `slalom-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.3, z: 11.84 },
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: `cam-slalom-${idSuffix}`,
    platformLocalIds: platforms.map((p) => p.localId),
    lookFromPlatformLocalId: platforms[0].localId,
    lookToPlatformLocalId: platforms[platforms.length - 1].localId,
  }

  return {
    id: `chunk-slalom-${idSuffix}`,
    kind: 'slalom-zigzag',
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
