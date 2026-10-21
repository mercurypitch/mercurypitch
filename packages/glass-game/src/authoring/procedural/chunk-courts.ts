// Stationary singing courts with explicit downstream exits and supported encounters.

import { proceduralCourtBarrierId } from '../../content/procedural-court-barriers.ts'
import { declarePearlButtJoins } from './chunk-envelopes.ts'
import { createChunkSocket, declareChunkRoute } from './chunk-routing.ts'
import type { ChunkCameraSection, ChunkCheckpoint, ChunkEncounter, ChunkPlatform, ProceduralChunk, } from './contracts.ts'

/** Chunk 1: Arrival Court — safe marble plaza with opening home tone */
export function createArrivalChunk(
  noteAnchorId = 'first-arc-home',
): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    { localId: 'arr-1', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0 } },
    {
      localId: 'arr-2',
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.72 },
    },
    {
      localId: 'arr-3',
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 1.44 },
    },
    {
      localId: 'arr-4',
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 2.16 },
    },
    {
      localId: 'arr-5',
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 2.88 },
    },
  ]

  const encounters: ChunkEncounter[] = [
    {
      localId: 'note-home',
      role: 'note',
      label: 'The First Tone',
      variant: 'resonance-rosebud-v1',
      position: { x: 0, y: 0, z: 1.44 },
      anchor: { x: 0, y: 0, z: 0.72 },
      noteAnchorId,
    },
  ]

  const checkpoints: ChunkCheckpoint[] = [
    {
      localId: 'save-arrival',
      position: { x: 0, y: 0, z: 0 },
      facingYaw: Math.PI,
      radius: 2.5,
    },
  ]

  const cameraSection: ChunkCameraSection = {
    localId: 'cam-arrival',
    platformLocalIds: ['arr-1', 'arr-2', 'arr-3', 'arr-4', 'arr-5'],
    lookFromPlatformLocalId: 'arr-1',
    lookToPlatformLocalId: 'arr-5',
  }

  return {
    id: 'chunk-arrival',
    kind: 'arrival',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    encounters,
    checkpoints,
    cameraSection,
  }
}

export interface VocalSanctuaryOptions {
  readonly barrierProfileId?:
    | 'frosted-scroll-wall'
    | 'frost-gold-arch-breakwall-a'
  readonly optionalAlcove?: {
    readonly variant: 'goblet' | 'coupe'
    readonly label: string
    readonly coinId: string
  }
}

