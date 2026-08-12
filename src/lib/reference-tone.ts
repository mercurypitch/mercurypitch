// ============================================================
// Reference Tone — lightweight, shared authored-note playback
// ============================================================
//
// Guided microphone tasks use this small Web Audio player when they need a
// clear pitch cue without pulling the full application audio engine into the
// feature bundle.

import { midiToFrequency } from '@/lib/frequency-to-note'

const PIANO_PARTIALS = [0, 1, 0.55, 0.32, 0.2, 0.12, 0.07, 0.04]
const waveCache = new WeakMap<AudioContext, PeriodicWave>()

function pianoWave(audioContext: AudioContext): PeriodicWave {
  const cached = waveCache.get(audioContext)
  if (cached) return cached

  const imag = new Float32Array(PIANO_PARTIALS)
  const real = new Float32Array(imag.length)
  const wave = audioContext.createPeriodicWave(real, imag, {
    disableNormalization: false,
  })
  waveCache.set(audioContext, wave)
  return wave
}

/** Play a soft, piano-like reference tone and resolve after its release. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
): Promise<void> {
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
    const fallback = setTimeout(settle, (durationSec + 0.5) * 1000)

    const oscillator = audioContext.createOscillator()
    const filter = audioContext.createBiquadFilter()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime
    const peak = 0.32

    oscillator.setPeriodicWave(pianoWave(audioContext))
    oscillator.frequency.value = midiToFrequency(midi)

    filter.type = 'lowpass'
    filter.frequency.value = 3200
    filter.Q.value = 0.6

    const sustainAt = Math.max(now + 0.17, now + durationSec - 0.14)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(peak, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(peak * 0.8, now + 0.16)
    gain.gain.setValueAtTime(peak * 0.8, sustainAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.onended = () => {
      clearTimeout(fallback)
      oscillator.disconnect()
      filter.disconnect()
      gain.disconnect()
      settle()
    }
    oscillator.start(now)
    oscillator.stop(now + durationSec)
  })
}
