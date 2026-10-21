// Modular procedural chunk exports grouped by traversal family.

export interface ChunkLibraryOptions {
  readonly seed: number
  readonly difficulty: 'gentle' | 'balanced' | 'virtuoso'
  readonly notePrefix: string
}

export {
  createArrivalChunk,
  createVocalSanctuaryChunk,
  createFinalePavilionChunk,
} from './chunk-courts.ts'
export type { VocalSanctuaryOptions } from './chunk-courts.ts'
export {
  createFrostGlissadeChunk,
  createHexCascadeChunk,
  createScrollBridgeChunk,
  createSlalomZigzagChunk,
} from './chunk-stepping.ts'
export {
  createArcedViaductChunk,
  createViaductSCurveChunk,
  createSplitForkChunk,
  createCrystalCrossroadsChunk,
} from './chunk-curves.ts'
export {
  createTerracedAscentChunk,
  createCascadingDropChunk,
  createCrackingSpiralChunk,
} from './chunk-elevation.ts'
export {
  createAuroraGlideChunk,
  createDiagonalGlideChunk,
  createSkyElevatorGlideChunk,
  createFrostRaftTransferChunk,
  createTwinGlideCrossingChunk,
} from './chunk-ferries.ts'
