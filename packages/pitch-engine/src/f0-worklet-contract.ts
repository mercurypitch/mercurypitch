// What the audio thread, the detector worker and the main thread agree on.
// ============================================================
//
// Three threads have to describe the same window of the singer's voice to
// each other. Keeping the shape and the two sizes in one module means a
// change to the hop cannot silently disagree with the smoothing that was
// derived from it, and it lets the stream import the contract without
// importing the worklet — importing the worklet on the main thread would
// call `registerProcessor`, which does not exist there.

/** The processor's registered name, used on both sides of `addModule`. */
export const F0_CAPTURE_PROCESSOR = 'f0-capture-processor'

/** Analysis window, matching the detector's configured buffer size. */
export const F0_WINDOW = 2048

/**
 * Samples between window starts. 1024 at 48 kHz is a 21 ms hop under a
 * 43 ms window, so consecutive windows overlap by half and no audio is
 * ever skipped — which is precisely what the frame loop could not
 * promise.
 */
export const F0_HOP = 1024

/** What the worklet posts for every window it completes. */
export interface F0CaptureMessage {
  /** The analysis window, transferred rather than copied. */
  samples: Float32Array
  /** Audio-clock frame index of the window's last sample. */
  atFrame: number
  /** RMS of the window, 0..1. */
  rms: number
}

/** What the main thread asks the detector worker to do. */
export type F0WorkerRequest =
  | {
      kind: 'configure'
      sampleRate: number
      minFrequency: number
      maxFrequency: number
      minAmplitude: number
    }
  | { kind: 'reset' }
  | { kind: 'window'; samples: Float32Array; atFrame: number; rms: number }

/** What the detector worker answers with, one per window. */
export interface F0WorkerResult {
  atFrame: number
  rms: number
  f0: number
  conf: number
}
