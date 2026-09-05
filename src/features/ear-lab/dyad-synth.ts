// ============================================================
// dyad-synth — two sines on the AudioContext clock, for Beat Hunt.
//
// A pair of tones at the same frequency sums coherently and comes
// out louder than a pair a few cents apart, whose sum swells and
// fades — so a unison built from two playTone calls would let the
// player pick the in-tune pair by loudness alone. Here each tone
// has its own gain and the second oscillator starts a little early,
// which sets a random phase between the two inside ±90°: the in-tune
// pair's level then varies from trial to trial, and the detuned
// pair's beat starts at a random point in its cycle. Level is the
// caller's, the way click-synth takes it, past the engine's chain.
// ============================================================

export interface ScheduledDyad {
  /** Silence and tear down both tones. Safe to call twice. */
  cancel: () => void
}

interface DyadOptions {
  hzA: number
  hzB: number
  /** Sounding length, seconds. */
  lenS: number
  /** The stage's level, 0..1. */
  gainLevel?: number
  /** Start offset of the second tone, seconds — its phase at `at`. */
  phaseS?: number
}

const ATTACK_S = 0.02
const RELEASE_S = 0.06
const PEAK = 0.26

/** A phase offset inside ±90°, in seconds, for a tone at `hz`. */
export function randomPhaseS(
  hz: number,
  random: () => number = Math.random,
): number {
  return ((random() - 0.5) * 0.5) / hz
}

export function scheduleDyad(
  ctx: AudioContext,
  at: number,
  options: DyadOptions,
): ScheduledDyad {
  const level = Math.max(0, Math.min(1, options.gainLevel ?? 1))
  const phaseS = Math.max(0, options.phaseS ?? 0)
  const voices = [
    { hz: options.hzA, startAt: at },
    // Started early under a closed gain: the waveform is already
    // `phaseS` into its cycle when the envelope opens.
    { hz: options.hzB, startAt: at - phaseS },
  ].map((voice) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(voice.hz, Math.max(0, voice.startAt))
    gain.gain.setValueAtTime(0, Math.max(0, voice.startAt))
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(PEAK * level, at + ATTACK_S)
    gain.gain.setValueAtTime(PEAK * level, at + options.lenS - RELEASE_S)
    gain.gain.linearRampToValueAtTime(0, at + options.lenS)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(Math.max(0, voice.startAt))
    osc.stop(at + options.lenS + 0.01)
    return { osc, gain }
  })

  let cancelled = false
  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      for (const { osc, gain } of voices) {
        try {
          // Anchor, then decay (docs/agent/MISTAKES.md, "Pop-free audio");
          // the source stops once the tail is inaudible.
          const now = ctx.currentTime
          gain.gain.cancelScheduledValues(now)
          gain.gain.setValueAtTime(gain.gain.value, now)
          gain.gain.setTargetAtTime(0, now, 0.012)
          osc.stop(now + 0.08)
        } catch {
          // Already stopped by its own schedule — nothing to undo.
        }
        osc.onended = () => {
          osc.disconnect()
          gain.disconnect()
        }
      }
    },
  }
}
