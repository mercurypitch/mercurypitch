/** @irchiinnuss/pitch-engine — mic lifecycle + SwiftF0 pitch stream.
 *
 * Modules are verbatim extractions from the root app's src/lib (see each
 * file header); this package is the source of truth for products that need
 * voice input outside the root app, starting with Beside Cue's mini-games.
 *
 * Single modules are also reachable by subpath (`/pitch-detector`, `/assets`,
 * ...). A consumer that needs only the detector should use one: importing this
 * barrel for it pulls the mic manager and the f0 worker into that graph too,
 * which is dead weight in a page and wrong in a worker.
 */

export {
  CDN_FALLBACK,
  configurePitchEngineAssets,
  configureWasmPaths,
  DEFAULT_MODEL_PATH,
  getValidatedWasmBase,
  pitchEngineModelPath,
} from './assets'
export type { PitchEngineAssetConfig } from './assets'
export { playApproachAndLock, playHoldTone, playTargetHum } from './demo-audio'
export { freqToMidi, freqToNote, midiToFreq, midiToNote } from './freq-note'
export type { NoteInfo, NoteName } from './freq-note'
export {
  CONF_MIN,
  centsToMidi,
  hzToCents,
  medianFilter,
  preprocessF0Frames,
} from './measurements'
export type { F0Frame, VoicedFrame } from './measurements'
export { micLevelFraction, readMicLevel } from './mic-level'
export type { MicError, MicErrorKind } from './mic-manager'
export { listAudioInputs, listAudioOutputs, micManager } from './mic-manager'
export { createF0Stream } from './pitch-f0-stream'
export type { F0Stream, PitchFrame } from './pitch-f0-stream'
export {
  midiToNoteName,
  midiToNoteNameOctave,
  NOTE_NAMES,
  noteColor,
} from './note-utils'
export { PitchDetector } from './pitch-detector'
export type {
  DetectedPitch,
  PitchAlgorithm,
  PitchDetectorOptions,
} from './pitch-detector'
export {
  adjustedThreshold,
  mpmPickThreshold,
  parabolicInterpolation,
  parabolicInterpolationMax,
} from './pitch-detector-internals'
export {
  BLIP_MAX_FRAMES,
  CLEAN_RESET_MS,
  classifySignalQuality,
  CROWDED_MARGIN,
  CROWDED_SHARE,
  GATE_HEADROOM,
  MIN_ACCEPTED_FOR_CROWDING,
  MIN_BLIP_RUNS,
  MIN_REJECTED_FRAMES,
  publishDetectionFrame,
  readSignalQuality,
  resetSignalQuality,
  SIGNAL_BUCKET_MS,
  SIGNAL_WINDOW_MS,
} from './signal-quality'
export type {
  DetectionFrameStats,
  SignalQualitySnapshot,
  SignalQualityVerdict,
} from './signal-quality'
export {
  resampleLinear,
  SWIFTF0_SAMPLE_RATE,
  SwiftF0Detector,
} from './swift-f0-detector'
export type {
  MockOnnxModule,
  SwiftDetectorSettings,
  SwiftPitchResult,
  SwiftPitchTrack,
} from './swift-f0-detector'
