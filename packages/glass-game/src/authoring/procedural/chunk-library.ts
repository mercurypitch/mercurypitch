// Certified modular chunk library for procedural Cloudway courses.
// All dimensions and clearances are calibrated against certified catalog profiles.

import type {
  ChunkCameraSection,
  ChunkCheckpoint,
  ChunkEncounter,
  ChunkGap,
  ChunkPlatform,
  ProceduralChunk,
} from './contracts.ts'

export interface ChunkLibraryOptions {
  readonly seed: number
  readonly difficulty: 'gentle' | 'balanced' | 'virtuoso'
  readonly notePrefix: string
}

/** Chunk 1: Arrival Court — safe marble plaza with opening home tone */
export function createArrivalChunk(noteAnchorId = 'first-arc-home'): ProceduralChunk {
  const platforms: ChunkPlatform[] = [
    { localId: 'arr-1', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0 } },
    { localId: 'arr-2', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0.72 } },
    { localId: 'arr-3', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 1.44 } },
    { localId: 'arr-4', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 2.16 } },
    { localId: 'arr-5', profileId: 'pearl-rest', center: { x: 0, y: 0, z: 2.88 } },
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
    { localId: 'save-arrival', position: { x: 0, y: 0, z: 0 }, facingYaw: Math.PI, radius: 2.5 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: -0.36 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 3.24 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    encounters,
    checkpoints,
    cameraSection,
  }
}

/** Chunk 2: Frost Glissade — low friction ice runway requiring momentum hops */
export function createFrostGlissadeChunk(idSuffix: string): ProceduralChunk {
  // 3 frost-lily tiles (1.65m x 2.2m) with 0.60m gaps
  // Tile 1: center z = 1.40 (bounds: 0.30 to 2.50)
  // Gap 1: 0.60m -> Tile 2 bounds: 3.10 to 5.30 -> center z = 4.20
  // Gap 2: 0.60m -> Tile 3 bounds: 5.90 to 8.10 -> center z = 7.00
  // Exit edge: 8.10
  const platforms: ChunkPlatform[] = [
    { localId: `frost-1-${idSuffix}`, profileId: 'frost-lily', center: { x: 0, y: 0, z: 1.4 } },
    { localId: `frost-2-${idSuffix}`, profileId: 'frost-lily', center: { x: 0, y: 0, z: 4.2 } },
    { localId: `frost-3-${idSuffix}`, profileId: 'frost-lily', center: { x: 0, y: 0, z: 7.0 } },
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
    platformLocalIds: [`frost-1-${idSuffix}`, `frost-2-${idSuffix}`, `frost-3-${idSuffix}`],
    lookFromPlatformLocalId: `frost-1-${idSuffix}`,
    lookToPlatformLocalId: `frost-3-${idSuffix}`,
  }

  return {
    id: `chunk-frost-${idSuffix}`,
    kind: 'frost-glissade',
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.3 },
      facing: 'north',
      width: 1.65,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 8.1 },
      facing: 'north',
      width: 1.65,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps,
    cameraSection,
  }
}

