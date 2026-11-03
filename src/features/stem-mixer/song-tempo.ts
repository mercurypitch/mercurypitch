// ============================================================
// Song tempo — an onset-based tempo estimate for an uploaded song
// ============================================================
//
// Nothing else measures an uploaded song's tempo: Pitch Studio's BPM box
// starts at 120, and the box drives both the analysis's quantization and the
// Notes view's bar lines. This reads the recording's onsets with the shared
// spectral-flux detector (`onset-detector.ts`), takes `detectTempo`'s answer
// as the coarse tempo, and refines it from the onset-strength curve.
//
// Measured 2026-11-03 on two songs the app ships tempo data for (the listed
// tempo is from their beat times), as a browser decodes them: both channels,
// at 48 and at 44.1 kHz, each as instrumental stem and full mix:
//   Nothing in the Dark, listed 92.02: read as 92 every time
//   I'll Be Right Behind You, Josephine, listed 84.99: read as 85 every time
//     (before the octave rule below, as 169)
// Their vocal stems alone read 99 to 103 and 135 to 136, wrong, at
// confidence 0.13 to 0.15; the mixes and instrumentals scored 0.20 to 0.42.
// Hence the gate. A song took 0.7 to 0.9 s on a desktop.
//
// The spectra are computed one frame at a time with a small FFT rather than
// with `stftForward`, which holds every frame's complex spectrum at once:
// about 40 MB for a four-minute song even after downsampling.

import { computeFluxCurve, detectOnsets, detectTempo, } from '@/lib/onset-detector'
import type { SongTempoEstimate } from './song-tempo-record'

/** Every estimate lands in this range: half and double time are common. */
export const TEMPO_RANGE = { min: 60, max: 180 } as const

/**
 * Below this confidence an estimate is kept but never written into the BPM
 * box. It sits between the vocal stems (0.13 to 0.15) and the weakest mix
 * (0.20) measured above.
 */
export const CONFIDENT_TEMPO = 0.17

/** Rate the audio is reduced to before the spectra: onsets need no more. */
const ANALYSIS_RATE = 11025
const FRAME_SIZE = 512
const HOP_SIZE = 128
/**
 * The onset detector's threshold, in local standard deviations. Its default
 * of 2.5 found one onset every three seconds in a full song (a lone spike in
 * its nine-frame window scores at most about 2.7); 1.5 measured best above.
 */
const ONSET_THRESHOLD = 1.5
/**
 * Fewer onsets than eight bars of quarter notes is no pulse to read: a
 * clip, a held tone, a silence. `detectTempo` scores the share of intervals
 * that agree, and a handful agree by chance; a one-second test tone read as
 * 108 BPM at a confidence above the gate.
 */
const MIN_ONSETS = 32
/** Beats in the lag the refinement measures: a bar of 4/4. */
const REFINE_BEATS = 4
/**
 * Frames between yields, so a long song cannot freeze the page: about 6 s of
 * audio, a few milliseconds of work on a desktop.
 */
const FRAMES_PER_YIELD = 500

/**
 * The octave to write a tempo at. Outside `TEMPO_RANGE` it is halved or
 * doubled into it; when both it and its half (or double) fit, the one nearer
 * 100 BPM wins. The onsets of a busy arrangement pulse in eighth notes, so the
 * detector reads Josephine's 85 as 169, which the range alone would keep.
 */
export function foldTempo(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return bpm
  let folded = bpm
  while (folded < TEMPO_RANGE.min) folded *= 2
  while (folded > TEMPO_RANGE.max) folded /= 2
  const distance = (value: number): number => Math.abs(Math.log2(value / 100))
  for (const other of [folded / 2, folded * 2]) {
    if (
      other >= TEMPO_RANGE.min &&
      other <= TEMPO_RANGE.max &&
      distance(other) < distance(folded)
    ) {
      return other
    }
  }
  return folded
}

