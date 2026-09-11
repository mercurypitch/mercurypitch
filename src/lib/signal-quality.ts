// The signal-quality window now lives in @irchiinnuss/pitch-engine, next to
// the detector that feeds it: a second copy here would be a second ring
// buffer, and the advisor would read one while the detector wrote the other.
// This shim is left so the import sites did not have to move in the same
// change that collapsed the fork; the sweep that repoints them deletes it.

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
} from '@irchiinnuss/pitch-engine/signal-quality'
export type {
  DetectionFrameStats,
  SignalQualitySnapshot,
  SignalQualityVerdict,
} from '@irchiinnuss/pitch-engine/signal-quality'