/** Chunk 3: Hex Crumble Cascade — timed cracking hexagon tiles */
export function createHexCascadeChunk(idSuffix: string, warningSeconds = 1.5): ProceduralChunk {
  // Hex platforms (1.64m diameter, bounds half-depth 0.82)
  // Step 1: center z = 1.12 (bounds 0.30 to 1.94)
  // Gap: 0.60m -> Step 2 bounds 2.54 to 4.18 -> center z = 3.36
  // Gap: 0.60m -> Step 3 bounds 4.78 to 6.42 -> center z = 5.60
  const platforms: ChunkPlatform[] = [
    {
      localId: `hex-1-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 0, y: 0, z: 1.12 },
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
      center: { x: 0, y: 0, z: 3.36 },
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
      center: { x: 0, y: 0, z: 5.6 },
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
    platformLocalIds: [`hex-1-${idSuffix}`, `hex-2-${idSuffix}`, `hex-3-${idSuffix}`],
    lookFromPlatformLocalId: `hex-1-${idSuffix}`,
    lookToPlatformLocalId: `hex-3-${idSuffix}`,
  }

  return {
    id: `chunk-hex-${idSuffix}`,
    kind: 'hex-cascade',
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.3 },
      facing: 'north',
      width: 1.64,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 6.42 },
      facing: 'north',
      width: 1.64,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps,
    cameraSection,
  }
}

/** Chunk 4: Scroll Bridge with Living Crystal Interior */
export function createScrollBridgeChunk(
  idSuffix: string,
  crystalPreset: 'aurora-heart' | 'resonance-veins' | 'frost-roots' = 'aurora-heart',
): ProceduralChunk {
  // Gilt-scroll (2.206m x 2.206m, half-depth 1.103)
  // Center z = 1.403 (bounds: 0.30 to 2.506)
  const platforms: ChunkPlatform[] = [
    {
      localId: `scroll-${idSuffix}`,
      profileId: 'gilt-scroll',
      center: { x: 0, y: 0, z: 1.403 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.3 },
      facing: 'north',
      width: 2.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 2.506 },
      facing: 'north',
      width: 2.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    cameraSection: {
      localId: `cam-scroll-${idSuffix}`,
      platformLocalIds: [`scroll-${idSuffix}`],
      lookFromPlatformLocalId: `scroll-${idSuffix}`,
      lookToPlatformLocalId: `scroll-${idSuffix}`,
    },
  }
}

/** Chunk 5: Aurora Glide Chasm — moving ferry with guaranteed 0-collision clearance */
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
    { localId: `glide-depart-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0.36 } },
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
    { localId: `glide-arrive-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 5.98 } },
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
    platformLocalIds: [`glide-depart-${idSuffix}`, `glide-raft-${idSuffix}`, `glide-arrive-${idSuffix}`],
    lookFromPlatformLocalId: `glide-depart-${idSuffix}`,
    lookToPlatformLocalId: `glide-arrive-${idSuffix}`,
  }

  return {
    id: `chunk-glide-${idSuffix}`,
    kind: 'aurora-glide',
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 6.34 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps,
    cameraSection,
  }
}

/** Chunk 6: Vocal Sanctuary Gate — marble courtyard with clear singing anchor and frosted gate */
export function createVocalSanctuaryChunk(
  idSuffix: string,
  noteAnchorId: string,
  turn: 'none' | 'east' | 'west' = 'none',
): ProceduralChunk {
  // Courtyard of 6 pearl-rest slabs: bounds z = 0.0 to 4.32
  const platforms: ChunkPlatform[] = [
    { localId: `sanc-1-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0.36 } },
    { localId: `sanc-2-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 1.08 } },
    { localId: `sanc-3-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 1.8 } },
    { localId: `sanc-4-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 2.52 } },
    { localId: `sanc-5-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 3.24 } },
    { localId: `sanc-6-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 3.96 } },
  ]

  // Barrier placed at z = 3.96, singing anchor placed at z = 1.80 (2.16m forward distance)
  const encounters: ChunkEncounter[] = [
    {
      localId: `gate-${idSuffix}`,
      role: 'gate',
      label: 'The Frosted Gate',
      variant: 'frosted-scroll-wall',
      position: { x: 0, y: 0, z: 3.96 },
      anchor: { x: 0, y: 0, z: 1.8 },
      noteAnchorId,
      presentationBarrier: {
        profileId: 'frosted-scroll-wall',
        facingYaw: Math.PI,
      },
    },
  ]

  const checkpoints: ChunkCheckpoint[] = [
    { localId: `save-sanc-${idSuffix}`, position: { x: 0, y: 0, z: 1.8 }, facingYaw: Math.PI, radius: 2.2 },
  ]

  const exitFacing = turn === 'east' ? 'east' : turn === 'west' ? 'west' : 'north'
  const exitPos =
    turn === 'east'
      ? { x: 1.6, y: 0, z: 3.96 }
      : turn === 'west'
        ? { x: -1.6, y: 0, z: 3.96 }
        : { x: 0, y: 0, z: 4.32 }

  return {
    id: `chunk-sanctuary-${idSuffix}`,
    kind: 'vocal-sanctuary',
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: exitPos,
      facing: exitFacing,
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    encounters,
    checkpoints,
    cameraSection: {
      localId: `cam-sanctuary-${idSuffix}`,
      platformLocalIds: platforms.map((p) => p.localId),
      lookFromPlatformLocalId: platforms[0].localId,
      lookToPlatformLocalId: platforms[platforms.length - 1].localId,
    },
  }
}

/** Chunk 7: Finale Pavilion — Awakened Muse whole-phrase portrait and exit boundary */
export function createFinalePavilionChunk(idSuffix: string): ProceduralChunk {
  // Wide pavilion of 8 pearl-rest slabs: z = 0.0 to 5.76
  const platforms: ChunkPlatform[] = [
    { localId: `pav-1-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 0.36 } },
    { localId: `pav-2-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 1.08 } },
    { localId: `pav-3-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 1.8 } },
    { localId: `pav-4-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 2.52 } },
    { localId: `pav-5-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 3.24 } },
    { localId: `pav-6-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 3.96 } },
    { localId: `pav-7-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 4.68 } },
    { localId: `pav-8-${idSuffix}`, profileId: 'pearl-rest', center: { x: 0, y: 0, z: 5.4 } },
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
    { localId: `save-finale-${idSuffix}`, position: { x: 0, y: 0, z: 1.8 }, facingYaw: Math.PI, radius: 2.5 },
  ]

  return {
    id: `chunk-finale-${idSuffix}`,
    kind: 'finale',
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 5.76 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
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

/** Chunk 8: Slalom Zigzag Cascade — alternating diagonal stepping stones requiring directional jumping */
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
      center: { x: -0.7, y: 0, z: 2.09 },
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
      center: { x: 0.7, y: 0, z: 4.28 },
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
      center: { x: -0.7, y: 0, z: 6.47 },
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
      center: { x: 0.7, y: 0, z: 8.66 },
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
      center: { x: 0, y: 0, z: 10.39 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 10.75 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    cameraSection,
  }
}

