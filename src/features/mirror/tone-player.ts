// ============================================================
// Voice Mirror — reference tone playback for the match task.
//
// Tiny oscillator player on the mirror's own AudioContext. The
// main app's AudioEngine has richer tone playback, but pulling it
// in would drag the whole engine into the mirror bundle; the
// match task only needs a clean 1 s reference tone
// (reference-then-record, never simultaneous — §2 Task C).
// ============================================================

import { midiToFrequency } from '@/lib/frequency-to-note'

// A small stack of harmonics with quickly-falling amplitudes reads warm and
// instrument-like (closer to a soft electric piano) rather than the buzzy bare
// oscillator, and stays easy to match by ear. Index 0 is the DC term (must be
// 0). Built once per AudioContext — a PeriodicWave is bound to its context.
const PIANO_PARTIALS = [0, 1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04]
const waveCache = new WeakMap<AudioContext, PeriodicWave>()

function pianoWave(audioContext: AudioContext): PeriodicWave {
  const cached = waveCache.get(audioContext)
  if (cached) return cached
  const imag = new Float32Array(PIANO_PARTIALS)
  const real = new Float32Array(imag.length) // no cosine terms
  const wave = audioContext.createPeriodicWave(real, imag, {
    disableNormalization: false,
  })
  waveCache.set(audioContext, wave)
  return wave
}

/** Play a soft, piano-like reference tone and resolve when it has decayed. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
): Promise<void> {
  // iOS can auto-suspend the context between tasks; a suspended context
  // would never fire osc.onended and the guided flow would hang on it.
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined)
  }
  return new Promise((resolve) => {
    let settled = false
    const settle = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
    // Safety net for the same reason: resolve even if playback never runs.
    const fallback = setTimeout(settle, (durationSec + 0.5) * 1000)

    const osc = audioContext.createOscillator()
    const filter = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime
    const peak = 0.32

    osc.setPeriodicWave(pianoWave(audioContext))
    osc.frequency.value = midiToFrequency(midi)

    // Roll off the upper partials so the tone is warm, not harsh/buzzy.
    filter.type = 'lowpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.6

    // Soft attack, a gentle "bloom" settle, a steady sustain (easy to match),
    // then a clean release — no click at either edge.
    const sustainAt = Math.max(now + 0.17, now + durationSec - 0.14)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(peak, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(peak * 0.8, now + 0.16)
    gain.gain.setValueAtTime(peak * 0.8, sustainAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(audioContext.destination)
    osc.onended = () => {
      clearTimeout(fallback)
      osc.disconnect()
      filter.disconnect()
      gain.disconnect()
      settle()
    }
    osc.start(now)
    osc.stop(now + durationSec)
  })
}