/** Chunk 6: Vocal Sanctuary Gate — marble courtyard with clear singing anchor, barrier, and optional discovery alcove */
export function createVocalSanctuaryChunk(
  idSuffix: string,
  noteAnchorId: string,
  turn: 'none' | 'east' | 'west' = 'none',
  options?: VocalSanctuaryOptions,
): ProceduralChunk {
  // Ten-slab court keeps all straight and side exits downstream of the gate.
  const platforms: ChunkPlatform[] = [
    {
      localId: `sanc-1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `sanc-2-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 1.08 },
    },
    {
      localId: `sanc-3-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 1.8 },
    },
    {
      localId: `sanc-4-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 2.52 },
    },
    {
      localId: `sanc-5-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 3.24 },
    },
    {
      localId: `sanc-6-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 3.96 },
    },
  ]

  for (let i = 7; i <= 10; i++)
    platforms.push({
      localId: `sanc-${i}-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: Number((0.36 + (i - 1) * 0.72).toFixed(3)) },
    })

  const barrierProfileId = options?.barrierProfileId ?? 'frosted-scroll-wall'
  const barrierLabel =
    barrierProfileId === 'frost-gold-arch-breakwall-a'
      ? 'The Gilded Resonance Arch'
      : 'The Frosted Gate'

  // Barrier placed at z = 3.96, singing anchor placed at z = 1.80 (2.16m forward distance)
  const encounters: ChunkEncounter[] = [
    {
      localId: `gate-${idSuffix}`,
      role: 'gate',
      label: barrierLabel,
      variant: barrierProfileId,
      position: { x: 0, y: 0, z: 3.96 },
      anchor: { x: 0, y: 0, z: 1.8 },
      noteAnchorId,
      presentationBarrier: {
        profileId: proceduralCourtBarrierId(barrierProfileId),
        facingYaw: Math.PI,
      },
    },
  ]

  // Optional side-alcove wing placed on the side opposite any turn
  if (options?.optionalAlcove) {
    const alcoveSign = turn === 'east' ? -1 : 1
    platforms.push(
      {
        localId: `sanc-alcove-1-${idSuffix}`,
        profileId: 'pearl-rest',
        center: { x: Number((alcoveSign * 3.4).toFixed(3)), y: 0, z: 1.8 },
      },
      {
        localId: `sanc-alcove-2-${idSuffix}`,
        profileId: 'pearl-rest',
        center: { x: Number((alcoveSign * 3.4).toFixed(3)), y: 0, z: 2.52 },
      },
    )
    encounters.push({
      localId: `alcove-${idSuffix}`,
      role: 'optional-discovery',
      label: options.optionalAlcove.label,
      variant: options.optionalAlcove.variant,
      position: {
        x: Number((alcoveSign * 3.4).toFixed(3)),
        y: 0,
        z: 2.52,
      },
      anchor: {
        x: Number((alcoveSign * 2.75).toFixed(3)),
        y: 0,
        z: 1.8,
      },
      discoveryCoinIds: [options.optionalAlcove.coinId],
    })
  }

  const checkpoints: ChunkCheckpoint[] = [
    {
      localId: `save-sanc-${idSuffix}`,
      position: { x: 0, y: 0, z: 1.8 },
      facingYaw: Math.PI,
      radius: 2.2,
    },
  ]

  const exitFacing =
    turn === 'east' ? 'east' : turn === 'west' ? 'west' : 'north'

  return {
    id: `chunk-sanctuary-${idSuffix}`,
    kind: 'vocal-sanctuary',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket('exit', platforms[9]!, exitFacing),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(
      platforms,
      [],
      [
        platforms.slice(0, 10).map((p) => p.localId),
        ...(options?.optionalAlcove
          ? [
              [
                `sanc-3-${idSuffix}`,
                `sanc-alcove-1-${idSuffix}`,
                `sanc-alcove-2-${idSuffix}`,
                `sanc-4-${idSuffix}`,
              ],
            ]
          : []),
      ],
    ),
    encounters,
    checkpoints,
    cameraSection: {
      localId: `cam-sanctuary-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: `sanc-10-${idSuffix}`,
    },
  }
}

/** Chunk 7: Finale Pavilion — Awakened Muse whole-phrase portrait and exit boundary */
export function createFinalePavilionChunk(idSuffix: string): ProceduralChunk {
  // Wide pavilion of 8 pearl-rest slabs: z = 0.0 to 5.76
  const platforms: ChunkPlatform[] = [
    {
      localId: `pav-1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `pav-2-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 1.08 },
    },
    {
      localId: `pav-3-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 1.8 },
    },
    {
      localId: `pav-4-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 2.52 },
    },
    {
      localId: `pav-5-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 3.24 },
    },
    {
      localId: `pav-6-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 3.96 },
    },
    {
      localId: `pav-7-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 4.68 },
    },
    {
      localId: `pav-8-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 5.4 },
    },
  ]

  const encounters: ChunkEncounter[] = [
    {
      localId: `portrait-finale-${idSuffix}`,
      role: 'finale',
      label: 'The Awakening Muse',
      variant: 'portrait-awakened-muse',
      position: { x: 0, y: 0, z: 4.68 },
      anchor: { x: 0, y: 0, z: 3.24 },
    },
  ]

  const checkpoints: ChunkCheckpoint[] = [
    {
      localId: `save-finale-${idSuffix}`,
      position: { x: 0, y: 0, z: 1.8 },
      facingYaw: Math.PI,
      radius: 2.5,
    },
  ]

  return {
    id: `chunk-finale-${idSuffix}`,
    kind: 'finale',
    entrySocket: createChunkSocket('entry', platforms[0]!, 'north'),
    exitSocket: createChunkSocket(
      'exit',
      platforms[platforms.length - 1]!,
      'north',
    ),
    platforms,
    joins: declarePearlButtJoins(platforms),
    gaps: declareChunkRoute(platforms, []),
    encounters,
    checkpoints,
    cameraSection: {
      localId: `cam-finale-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
    localExit: {
      minX: -0.8,
      maxX: 0.8,
      minZ: 5.3,
      maxZ: 5.66,
      top: 0,
    },
  }
}
