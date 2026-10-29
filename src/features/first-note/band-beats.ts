// ============================================================
// The band's beats before a singer comes in: First note's count-in
// ============================================================
//
// First note (docs/plans/ear-rooms.md) counts the singer in on the band's
// own beats: the last BEATS_SHOWN before the entry, on the band's own grid.
// Its tempo comes from the instrumental's onsets, its phase from the onsets
// in the lead-in. An entry whose lead-in does not show the grid clearly gets
// none, and the room shows only the countdown. The script reads the whole
// band; the phone reads only the lead-ins, and the tempo from them together.
//
// Both readers count by these, as they find the entries by the rules beside
// them (entry-rules.ts). A lead-in's onsets (an FFT every 10 ms) are much of
// a phone's read, on the thread that draws its screen, so they come in steps
// (onsetSteps) that the phone paces; the script runs them straight through
// (onsets).
//
// Node runs this file as it is, through its type stripping, from the script:
// so it names entry-rules.ts with its extension, which Node's own loader
// needs, and its syntax is all erasable.

import type { RuleSteps, Samples } from './entry-rules.ts'
import { runSteps } from './entry-rules.ts'

/** Beats shown before the entry. */
export const BEATS_SHOWN = 4
/** A lead-in shows its grid when beats carry this much more onset than the mean. */
export const GRID_CLEAR = 1.4
/** The rate the onset frames below are sized for; the script reads at it. */
export const BAND_RATE = 22_050
/** The onsets' hop at BAND_RATE, samples: about a hundred a second. */
const ONSET_HOP = 220

/** The band's onset strength over a stretch of it, from `start`, s. */
export interface OnsetGrid {
  readonly flux: readonly number[]
  /** Onset readings a second. */
  readonly fps: number
  /** Where the stretch starts on the song's clock, s. */
  readonly start: number
}

const twiddles = new Map<number, { cos: Float64Array; sin: Float64Array }>()

/** The rotations one FFT stage of `len` uses: worked out once a size. */
function twiddlesOf(len: number): { cos: Float64Array; sin: Float64Array } {
  const known = twiddles.get(len)
  if (known !== undefined) return known
  const angle = (-2 * Math.PI) / len
  const half = len / 2
  const cos = new Float64Array(half)
  const sin = new Float64Array(half)
  for (let k = 0; k < half; k++) {
    cos[k] = Math.cos(angle * k)
    sin[k] = Math.sin(angle * k)
  }
  const made = { cos, sin }
  twiddles.set(len, made)
  return made
}

/** An in-place radix-2 FFT over `re` and `im`. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const { cos, sin } = twiddlesOf(len)
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cos[k] - im[b] * sin[k]
        const ti = re[b] * sin[k] + im[b] * cos[k]
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
      }
    }
  }
}

/**
 * The band's onset strength, about a hundred a second: log-spectral flux,
 * its local mean taken off. `start` places the stretch on the song's clock.
 * In steps, a step after each spectrum.
 */
export function* onsetSteps(band: Samples, start = 0): RuleSteps<OnsetGrid> {
  const size = band.rate > 32_000 ? 2048 : 1024
  const hop = Math.round((ONSET_HOP * band.rate) / BAND_RATE)
  const window = Float64Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)),
  )
  const samples = band.samples
  const flux: number[] = []
  let previous: Float64Array | null = null
  for (let at = 0; at + size <= samples.length; at += hop) {
    const re = new Float64Array(size)
    const im = new Float64Array(size)
    for (let i = 0; i < size; i++) re[i] = samples[at + i] * window[i]
    fft(re, im)
    const mags = new Float64Array(size / 2)
    for (let k = 0; k < size / 2; k++) {
      mags[k] = Math.log1p(10 * Math.hypot(re[k], im[k]))
    }
    let sum = 0
    if (previous !== null) {
      for (let k = 0; k < mags.length; k++) {
        sum += Math.max(0, mags[k] - previous[k])
      }
    }
    flux.push(sum)
    previous = mags
    yield
  }
  const smooth = 50
  const out = flux.map((value, i) => {
    let local = 0
    let count = 0
    for (
      let j = Math.max(0, i - smooth / 2);
      j < Math.min(flux.length, i + smooth / 2);
      j++
    ) {
      local += flux[j]
      count += 1
    }
    return Math.max(0, value - local / count)
  })
  return { flux: out, fps: band.rate / hop, start }
}

/** The band's onset strength (`onsetSteps`), read straight through. */
export function onsets(band: Samples, start = 0): OnsetGrid {
  return runSteps(onsetSteps(band, start))
}

/**
 * The band's tempo, bpm, from stretches of it read at one rate: their
 * autocorrelations together, the best lag and its double. 0 with none.
 */
export function tempoOf(grids: readonly OnsetGrid[]): number {
  if (grids.length === 0) return 0
  const fps = grids[0].fps
  const maxLag = Math.ceil((120 / 60) * fps) + 2
  const ac = new Float64Array(maxLag + 1)
  for (const { flux } of grids) {
    for (let lag = 0; lag <= maxLag; lag++) {
      let sum = 0
      for (let i = 0; i + lag < flux.length; i++) sum += flux[i] * flux[i + lag]
      ac[lag] += sum
    }
  }
  const at = (lag: number): number => {
    const low = Math.floor(lag)
    const share = lag - low
    return ac[low] * (1 - share) + (ac[low + 1] ?? 0) * share
  }
  let best = { bpm: 0, score: -Infinity }
  for (let bpm = 60; bpm <= 190; bpm += 0.5) {
    const lag = (60 / bpm) * fps
    const score = at(lag) + 0.5 * at(2 * lag)
    if (score > best.score) best = { bpm, score }
  }
  return best.bpm
}

/** The last BEATS_SHOWN beats before `at`, s, on the band's grid, or []. */
export function beatsBefore(
  grid: OnsetGrid,
  bpm: number,
  from: number,
  at: number,
): number[] {
  if (!(bpm > 0)) return []
  const period = 60 / bpm
  const strength = (t: number): number =>
    grid.flux[Math.round((t - grid.start) * grid.fps)] ?? 0
  let best = { phase: 0, score: -Infinity }
  for (let phase = 0; phase < period; phase += 0.01) {
    let score = 0
    for (let t = from + phase; t < at; t += period) score += strength(t)
    if (score > best.score) best = { phase, score }
  }
  const beats: number[] = []
  for (let t = from + best.phase; t < at - 0.08; t += period) beats.push(t)
  let mean = 0
  let count = 0
  for (let t = from; t < at; t += 1 / grid.fps) {
    mean += strength(t)
    count += 1
  }
  mean /= Math.max(1, count)
  const onGrid = beats.reduce((sum, t) => sum + strength(t), 0) / beats.length
  if (beats.length < BEATS_SHOWN || mean <= 0 || onGrid / mean < GRID_CLEAR) {
    return []
  }
  return beats.slice(-BEATS_SHOWN).map((t) => Number(t.toFixed(3)))
}
