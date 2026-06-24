// ============================================================
// Key Detector — Chromagram + Krumhansl-Schmuckler key finding
// ============================================================

import type { KeyResult } from '@/types'

// ── Krumhansl-Kessler Probe Tone Profiles ──────────────────────

const MAJOR_PROFILE: number[] = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
]

const MINOR_PROFILE: number[] = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
]

// ── Pitch class names ────────────────────────────────────────

const PITCH_CLASSES: string[] = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

// ── Chromagram Computation ───────────────────────────────────

/**
 * Map frequency bins to 12 pitch classes (C, C#, D, ..., B).
 * Each bin's magnitude is added to its corresponding pitch class.
 * A4 = 440 Hz = MIDI 69.
 */
export function computeChromagram(
  magnitudeSpectrum: Float32Array,
  sampleRate: number,
  _fftSize: number,
): Float32Array {
  const chroma = new Float32Array(12)
  const nyquist = sampleRate / 2
  const binFreqStep = nyquist / Math.max(1, magnitudeSpectrum.length - 1)

  for (let i = 0; i < magnitudeSpectrum.length; i++) {
    const freq = i * binFreqStep
    if (freq < 65 || magnitudeSpectrum[i] <= 0) continue // Below C2 (~65Hz), skip

    // Convert frequency to MIDI number
    const midi = 69 + 12 * Math.log2(Math.max(1, freq) / 440)
    const pitchClass = Math.round(midi) % 12
    const pc = pitchClass < 0 ? pitchClass + 12 : pitchClass

    chroma[pc] += magnitudeSpectrum[i]
  }

  // Normalize to unit sum
  const total = chroma.reduce((a, b) => a + b, 0)
  if (total > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= total
  }

  return chroma
}

/**
 * Compute averaged chroma from a sequence of magnitude spectra.
 */
export function computeAverageChromagram(
  magnitudeSpectra: Float32Array[],
  sampleRate: number,
  fftSize: number,
): Float32Array {
  const avg = new Float32Array(12)
  if (magnitudeSpectra.length === 0) return avg

  for (const spectrum of magnitudeSpectra) {
    const chroma = computeChromagram(spectrum, sampleRate, fftSize)
    for (let i = 0; i < 12; i++) avg[i] += chroma[i]
  }
  for (let i = 0; i < 12; i++) avg[i] /= magnitudeSpectra.length
  return avg
}

// ── Correlation ──────────────────────────────────────────────

function correlation(a: Float32Array, b: number[]): number {
  let num = 0,
    denA = 0,
    denB = 0
  for (let i = 0; i < 12; i++) {
    num += a[i] * b[i]
    denA += a[i] * a[i]
    denB += b[i] * b[i]
  }
  const den = Math.sqrt(denA) * Math.sqrt(denB)
  return den > 0 ? num / den : 0
}

// ── Key Detection ────────────────────────────────────────────

/**
 * Detect key from a pre-computed chromagram using Krumhansl-Schmuckler.
 * Correlates the chroma vector against all 24 major/minor key profiles
 * (rotated for each possible tonic), returns the best match.
 */
export function detectKey(chromagram: Float32Array): KeyResult {
  const candidates: Array<{
    key: string
    tonic: string
    mode: 'major' | 'minor'
    score: number
  }> = []

  for (let tonic = 0; tonic < 12; tonic++) {
    // Rotate profiles to this tonic
    const majorRotated = MAJOR_PROFILE.slice(tonic).concat(
      MAJOR_PROFILE.slice(0, tonic),
    )
    const minorRotated = MINOR_PROFILE.slice(tonic).concat(
      MINOR_PROFILE.slice(0, tonic),
    )

    const majorScore = correlation(chromagram, majorRotated)
    const minorScore = correlation(chromagram, minorRotated)

    candidates.push({
      key: `${PITCH_CLASSES[tonic]} major`,
      tonic: PITCH_CLASSES[tonic],
      mode: 'major',
      score: majorScore,
    })
    candidates.push({
      key: `${PITCH_CLASSES[tonic]} minor`,
      tonic: PITCH_CLASSES[tonic],
      mode: 'minor',
      score: minorScore,
    })
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  const best = candidates[0]
  const maxScore = best.score

  // Confidence: best score relative to 2nd best
  const secondScore = candidates[1]?.score ?? 0
  const confidence =
    maxScore > 0 ? Math.min(1, ((maxScore - secondScore) / maxScore) * 5) : 0

  return {
    key: best.key,
    tonic: best.tonic,
    mode: best.mode,
    confidence: Math.max(0, Math.min(1, confidence)),
    alternatives: candidates
      .slice(1, 4)
      .map((c) => ({ key: c.key, score: c.score })),
  }
}

/**
 * Convenience: compute chroma from spectra sequence, then detect key.
 */
export function detectKeyFromSpectra(
  magnitudeSpectra: Float32Array[],
  sampleRate: number,
  fftSize: number,
): KeyResult {
  const chroma = computeAverageChromagram(magnitudeSpectra, sampleRate, fftSize)
  return detectKey(chroma)
}
