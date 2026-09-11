// The YIN/MPM/SwiftF0 detector now lives in @irchiinnuss/pitch-engine.
// This shim is left so the import sites did not have to move in the same
// change that collapsed the fork; the sweep that repoints them deletes it.

export { PitchDetector } from '@irchiinnuss/pitch-engine/pitch-detector'
export type {
  DetectedPitch,
  PitchAlgorithm,
  PitchDetectorOptions,
} from '@irchiinnuss/pitch-engine/pitch-detector'
