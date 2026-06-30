// ============================================================
// Shared types for the vocal pitch denoise + note-segmentation pipeline.
//
// All internal pitch math is done in fractional MIDI (semitone) units — never
// Hz — so an octave is a uniform +/-12 step and median / hysteresis behave
// symmetrically around a note. Hz is reconstructed only at the edges.
// ============================================================

/** A note produced by the live pipeline, in beat coordinates. */
export interface CompletedNote {
  /** Quantized integer MIDI note number. */
  midi: number
  /** Note start, in beats. */
  startBeat: number
  /** Note end, in beats. */
  endBeat: number
}

/** The note currently being held (boundary not yet committed). */
export interface OpenNote {
  midi: number
  startBeat: number
}

/** Result of feeding one realtime frame to the live pipeline. */
export interface LiveFrameResult {
  /** Notes whose boundary was committed on THIS frame (0 or 1 in practice). */
  completed: CompletedNote[]
  /** The note currently being held, or null when silent. For live preview. */
  open: OpenNote | null
  /**
   * Smoothed pitch (fractional MIDI) for the low-latency needle, or null when
   * unvoiced. This is the fast path — never debounced.
   */
  smoothedMidi: number | null
}
