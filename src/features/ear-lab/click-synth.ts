// ============================================================
// click-synth — sample-accurate clicks on the AudioContext clock.
//
// Shared by the latency wizard and The Grid: both live or die on
// onset precision, so clicks are scheduled with osc.start(t) and
// a 1 ms attack (sharp enough to detect, no speaker pop), wired
// straight to ctx.destination past the engine's effects chain.
//
// Scheduling returns a handle because a scheduled oscillator is
// already committed to the audio clock — clearing a setTimeout
// cannot unmake it. Stopping a drill mid-stimulus has to cancel
// the sound explicitly or the clicks keep coming after the user
// has left the screen.
// ============================================================

const CLICK_HZ = 2000
const CLICK_LEN_S = 0.03

export interface ScheduledClick {
  /** Silence and tear down this click, whether or not it has
   *  started. Safe to call twice. */
  cancel: () => void
}

export function scheduleClick(
  ctx: AudioContext,
  at: number,
  options?: { hz?: number; gainLevel?: number },
): ScheduledClick {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = options?.hz ?? CLICK_HZ
  const peak = options?.gainLevel ?? 0.9
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + 0.001)
  gain.gain.setValueAtTime(peak, at + CLICK_LEN_S - 0.005)
  gain.gain.linearRampToValueAtTime(0, at + CLICK_LEN_S)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + CLICK_LEN_S + 0.01)

  let cancelled = false
  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      try {
        // Drop the envelope to silence immediately, then stop: a
        // bare stop() on a click already sounding would click again
        // on the discontinuity.
        gain.gain.cancelScheduledValues(ctx.currentTime)
        gain.gain.setValueAtTime(0, ctx.currentTime)
        osc.stop(ctx.currentTime)
      } catch {
        // Already stopped by its own schedule — nothing to undo.
      }
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    },
  }
}
