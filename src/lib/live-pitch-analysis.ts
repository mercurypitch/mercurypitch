// ============================================================
// Live Pitch Analysis — real-time adapter over `vocal-analyzer`
//
// This module owns the live-capture *sample* type and adapts a rolling
// buffer of mic frames onto the shared analysis functions in
// `vocal-analyzer.ts`. It deliberately holds no metric maths of its own:
// live and offline analysis must produce the same numbers for the same
// signal, and they used to not — this file previously carried a second,
// divergent implementation of every metric with incompatible result types.
//
// When a magnitude spectrum is available (the spectral worker is running),
// breathiness / richness / resonance are computed from the real FFT rather
// than approximated from the pitch track.
// ============================================================

import { frequencyToMidi } from '@/lib/frequency-to-note'
import type { BreathinessResult, HarmonicRichnessResult, ResonanceResult, SlideTrackingResult, VibratoResult, } from '@/lib/vocal-analyzer'
import { approximateBreathiness, approximateResonance, approximateRichness, detectSlides, detectVibrato, intensityFromPitchResults, } from '@/lib/vocal-analyzer'

/** A single pitch sample from live mic input. */
export interface LivePitchSample {
  /** Frequency in Hz (0 = no pitch detected) */
  frequency: number
  /** Clarity/confidence (0-1) */
  clarity: number
  /** RMS amplitude (0-1) */
  amplitude: number
  /** Note name (e.g. "C4") */
  noteName: string
  /** Timestamp in seconds since recording start */
  timestamp: number
}

export interface LiveIntensityResult {
  /** Average dB level across the buffer */
  avgDb: number
  /** Peak dB level */
  peakDb: number
  /** Dynamic range (peak - min) in dB */
  dynamicRange: number
  /** Whether the intensity is consistent (low variation) */
  isConsistent: boolean
}

/**
 * Real FFT-derived timbre for the current frame, as produced by
 * `spectral.worker.ts`. Supplying this switches breathiness / richness /
 * resonance from pitch-track approximations to the true spectral values —
 * without recomputing the DSP the worker already did.
 */
export interface LiveSpectralTimbre {
  breathiness: BreathinessResult
  richness: HarmonicRichnessResult
  resonance: ResonanceResult
}

export interface LiveAnalysisSnapshot {
  intensity: LiveIntensityResult
  breathiness: BreathinessResult
  slides: SlideTrackingResult
  vibrato: VibratoResult
  richness: HarmonicRichnessResult
  resonance: ResonanceResult
  sampleCount: number
  /** True when the timbre metrics came from a real spectrum. */
  spectral: boolean
}

/** Voiced frames only — unvoiced ones carry no pitch and skew every metric. */
function voicedSamples(samples: LivePitchSample[]): LivePitchSample[] {
  return samples.filter((s) => s.frequency > 0 && s.clarity > 0)
}

/**
 * Shape live frames for `vocal-analyzer`, which works in
 * `{ time, freq, midi, clarity, rms }` space. `amplitude` is real linear RMS,
 * so passing it as `rms` gives a true intensity envelope rather than the
 * clarity-as-loudness fallback.
 */
function toPitchSamples(samples: LivePitchSample[]): Array<{
  time: number
  freq: number
  midi: number
  clarity: number
  rms: number
}> {
  return samples.map((s) => ({
    time: s.timestamp,
    freq: s.frequency,
    midi: s.frequency > 0 ? frequencyToMidi(s.frequency, false) : 0,
    clarity: s.clarity,
    rms: s.amplitude,
  }))
}

function liveIntensity(samples: LivePitchSample[]): LiveIntensityResult {
  if (samples.length === 0) {
    return { avgDb: -60, peakDb: -60, dynamicRange: 0, isConsistent: false }
  }

  const { envelope, avgDb, peakDb, dynamicRange } = intensityFromPitchResults(
    toPitchSamples(samples),
  )

  // Consistency = low spread of the dB envelope around its mean.
  let variance = 0
  if (envelope.length > 0) {
    const mean = envelope.reduce((s, p) => s + p.db, 0) / envelope.length
    variance =
      envelope.reduce((s, p) => s + (p.db - mean) ** 2, 0) / envelope.length
  }

  return {
    avgDb: Math.round(avgDb * 10) / 10,
    peakDb: Math.round(peakDb * 10) / 10,
    dynamicRange: Math.round(dynamicRange * 10) / 10,
    isConsistent: envelope.length > 0 && variance < 25,
  }
}

/** Pitch-track approximations, used only when no real spectrum is available. */
function approximateTimbre(voiced: LivePitchSample[]): LiveSpectralTimbre {
  const clarityPairs = voiced.map((s) => ({
    freq: s.frequency,
    clarity: s.clarity,
  }))
  const { richnessScore, harmonicCount, quality } =
    approximateRichness(clarityPairs)

  return {
    breathiness: approximateBreathiness(clarityPairs),
    richness: { richnessScore, harmonicCount, harmonicProfile: [], quality },
    resonance: approximateResonance(voiced.map((s) => ({ freq: s.frequency }))),
  }
}

/**
 * Run every live metric over a rolling sample buffer.
 *
 * @param samples rolling buffer of mic frames, oldest first
 * @param timbre real FFT timbre from the spectral worker; when supplied it is
 *   used verbatim instead of approximating from the pitch track
 */
export function analyzeLiveBuffer(
  samples: LivePitchSample[],
  timbre?: LiveSpectralTimbre,
): LiveAnalysisSnapshot {
  const voiced = voicedSamples(samples)
  const pitchSamples = toPitchSamples(voiced)
  const resolved = timbre ?? approximateTimbre(voiced)

  return {
    intensity: liveIntensity(samples),
    breathiness: resolved.breathiness,
    slides: detectSlides(pitchSamples),
    vibrato: detectVibrato(pitchSamples),
    richness: resolved.richness,
    resonance: resolved.resonance,
    sampleCount: samples.length,
    spectral: timbre !== undefined,
  }
}
