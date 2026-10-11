// ============================================================
// Voice trace buffer — the last few seconds of the sung line
// ============================================================
//
// Written once a frame by the session, read once a frame by the canvas.
// Plain and mutable on purpose: a signal per pitch frame would re-run every
// reader sixty times a second for a picture that redraws anyway.

export interface TraceSample {
  /** Seconds, on the session's clock. */
  readonly t: number
  /** Cents from the target, or null where the voice was silent. */
  readonly cents: number | null
  /**
   * The light filled on this frame: the hold engine's own band state, judged
   * on its smoothed centre, never on the raw pitch.
   */
  readonly filling: boolean
}

export class VoiceTraceBuffer {
  private samples: TraceSample[] = []

  constructor(private readonly keepSeconds = 5) {}

  push(t: number, cents: number | null, filling: boolean): void {
    this.samples.push({ t, cents, filling })
    const cutoff = t - this.keepSeconds
    let drop = 0
    while (drop < this.samples.length && this.samples[drop].t < cutoff) drop++
    if (drop > 0) this.samples.splice(0, drop)
  }

  clear(): void {
    this.samples = []
  }

  /** Every kept sample, oldest first. */
  all(): readonly TraceSample[] {
    return this.samples
  }
}
