// ============================================================
// Take analysis — offline spectrogram + timbre for a whole take
//
// The live path analyses one frame at a time (spectral.worker.ts). A recorded
// take needs the opposite: one pass over the entire vocal, producing a
// spectrogram image and a single timbre reading.
//
// Pure and synchronous so it can be tested directly; it is far too slow for
// the main thread (a 3-minute stem is ~8M samples), so the only caller in the
// app is take-analysis.worker.ts. Progress is reported through a callback
// rather than postMessage so this module stays worker-agnostic.
//
// The output is a pre-binned Uint8 image rather than raw magnitudes: the
// canvas can only show ~1200x256 anyway, and shipping 3M floats across the
// worker boundary for every take selection is pure waste.
// ============================================================

import { stftForward } from '@/lib/stft-engine'
import type { BreathinessResult, HarmonicRichnessResult, ResonanceResult, } from '@/lib/vocal-analyzer'
import { computeHarmonicRichness, computeHNR, detectResonance, } from '@/lib/vocal-analyzer'

/** Analysis rate. 16 kHz keeps the full 0-8 kHz band the app displays. */
const TARGET_SAMPLE_RATE = 16_000
const N_FFT = 1024
const HOP = 512
/** Longest span analysed. Beyond this the take is truncated and flagged. */
const MAX_SECONDS = 300
/** Render target — more columns than this is invisible on any real screen. */
const MAX_COLS = 1200
const MAX_ROWS = 256
/** Frames quieter than this fraction of peak energy are unvoiced. */
const VOICED_ENERGY_RATIO = 0.15

export interface TakeAnalysisResult {
  /** Column-major Uint8 magnitudes: image[col * rows + row], row 0 = lowest freq. */
  image: Uint8Array
  cols: number
  rows: number
  /** Frequency at the top row (Hz). */
  maxFreq: number
  /** Seconds of audio represented by the image. */
  durationSec: number
  /** True when the take was longer than MAX_SECONDS and got cut. */
  truncated: boolean
  /** Timbre measured on the average voiced spectrum. Null if nothing voiced. */
  timbre: {
    breathiness: BreathinessResult
    richness: HarmonicRichnessResult
    resonance: ResonanceResult
    fundamentalHz: number
  } | null
}

/**
 * Decimate to ~TARGET_SAMPLE_RATE by box-averaging. Crude as resampling goes,
 * but the averaging acts as the anti-alias filter and the display bands are
 * far wider than the error it introduces.
 */
function downsample(
  samples: Float32Array,
  from: number,
): { data: Float32Array; rate: number } {
  if (from <= TARGET_SAMPLE_RATE) return { data: samples, rate: from }

  const factor = Math.floor(from / TARGET_SAMPLE_RATE)
  const outLen = Math.floor(samples.length / factor)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    let sum = 0
    const base = i * factor
    for (let j = 0; j < factor; j++) sum += samples[base + j]
    out[i] = sum / factor
  }
  return { data: out, rate: from / factor }
}

/** Strongest bin between 70 and 1000 Hz — the f0 when none was supplied. */
function estimateFundamental(
  spectrum: Float32Array,
  sampleRate: number,
  nFft: number,
): number {
  const binWidth = sampleRate / nFft
  const lo = Math.max(1, Math.round(70 / binWidth))
  const hi = Math.min(spectrum.length - 1, Math.round(1000 / binWidth))
  let bestBin = lo
  let best = -Infinity
  for (let i = lo; i <= hi; i++) {
    if (spectrum[i] > best) {
      best = spectrum[i]
      bestBin = i
    }
  }
  return bestBin * binWidth
}

export interface TakeAnalysisInput {
  samples: Float32Array
  sampleRate: number
  /** Known f0 (e.g. median of cached detected notes). Estimated when absent. */
  fundamentalHz?: number
}