function createFft(size: number) {
  const cos = new Float64Array(size / 2)
  const sin = new Float64Array(size / 2)
  for (let index = 0; index < size / 2; index += 1) {
    cos[index] = Math.cos((2 * Math.PI * index) / size)
    sin[index] = Math.sin((2 * Math.PI * index) / size)
  }
  const bits = Math.log2(size)
  const reversed = new Uint32Array(size)
  for (let index = 0; index < size; index += 1) {
    let value = index
    let result = 0
    for (let bit = 0; bit < bits; bit += 1) {
      result = (result << 1) | (value & 1)
      value >>= 1
    }
    reversed[index] = result
  }
  return (re: Float64Array, im: Float64Array): void => {
    for (let index = 0; index < size; index += 1) {
      const swap = reversed[index]
      if (swap > index) {
        const r = re[index]
        re[index] = re[swap]
        re[swap] = r
        const i = im[index]
        im[index] = im[swap]
        im[swap] = i
      }
    }
    for (let length = 2; length <= size; length <<= 1) {
      const half = length >> 1
      const step = size / length
      for (let start = 0; start < size; start += length) {
        for (let offset = 0; offset < half; offset += 1) {
          const k = offset * step
          const a = start + offset
          const b = a + half
          const tr = re[b] * cos[k] + im[b] * sin[k]
          const ti = im[b] * cos[k] - re[b] * sin[k]
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }
}

const pause = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new DOMException('Tempo estimate cancelled', 'AbortError')
  }
}

/**
 * The recording reduced to one channel at about 11 kHz by averaging, and its
 * new rate. Averaging the channels is what a mono downmix does, and the
 * measurements above were taken on one.
 */
function downsample(
  channels: readonly Float32Array[],
  sampleRate: number,
): { samples: Float32Array; sampleRate: number } {
  const factor = Math.max(1, Math.floor(sampleRate / ANALYSIS_RATE))
  if (factor === 1 && channels.length === 1) {
    return { samples: channels[0], sampleRate }
  }
  const length = Math.min(...channels.map((channel) => channel.length))
  const reduced = new Float32Array(Math.floor(length / factor))
  const scale = 1 / (factor * channels.length)
  for (let index = 0; index < reduced.length; index += 1) {
    let sum = 0
    const from = index * factor
    for (const channel of channels) {
      for (let offset = 0; offset < factor; offset += 1)
        sum += channel[from + offset]
    }
    reduced[index] = sum * scale
  }
  return { samples: reduced, sampleRate: sampleRate / factor }
}

/** Log-compressed magnitude spectra, one per hop, for the onset detector. */
async function songSpectra(
  samples: Float32Array,
  signal: AbortSignal | undefined,
): Promise<Float32Array[]> {
  const window = new Float64Array(FRAME_SIZE)
  for (let index = 0; index < FRAME_SIZE; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / FRAME_SIZE)
  }
  const fft = createFft(FRAME_SIZE)
  const re = new Float64Array(FRAME_SIZE)
  const im = new Float64Array(FRAME_SIZE)
  const frames = Math.max(
    0,
    Math.floor((samples.length - FRAME_SIZE) / HOP_SIZE) + 1,
  )
  const spectra: Float32Array[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    if (frame > 0 && frame % FRAMES_PER_YIELD === 0) {
      await pause()
      throwIfAborted(signal)
    }
    const from = frame * HOP_SIZE
    for (let index = 0; index < FRAME_SIZE; index += 1) {
      re[index] = samples[from + index] * window[index]
      im[index] = 0
    }
    fft(re, im)
    const magnitudes = new Float32Array(FRAME_SIZE / 2 + 1)
    for (let bin = 0; bin <= FRAME_SIZE / 2; bin += 1) {
      magnitudes[bin] = Math.log1p(100 * Math.hypot(re[bin], im[bin]))
    }
    spectra.push(magnitudes)
  }
  return spectra
}

