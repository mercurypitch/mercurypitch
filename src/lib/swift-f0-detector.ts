// The SwiftF0 detector now lives in @irchiinnuss/pitch-engine.
// This shim is left so the import sites did not have to move in the same
// change that collapsed the fork; the sweep that repoints them deletes it.

// For its side effect: it configures the engine's asset locations in
// whichever module graph this shim is evaluated in (see that file).
import './pitch-engine-assets'

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
