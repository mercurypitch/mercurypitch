// ============================================================
// F0 worklet protocol — what the audio thread and the main thread agree on
// ============================================================
//
// Its own module so neither side imports the other: `pitch-f0-stream.ts` pulls
// in mic-level and mirror types that AudioWorkletGlobalScope cannot provide,
// and the worklet bundle must stay a leaf. Keep this file free of imports for
// the same reason.

/** Registered processor name; must match `registerProcessor` in the worklet. */
export const PITCH_F0_PROCESSOR = 'pitch-f0-processor'

/**
 * Render quanta between analysis passes.
 *
 * Six 128-sample quanta is 16 ms at 48 kHz — the hop the rAF loop used to
 * manage on a quiet machine, so the frame rate consumers were tuned against
 * (the mirror's dwell windows, the smoothing ring in pitch-f0-stream) is
 * unchanged. The difference is that this hop is counted on the audio clock and
 * therefore survives a busy renderer, a backgrounded tab, and four browsers
 * sharing four cores.
 */
export const PITCH_F0_HOP_QUANTA = 6

/** Detector settings handed to the processor through `processorOptions`. */
export interface PitchF0ProcessorOptions {
  bufferSize: number
  sensitivity: number
  minFrequency: number
  maxFrequency: number
  minAmplitude: number
  minConfidence: number
}

/** One analysed hop, posted from the audio thread. */
export interface PitchF0WorkletFrame {
  type: 'frame'
  /** Take this frame belongs to; 0 when no take is recording. */
  taskId: number
  /** Seconds since the take started, on the audio clock. */
  t: number
  f0: number
  conf: number
  rms: number
}

/**
 * Answer to a flush, posted after every frame that preceded it.
 *
 * A MessagePort delivers in order, so receiving this is proof that every hop
 * the audio thread had already analysed is now on the main thread. Draining a
 * take without that proof loses whatever the renderer had not got round to
 * receiving — measured at eight Playwright workers on four cores, a landing
 * came back with 43 of its 104 frames because the rest were still queued.
 */
export interface PitchF0WorkletFlushed {
  type: 'flushed'
  id: number
}

export type PitchF0WorkletMessage = PitchF0WorkletFrame | PitchF0WorkletFlushed

/** Start or end a take. The audio thread owns the take clock. */
export interface PitchF0RecordCommand {
  type: 'record'
  on: boolean
  taskId: number
  /**
   * How long the take has already been running when this arrives.
   *
   * Zero for a take that starts with the worklet already attached. It is not
   * zero when the worklet finishes loading part-way through one: the rAF
   * fallback has been stamping frames from the take's real start, and the
   * audio thread has to back-date its own origin to match or the two halves
   * of the take would both begin at t = 0.
   */
  startedSecondsAgo: number
}

/** Ask the audio thread to mark the end of the frames posted so far. */
export interface PitchF0FlushCommand {
  type: 'flush'
  id: number
}

export type PitchF0WorkletCommand = PitchF0RecordCommand | PitchF0FlushCommand