/** Chunk 9: Arced Viaduct — sweeping 90-degree curved causeway across the clouds */
export function createArcedViaductChunk(
  idSuffix: string,
  turn: 'east' | 'west',
  warningSeconds = 1.6,
): ProceduralChunk {
  const sign = turn === 'east' ? 1 : -1
  const landingTurns = turn === 'east' ? 1 : 3

  const platforms: ChunkPlatform[] = [
    {
      localId: `arc-p1-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0, y: 0, z: 0.36 },
    },
    {
      localId: `arc-p2-${idSuffix}`,
      profileId: 'frost-lily',
      center: { x: Number((sign * 0.65).toFixed(3)), y: 0, z: 1.9 },
    },
    {
      localId: `arc-p3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: Number((sign * 1.9).toFixed(3)), y: 0, z: 3.1 },
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
      center: { x: Number((sign * 3.35).toFixed(3)), y: 0, z: 3.75 },
    },
    {
      localId: `arc-p5-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: Number((sign * 4.65).toFixed(3)), y: 0, z: 3.75 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: Number((sign * 5.01).toFixed(3)), y: 0, z: 3.75 },
      facing: turn,
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    cameraSection,
  }
}

/** Chunk 10: Viaduct S-Curve — serpentine flowing ribbon path weaving laterally */
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
      center: { x: 0.8, y: 0, z: 2.1 },
    },
    {
      localId: `scurve-p3-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 1.2, y: 0, z: 4.3 },
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
      center: { x: 0.0, y: 0, z: 6.2 },
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
      center: { x: -0.8, y: 0, z: 8.4 },
    },
    {
      localId: `scurve-p6-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: 0.0, y: 0, z: 10.22 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 10.58 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
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
      center: { x: -1.0, y: 0, z: 2.1 },
    },
    // Right lane: Hex crumble stepping stones
    {
      localId: `fork-hex1-${idSuffix}`,
      profileId: 'rose-hex-crumble',
      center: { x: 1.0, y: 0, z: 1.82 },
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
      center: { x: 1.0, y: 0, z: 3.56 },
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
      center: { x: 0, y: 0, z: 5.1 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: 0, y: 0, z: 5.46 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
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
        translation: { x: deltaX, y: 0, z: 2.4 },
        travelSeconds: 3.4,
        dwellSeconds: 1.2,
      },
    },
    {
      localId: `diag-arr-${idSuffix}`,
      profileId: 'pearl-rest',
      center: { x: endX, y: 0, z: 5.98 },
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
    entrySocket: {
      id: 'entry',
      position: { x: 0, y: 0, z: 0.0 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    exitSocket: {
      id: 'exit',
      position: { x: endX, y: 0, z: 6.34 },
      facing: 'north',
      width: 3.2,
      clearanceMargin: 0.6,
    },
    platforms,
    gaps: [],
    cameraSection,
  }
}

