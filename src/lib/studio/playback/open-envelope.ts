// ============================================================
// Studio run opening — a run's envelope opens from silence over 10 ms, a raised cosine
// ============================================================
//
// A run that starts from silence (Play, a seek from a stop) and a lane that
// comes back into the mix (lane-idle.ts) open over the same curve. A leaf of
// the playback modules, so both can use it without importing each other.

/** The attack when a run starts from silence: 10 ms, a raised cosine. */
export const RUN_OPEN_SECONDS = 0.01

/**
 * Straight segments drawing the raised cosine. Each corner splatters: on a
 * full-scale 41 to 110 Hz sine opened at its peak, 8 segments leave -57 dBFS
 * above 1 kHz, 32 leave -69 and 64 leave -74, where the 90 ms exponential
 * this replaced left -52 to -60 and took 45 ms to reach -40 dB.
 */
const OPEN_SEGMENTS = 64

/**
 * Open a run's envelope from silence at `time`: sin² over 10 ms, flat at both
 * ends, so the first sound is not held back behind a long attack.
 */
export function openRunEnvelope(envelope: GainNode, time: number): number {
  const gain = envelope.gain
  gain.value = 0
  gain.setValueAtTime(0, time)
  for (let i = 1; i <= OPEN_SEGMENTS; i++) {
    const x = i / OPEN_SEGMENTS
    gain.linearRampToValueAtTime(
      Math.sin((Math.PI / 2) * x) ** 2,
      time + RUN_OPEN_SECONDS * x,
    )
  }
  return time + RUN_OPEN_SECONDS
}
