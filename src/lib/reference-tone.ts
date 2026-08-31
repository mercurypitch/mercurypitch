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

/**
 * A shared bus for guide tones: gain -> limiter -> destination.
 *
 * Callers that can fire several tones in one frame must not connect them to
 * the raw destination. The limiter prevents simultaneous cues from clipping,
 * while the trim keeps the ordinary single-tone case comfortably below it.
 */
export function createGuideToneBus(audioContext: AudioContext): GainNode {
  const limiter = audioContext.createDynamicsCompressor()
  limiter.threshold.value = -12
  limiter.knee.value = 20
  limiter.ratio.value = 12
  limiter.attack.value = 0.002
  limiter.release.value = 0.15
  limiter.connect(audioContext.destination)

  const bus = audioContext.createGain()
  bus.gain.value = 0.8
  bus.connect(limiter)
  return bus
}

/** Fade a guide-tone bus before closing its context to avoid an audible pop. */
export function closeGuideToneBus(
  audioContext: AudioContext,
  bus: GainNode | null,
  closeDelayMs = 1600,
): void {
  try {
    if (bus !== null) {
      const now = audioContext.currentTime
      bus.gain.cancelScheduledValues(now)
      bus.gain.setValueAtTime(bus.gain.value, now)
      bus.gain.setTargetAtTime(0, now, 0.03)
    }
  } catch {
    // The context may already be closed.
  }

  setTimeout(() => {
    void audioContext.close().catch(() => undefined)
  }, closeDelayMs)
}

/** Play a soft, piano-like reference tone and resolve after its release. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
  destination?: AudioNode,
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
    gain.connect(destination ?? audioContext.destination)
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
