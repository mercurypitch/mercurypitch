// ============================================================
// Octave / gross-error corrector (Phase 1: temporal continuity snap).
//
// Suppresses the spurious octave jumps that wreck beginner vocal recordings
// (the C3 -> C4 -> C5 -> D3 artifact) while still allowing intentional,
// sustained octave leaps. Each frame is compared to a running reference: if
// the incoming pitch sits within `octaveBand` semitones of a whole-octave
// shift of the reference, it is snapped back into the reference octave —
// unless the shift persists for `confirmFrames`, in which case it is accepted
// as a genuine leap. Non-octave movement passes through untouched.
//
// (Phase 3 adds an HPS spectral arbiter to corroborate octaves from a single
// frame; this temporal version needs no spectrum.)
// ============================================================

const SEMITONES_PER_OCTAVE = 12

export interface OctaveCorrector {
  /** Correct a fractional-MIDI pitch for octave (sub/super-harmonic) errors. */
  correct(midi: number): number
  reset(): void
}

export interface OctaveCorrectorOptions {
  /**
   * How close (in semitones) a candidate must be to an exact octave of the
   * running reference to be treated as an octave error. Default 0.6.
   */
  octaveBand?: number
  /**
   * Consecutive frames an off-octave pitch must persist before it is accepted
   * as a real octave leap rather than a transient error. Default 3.
   */
  confirmFrames?: number
}

export function createOctaveCorrector(
  opts: OctaveCorrectorOptions = {},
): OctaveCorrector {
  const octaveBand = opts.octaveBand ?? 0.6
  const confirmFrames = Math.max(1, Math.floor(opts.confirmFrames ?? 3))

  let ref: number | null = null
  let pendingShift = 0
  let pendingCount = 0

  return {
    correct(midi: number): number {
      if (ref === null) {
        ref = midi
        return midi
      }

      const diff = midi - ref
      const octShift = Math.round(diff / SEMITONES_PER_OCTAVE)
      const residual = Math.abs(diff - octShift * SEMITONES_PER_OCTAVE)
      const isOctaveError = octShift !== 0 && residual <= octaveBand

      if (!isOctaveError) {
        // Genuine (non-octave) movement, or already aligned. Accept it.
        ref = midi
        pendingShift = 0
        pendingCount = 0
        return midi
      }

      // The pitch looks like an octave-shifted copy of the reference.
      if (octShift === pendingShift) {
        pendingCount++
      } else {
        pendingShift = octShift
        pendingCount = 1
      }

      if (pendingCount >= confirmFrames) {
        // Sustained — accept the octave leap.
        ref = midi
        pendingShift = 0
        pendingCount = 0
        return midi
      }

      // Transient octave error — snap back into the reference octave.
      const corrected = midi - octShift * SEMITONES_PER_OCTAVE
      ref = corrected
      return corrected
    },
    reset(): void {
      ref = null
      pendingShift = 0
      pendingCount = 0
    },
  }
}
