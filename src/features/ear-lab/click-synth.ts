// ============================================================
// click-synth — sample-accurate clicks on the AudioContext clock.
//
// The Grid's click (the app's latency wizard has its own): it lives
// or dies on onset precision, so clicks are scheduled with
// osc.start(t) and a millisecond attack (sharp enough to hear as a
// point in time, no speaker pop), wired straight to ctx.destination
// past the engine's effects chain. Three voices, because the same
// onset can be a bright tick, a woodblock knock or a low, soft tap —
// and a 2 kHz tick at full level pierces on earbuds. Level is the
// caller's: the Ear Lab passes its stage volume times the app's.
//
// Scheduling returns a handle because a scheduled oscillator is
// already committed to the audio clock — clearing a setTimeout
// cannot unmake it. Stopping a drill mid-stimulus has to cancel
// the sound explicitly or the clicks keep coming after the user
// has left the screen.
// ============================================================

export type ClickVoice = 'tick' | 'wood' | 'soft'

interface VoiceSpec {
  type: OscillatorType
  hz: number
  /** Frequency at the end of the click, as a ratio of `hz` — the
   *  woodblock's knock drops in pitch as it dies. */
  fall: number
  /** Whole click, seconds. */
  lenS: number
  /** Onset ramp, seconds. Kept short: the Grid measures onsets. */
  attackS: number
  /** Peak level before the caller's gain. */
  peak: number
}

const VOICES: Record<ClickVoice, VoiceSpec> = {
  tick: {
    type: 'sine',
    hz: 2000,
    fall: 1,
    lenS: 0.03,
    attackS: 0.001,
    peak: 0.5,
  },
  wood: {
    type: 'triangle',
    hz: 1050,
    fall: 0.5,
    lenS: 0.05,
    attackS: 0.001,
    peak: 0.6,
  },
  soft: {
    type: 'sine',
    hz: 620,
    fall: 0.8,
    lenS: 0.06,
    attackS: 0.003,
    peak: 0.6,
  },
}

export interface ScheduledClick {
  /** Silence and tear down this click, whether or not it has
   *  started. Safe to call twice. */
  cancel: () => void
}

export function scheduleClick(
  ctx: AudioContext,
  at: number,
  options?: { voice?: ClickVoice; hz?: number; gainLevel?: number },
): ScheduledClick {
  const spec = VOICES[options?.voice ?? 'tick']
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = spec.type
  const hz = options?.hz ?? spec.hz
  osc.frequency.setValueAtTime(hz, at)
  if (spec.fall !== 1) {
    osc.frequency.exponentialRampToValueAtTime(hz * spec.fall, at + spec.lenS)
  }
  const peak = spec.peak * Math.max(0, Math.min(1, options?.gainLevel ?? 1))
  gain.gain.setValueAtTime(0, at)
  gain.gain.linearRampToValueAtTime(peak, at + spec.attackS)
  // A short hold, then a decay to nothing — one envelope shape for
  // every voice, so the onset is the only thing that differs.
  gain.gain.setValueAtTime(peak, at + spec.attackS + 0.004)
  gain.gain.linearRampToValueAtTime(0, at + spec.lenS)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(at)
  osc.stop(at + spec.lenS + 0.01)

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
