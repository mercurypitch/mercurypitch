// Ascending, descending and spiral platform routes with declared elevation changes.

import { declarePearlButtJoins } from './chunk-envelopes.ts'
import { createChunkSocket, declareChunkRoute } from './chunk-routing.ts'
import type { ChunkPlatform, ProceduralChunk } from './contracts.ts'

/** Chunk 13: Terraced Ascent — 3D climbing marble stair and alternating amethyst/rose crackle tiers (+0.72m rise) */
export function createTerracedAscentChunk(
  idSuffix: string,
  warningSeconds = 1.5,
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    {
      localId: `asc-s1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.0, z: 0.36 },
    },
    {
      localId: `asc-s2-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.06, z: 1.26 },
    },
    {
      localId: `asc-s3-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.12, z: 2.16 },
    },
    {
      localId: `asc-amethyst-${idSuffix}`,
      profileId: 'amethyst-crackle',
      center: { x: -0.65, y: 0.3, z: 3.52 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `asc-rose-${idSuffix}`,
      profileId: 'rose-crackle',
      center: { x: 0.65, y: 0.48, z: 5.39 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `asc-top1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.66, z: 7.07 },
    },
    {
      localId: `asc-top2-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0.72, z: 7.97 },
    },
  ]

  return {
    id: `chunk-ascent-${idSuffix}`,
    kind: 'terraced-ascent',
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
      localId: `cam-ascent-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}

/** Chunk 15: Cascading Drop Corner — 90-degree turning 3D descending glissade (-0.60m drop) */
export function createCascadingDropChunk(
  idSuffix: string,
  turn: 'east' | 'west',
  warningSeconds = 1.6,
): ProceduralChunk {
  const sign = turn === 'east' ? 1 : -1
  const landingTurns = turn === 'east' ? 1 : 3

  const platforms: ChunkPlatform[] = [
    {
      localId: `drop-p1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `drop-p2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: 0, y: -0.24, z: 2.22 },
    },
    {
      localId: `drop-p3-${idSuffix}`,
      profileId: 'amethyst-crackle',
      center: { x: Number((sign * 0.85).toFixed(3)), y: -0.44, z: 4.35 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `drop-p4-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: Number((sign * 2.45).toFixed(3)), y: -0.6, z: 4.35 },
      quarterTurns: landingTurns,
    },
    {
      localId: `drop-p5-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: Number((sign * 3.17).toFixed(3)), y: -0.6, z: 4.35 },
      quarterTurns: landingTurns,
    },
  ]

  return {
    id: `chunk-drop-${idSuffix}`,
    kind: 'cascading-drop',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      turn,
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection: {
      localId: `cam-drop-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}

/** Chunk 19: Cracking Spiral Turnaround — 90-degree turning staircase combining amethyst/rose crackle tiles and frost runway */
export function createCrackingSpiralChunk(
  idSuffix: string,
  turn: 'east' | 'west',
  warningSeconds = 1.5,
  elevationDelta = 0.48,
): ProceduralChunk {
  const sign = turn === 'east' ? 1 : -1
  const landingTurns = turn === 'east' ? 1 : 3
  const y1 = Number((elevationDelta * 0.2).toFixed(3))
  const y2 = Number((elevationDelta * 0.4).toFixed(3))
  const y3 = Number((elevationDelta * 0.6).toFixed(3))
  const y4 = Number((elevationDelta * 0.8).toFixed(3))
  const y5 = Number(elevationDelta.toFixed(3))

  const platforms: ChunkPlatform[] = [
    {
      localId: `csp-p1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `csp-p2-${idSuffix}`,
      profileId: 'amethyst-crackle',
      center: { x: Number((sign * 0.65).toFixed(3)), y: y1, z: 2.02 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `csp-p3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: Number((sign * 1.95).toFixed(3)), y: y2, z: 3.98 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `csp-p4-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: Number((sign * 4.27).toFixed(3)), y: y3, z: 4.49 },
      quarterTurns: landingTurns,
    },
    {
      localId: `csp-p5-${idSuffix}`,
      profileId: 'rose-crackle',
      center: { x: Number((sign * 6.67).toFixed(3)), y: y4, z: 4.49 },
      behavior: {
        kind: 'crackle',
        warningSeconds,
        releaseSeconds: 0.4,
        resetSeconds: 2.2,
      },
    },
    {
      localId: `csp-p6-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: Number((sign * 8.33).toFixed(3)), y: y5, z: 4.49 },
      quarterTurns: landingTurns,
    },
  ]

  return {
    id: `chunk-spiral-${idSuffix}`,
    kind: 'cracking-spiral',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      turn,
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    cameraSection: {
      localId: `cam-csp-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}
