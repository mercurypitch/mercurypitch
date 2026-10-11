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

/** The house release for a note cut short (ENVELOPE_DEFAULTS in
 *  preview-player.ts): a 180 ms exponential decay, then 60 ms of slack
 *  before the oscillator stops. */
const STOP_RELEASE_SEC = 0.18
const STOP_SLACK_SEC = 0.06

/** A reference tone that is sounding: stop it, or wait for its end. */
export interface ReferenceTone {
  /** Fade out now and stop after the tail. Safe to call more than once. */
  stop: () => void
  /** Resolves once the note has ended, by itself or by `stop`. */
  done: Promise<void>
}

/**
 * Start a soft, piano-like reference tone that can be stopped part-way.
 * The onboarding's sound lane needs that: a new sound, or a take about to
 * record, must never have a note still ringing under it.
 */
export function startReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
  destination?: AudioNode,
): ReferenceTone {
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => undefined)
  }

  let settled = false
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = (): void => {
      if (settled) return
      settled = true
      resolve()
    }
  })
  const fallback = setTimeout(() => settle(), (durationSec + 0.5) * 1000)

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

  let stopped = false
  const stop = (): void => {
    if (stopped || settled) return
    stopped = true
    try {
      // Anchor where the envelope is, decay over five time constants of
      // the release, and stop only once the tail has gone quiet.
      const at = audioContext.currentTime
      gain.gain.cancelScheduledValues(at)
      gain.gain.setValueAtTime(gain.gain.value, at)
      gain.gain.setTargetAtTime(0, at, STOP_RELEASE_SEC / 5)
      oscillator.stop(at + STOP_RELEASE_SEC + STOP_SLACK_SEC)
    } catch {
      // The context closed under us: nothing is sounding any more.
    }
    // Over for the caller now: what is left is the release tail.
    settle()
  }

  return { stop, done }
}

/** Play a soft, piano-like reference tone and resolve after its release. */
export function playReferenceTone(
  audioContext: AudioContext,
  midi: number,
  durationSec = 1,
  destination?: AudioNode,
): Promise<void> {
  return startReferenceTone(audioContext, midi, durationSec, destination).done
}