/**
 * The lag, in fractional hops, where the onset-strength curve repeats best
 * within `spread` of `center`: the autocorrelation's highest interior peak,
 * placed between hops by a parabola. Null when the window holds no peak.
 */
function peakLag(
  flux: Float32Array,
  mean: number,
  center: number,
  spread: number,
): number | null {
  const from = Math.max(2, Math.floor(center * (1 - spread)))
  const to = Math.min(flux.length - 2, Math.ceil(center * (1 + spread)))
  if (to <= from) return null
  const correlation = (lag: number): number => {
    let sum = 0
    for (let index = 0; index + lag < flux.length; index += 1) {
      sum += (flux[index] - mean) * (flux[index + lag] - mean)
    }
    return sum / (flux.length - lag)
  }
  const values: number[] = []
  for (let lag = from - 1; lag <= to + 1; lag += 1)
    values.push(correlation(lag))
  let best = -1
  for (let index = 1; index < values.length - 1; index += 1) {
    const isPeak =
      values[index] >= values[index - 1] && values[index] >= values[index + 1]
    if (isPeak && (best < 0 || values[index] > values[best])) best = index
  }
  if (best < 0) return null
  const left = values[best - 1]
  const peak = values[best]
  const right = values[best + 1]
  const curvature = left - 2 * peak + right
  const shift = curvature < 0 ? (0.5 * (left - right)) / curvature : 0
  return from - 1 + best + shift
}

/**
 * Refine a coarse tempo from the onset-strength curve. `detectTempo` scores
 * whole BPMs with a tolerance of 0.05 on the interval ratio, which for the
 * half-beat multiple is a band 10% wide where every candidate scores alike,
 * so its answer can sit anywhere in that band. The curve's autocorrelation
 * peak within 12% of one coarse beat is the beat itself (the half and double
 * lags lie outside that window); the peak at four of those beats, a bar, then
 * pins the period to a fraction of a hop divided by four.
 */
function refineTempo(
  flux: Float32Array,
  hopSeconds: number,
  coarseBpm: number,
): number {
  let mean = 0
  for (const value of flux) mean += value
  mean /= flux.length
  const beat = peakLag(flux, mean, 60 / coarseBpm / hopSeconds, 0.12)
  if (beat === null || beat <= 0) return coarseBpm
  const bar = peakLag(flux, mean, beat * REFINE_BEATS, 0.03)
  const period = bar !== null && bar > 0 ? bar / REFINE_BEATS : beat
  return 60 / (period * hopSeconds)
}

/**
 * Estimate a recording's tempo from one channel or several, averaged. Null
 * when the onsets agree on nothing; a returned estimate is only worth
 * writing into the BPM box when its confidence reaches `CONFIDENT_TEMPO`.
 * Yields while it works, and rejects with an AbortError once `signal`
 * aborts.
 */
export async function estimateSongTempo(
  samples: Float32Array | readonly Float32Array[],
  sampleRate: number,
  signal?: AbortSignal,
): Promise<SongTempoEstimate | null> {
  const channels = samples instanceof Float32Array ? [samples] : samples
  if (channels.length === 0) return null
  const reduced = downsample(channels, sampleRate)
  const spectra = await songSpectra(reduced.samples, signal)
  throwIfAborted(signal)
  const onsets = detectOnsets(spectra, reduced.sampleRate, HOP_SIZE, {
    threshold: ONSET_THRESHOLD,
  })
  if (onsets.length < MIN_ONSETS) return null
  const coarse = detectTempo(onsets, { minBpm: 40, maxBpm: 240 })
  if (coarse.confidence <= 0) return null
  const refined = refineTempo(
    computeFluxCurve(spectra),
    HOP_SIZE / reduced.sampleRate,
    coarse.bpm,
  )
  // Songs made in a DAW sit on whole BPMs. Rounding moved both measured
  // songs closer to their listed tempo (92.08 to 92, 84.6 to 85).
  return { bpm: Math.round(foldTempo(refined)), confidence: coarse.confidence }
}
