// ============================================================
// The guided range-finder's brain — pure and unit-tested.
//
// Two pieces: a steady-note detector (a hummed note that holds within
// tolSemis for holdMs locks), and the range fit — where the measured
// range's CENTER sits relative to the comfortable hum becomes the song
// bias, through the same `rangeBias` seam compileLevel already has.
// The UI (RangeFinder.tsx) only feeds pitch samples in and renders the
// steps; every decision lives here.
// ============================================================

export interface SteadyDetector {
  /** Feed one frame; `midi` null = silence. Returns the locked midi the
   * moment a note has held long enough, else null. Silence resets. */
  push(t: number, midi: number | null): number | null
  /** 0..1 progress toward the lock, for the hold bar. */
  progress(t: number): number
}

/** A note is "held" while every sample stays within tolSemis of the
 * run's anchor (the first sample after the last breach) — a slide into
 * the note simply re-anchors; the hold clock starts when the voice
 * settles. Locking returns the median of the run (wobble-proof). */
export const createSteadyDetector = (
  holdMs: number,
  tolSemis: number,
): SteadyDetector => {
  let run: { t: number; midi: number }[] = []
  return {
    push(t: number, midi: number | null): number | null {
      if (midi === null) {
        run = []
        return null
      }
      if (run.length > 0 && Math.abs(midi - run[0].midi) > tolSemis) {
        run = []
      }
      run.push({ t, midi })
      if (t - run[0].t < holdMs) return null
      const sorted = run.map((s) => s.midi).sort((a, b) => a - b)
      const locked = sorted[Math.floor(sorted.length / 2)]
      run = []
      return locked
    },
    progress(t: number): number {
      if (run.length === 0) return 0
      return Math.min(1, (t - run[0].t) / holdMs)
    },
  }
}

export interface RangeFit {
  /** Semitones songs should shift (the range setting): negative sits
   * them lower, positive higher. */
  biasSemis: number
  loMidi: number
  hiMidi: number
  comfyMidi: number
}

/** Songs center on the in-game hummed note; when the hum sits off the
 * measured range's center, the bias moves them back onto the voice. */
export const computeRangeFit = (
  comfyMidi: number,
  a: number,
  b: number,
  clampSemis: number,
): RangeFit => {
  const loMidi = Math.min(a, b)
  const hiMidi = Math.max(a, b)
  const center = (loMidi + hiMidi) / 2
  const raw = Math.round(center - comfyMidi)
  const biasSemis = Math.max(-clampSemis, Math.min(clampSemis, raw))
  return { biasSemis, loMidi, hiMidi, comfyMidi }
}