/** Run the full offline pass. `onProgress` receives 0-100. */
export function analyzeTake(
  input: TakeAnalysisInput,
  onProgress: (pct: number) => void = () => {},
): TakeAnalysisResult {
  const { data: mono, rate } = downsample(input.samples, input.sampleRate)

  const maxSamples = Math.floor(MAX_SECONDS * rate)
  const truncated = mono.length > maxSamples
  const audio = truncated ? mono.subarray(0, maxSamples) : mono
  const durationSec = audio.length / rate

  onProgress(10)

  const stft = stftForward(audio, N_FFT, HOP)
  const { nFreq, nFrames } = stft

  onProgress(70)

  // Magnitudes per frame, plus the running sum used for the timbre pass.
  const frameEnergy = new Float32Array(nFrames)
  const magnitudes = new Float32Array(nFreq * nFrames)
  for (let frame = 0; frame < nFrames; frame++) {
    const base = frame * nFreq * 2
    let energy = 0
    for (let f = 0; f < nFreq; f++) {
      const re = stft.data[base + f * 2]
      const im = stft.data[base + f * 2 + 1]
      const mag = Math.sqrt(re * re + im * im)
      magnitudes[frame * nFreq + f] = mag
      energy += mag
    }
    frameEnergy[frame] = energy
  }

  // ── Bin down to the render grid ──
  const cols = Math.min(MAX_COLS, nFrames)
  const rows = Math.min(MAX_ROWS, nFreq)
  const image = new Uint8Array(cols * rows)

  let peak = 0
  for (let i = 0; i < magnitudes.length; i++) {
    if (magnitudes[i] > peak) peak = magnitudes[i]
  }
  const scale = peak > 0 ? 1 / peak : 0

  for (let c = 0; c < cols; c++) {
    const fStart = Math.floor((c * nFrames) / cols)
    const fEnd = Math.max(fStart + 1, Math.floor(((c + 1) * nFrames) / cols))
    for (let r = 0; r < rows; r++) {
      const bStart = Math.floor((r * nFreq) / rows)
      const bEnd = Math.max(bStart + 1, Math.floor(((r + 1) * nFreq) / rows))
      // Max-pool: peaks are the signal in a spectrogram, averaging buries them.
      let best = 0
      for (let f = fStart; f < fEnd; f++) {
        const rowBase = f * nFreq
        for (let b = bStart; b < bEnd; b++) {
          const mag = magnitudes[rowBase + b]
          if (mag > best) best = mag
        }
      }
      // dB-ish compression — linear magnitude renders as a black image.
      const norm = Math.log10(1 + best * scale * 9)
      image[c * rows + r] = Math.round(Math.max(0, Math.min(1, norm)) * 255)
    }
  }

  onProgress(90)

  // ── Timbre from the average voiced spectrum ──
  let energyPeak = 0
  for (let i = 0; i < nFrames; i++) {
    if (frameEnergy[i] > energyPeak) energyPeak = frameEnergy[i]
  }
  // A silent take has peak 0, which would make the threshold 0 and count
  // every empty frame as voiced — yielding a confident-looking reading of
  // nothing. No energy means no measurement.
  const threshold = energyPeak * VOICED_ENERGY_RATIO

  const avg = new Float32Array(nFreq)
  let voicedCount = 0
  if (energyPeak > 0) {
    for (let frame = 0; frame < nFrames; frame++) {
      if (frameEnergy[frame] <= threshold) continue
      voicedCount++
      const rowBase = frame * nFreq
      for (let f = 0; f < nFreq; f++) avg[f] += magnitudes[rowBase + f]
    }
  }

  let timbre: TakeAnalysisResult['timbre'] = null
  if (voicedCount > 0) {
    for (let f = 0; f < nFreq; f++) avg[f] /= voicedCount
    const f0 =
      input.fundamentalHz !== undefined && input.fundamentalHz > 0
        ? input.fundamentalHz
        : estimateFundamental(avg, rate, N_FFT)

    timbre = {
      breathiness: computeHNR(avg, rate, f0, N_FFT),
      richness: computeHarmonicRichness(avg, rate, f0, N_FFT),
      resonance: detectResonance(avg, rate, N_FFT),
      fundamentalHz: Math.round(f0),
    }
  }

  return {
    image,
    cols,
    rows,
    maxFreq: rate / 2,
    durationSec,
    truncated,
    timbre,
  }
}
