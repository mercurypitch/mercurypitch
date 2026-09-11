// The SwiftF0 detector now lives in @irchiinnuss/pitch-engine.
// This shim is left so the import sites did not have to move in the same
// change that collapsed the fork; the sweep that repoints them deletes it.

export {
  resampleLinear,
  SWIFTF0_SAMPLE_RATE,
  SwiftF0Detector,
} from '@irchiinnuss/pitch-engine/swift-f0-detector'
export type {
  MockOnnxModule,
  SwiftDetectorSettings,
  SwiftPitchResult,
  SwiftPitchTrack,
} from '@irchiinnuss/pitch-engine/swift-f0-detector'
