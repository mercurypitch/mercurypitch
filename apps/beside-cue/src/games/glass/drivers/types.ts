// ============================================================
// Interaction drivers — the controller layer (input-modes.md).
//
// A driver owns its input hardware and hands the runtime normalized
// intents. Two channels, matching how games consume input:
//   - continuous signals (a voice's pitch) are POLLED per tick;
//   - discrete events (a tap, an answer pick) are QUEUED, stamped with
//     the AUDIO clock (AudioContext.currentTime), never frame time —
//     the conductor rule: a beat judge must not depend on rAF jitter.
// The sing driver fills the first channel; tap/listen drivers add the
// second without the runtime changing shape.
// ============================================================

/** One reading of the continuous voice signal. */
export interface PitchSample {
  /** Fractional MIDI note of the detected pitch. */
  midi: number
  /** Input level 0..1 (drives the whisper mechanic). */
  rms: number
  /** Detector confidence 0..1 (already gated by the driver). */
  conf: number
  /** AudioContext.currentTime at capture — the conductor clock. */
  tAudio: number
}

/** A discrete input event (tap driver and listen driver, later). */
export interface DiscreteIntent {
  /** Pointer position in client coordinates (absent for key taps) —
   * listen mode hit-tests answers with it. */
  x?: number
  y?: number
  type: 'tap' | 'answer'
  /** AudioContext.currentTime at the moment of input. */
  tAudio: number
  /** Answer payload for listen mode. */
  choice?: number
}

export interface InteractionDriver {
  /** Acquire hardware and begin producing input. Throws when the
   * hardware is unavailable (the runtime shows its own error). */
  start(): Promise<void>
  /** Release everything. Safe to call twice. */
  stop(): void
  /** Latest continuous pitch, or null while unvoiced/low-confidence. */
  latestPitch(): PitchSample | null
  /** Latest input level regardless of voicing (0 when unavailable). */
  latestLevel(): number
  /** Drain queued discrete intents since the last call. */
  drainIntents(): DiscreteIntent[]
  /** The driver's audio context — shared with game sound output so the
   * stage hums through the same clock the input is stamped with. */
  ctx(): AudioContext | null
}
