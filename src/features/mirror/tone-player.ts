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

/**
 * A shared bus for guide tones: gain → limiter → destination.
 *
 * Callers that can fire several tones in one frame (the Zen guide) must not
 * connect them to the raw destination — at 0.32 peak each their sum clips.
 * The limiter is insurance for exactly that pile-up; the 0.8 trim keeps the
 * normal case comfortably under it.
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

/**
 * Close a guide-tone bus and then its context, in that order, with a gap.
 *
 * Never `close()` mid-tone: the context dies at whatever sample it is on — a
 * full-scale cut into a PA (a confirmed pop source). The bus closes with the
 * documented release shape and the context follows only after the longest
 * tone tail (durationSec ≤ 1.2 s + release) has rung out.
 */
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
    /* context may already be closed */
  }
  setTimeout(() => {
    void audioContext.close().catch(() => undefined)
  }, closeDelayMs)
}

/** Play a soft, piano-like reference tone and resolve when it has decayed. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
  // Callers that fire several tones per frame (the Zen guide) route them
  // through a shared bus + limiter; a raw-destination connect lets
  // simultaneous cues sum past full scale and clip.
  destination?: AudioNode,
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
    gain.connect(destination ?? audioContext.destination)
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
