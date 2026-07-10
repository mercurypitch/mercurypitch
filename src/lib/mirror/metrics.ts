// ============================================================
// Voice Mirror — pure metrics over F0 frame streams.
//
// Implements the Voice Mirror spec (§3–4): preprocessing, vocal
// range from glides, octave-folded pitch accuracy from match
// takes, and steadiness (drift + wobble) from a held note.
//
// Zero DOM, zero audio imports — everything here is a pure
// function over F0Frame[] so it can be unit-tested on synthetic
// tracks. All pitch math is done in MIDI-cents (A4 = 6900), so a
// semitone is a uniform 100-cent step.
// ============================================================

import { midiToNoteNameOctave } from '@/lib/note-utils'
import { detectVibrato } from '@/lib/vocal-analyzer'

/** One pitch frame from the detector stream. */
export interface F0Frame {
  /** Time in seconds since task start. */
  t: number
  /** Fundamental frequency in Hz; 0 when unvoiced. */
  f0: number
  /** Detector confidence/clarity, 0..1. */
  conf: number
}

/** A voiced, median-filtered frame in MIDI-cents. */
export interface VoicedFrame {
  t: number
  /** MIDI-cents: 1200·log2(f0/440) + 6900, so C4 = 6000, A4 = 6900. */
  cents: number
}

// The app's YIN/MPM detector reports `clarity` that healthy voiced frames
// clear at ~0.5+ (exercise code gates at 0.2–0.5); the spec's 0.85 assumed a
// different confidence scale.
export const CONF_MIN = 0.5
/** Median-filter window (frames) used to kill single-frame octave glitches. */
export const MEDIAN_WINDOW = 5
/** Cumulative dwell (s) within ±50 c for a semitone bin to qualify (§4.1). */
export const BIN_DWELL_MIN_SEC = 0.15
/** Lock = this long contiguously within ±LOCK_TOLERANCE_CENTS (§4.2). */
export const LOCK_DURATION_SEC = 0.15
export const LOCK_TOLERANCE_CENTS = 60
/** A sung note within this folded distance is a "hit" (§4.2) — the green
 *  locked-on feedback in LiveViz and the onboarding demos shares it, so
 *  what the UI celebrates and what the score rewards can't drift apart. */
export const HIT_TOLERANCE_CENTS = 35
/** A lock also needs this many frames — sparse voiced frames can inflate the
 *  hop estimate enough that one stray sample would otherwise span 150 ms. */
export const LOCK_MIN_FRAMES = 3
/** Hold-task trims: onset and release are excluded from steadiness (§4.3). */
export const HOLD_TRIM_START_SEC = 0.4
export const HOLD_TRIM_END_SEC = 0.2
/** Onset/scoop (§4.4): sustained-within window that ends the scoop. */
export const ONSET_TOLERANCE_CENTS = 50
export const ONSET_SUSTAIN_SEC = 0.1
/** Vibrato counts as a feature only inside the singerly rate band (v1.1). */
export const VIBRATO_MIN_HZ = 3.5
export const VIBRATO_MAX_HZ = 8.5
/** Fallback hop when a take has too few frames to estimate one (~60 Hz rAF). */
export const DEFAULT_HOP_SEC = 0.016

// ── Shared helpers ───────────────────────────────────────────

/** Hz → MIDI-cents (A4 = 6900). */
export function hzToCents(f0: number): number {
  return 1200 * Math.log2(f0 / 440) + 6900
}

/** Nearest note (integer MIDI) for a MIDI-cents value. */
export function centsToMidi(cents: number): number {
  return Math.round(cents / 100)
}

/**
 * Fold a cents error into [−600, +600): matching the reference in a different
 * octave is correct (§4.2), which is essential for low/high voices.
 */
export function foldCents(delta: number): number {
  return (((delta % 1200) + 1800) % 1200) - 600
}

/** Centered median filter; edges use the available part of the window. */
export function medianFilter(values: number[], window: number): number[] {
  const half = Math.floor(window / 2)
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - half), i + half + 1)
    return median(slice)
  })
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

/** Linear-interpolated percentile over a pre-sorted array, p in [0, 1]. */
function percentileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const frac = idx - lo
  return sorted[lo] * (1 - frac) + sorted[hi] * frac
}

/**
 * Amplitude (cents) of a single-frequency component in a voiced series,
 * measured by projection after OLS detrending. Broadband noise projects only
 * weakly onto one frequency, so this isolates a true periodic modulation.
 */
export function sinusoidAmplitudeCents(
  frames: readonly VoicedFrame[],
  rateHz: number,
): number {
  const n = frames.length
  if (n < 4) return 0
  const meanT = frames.reduce((s, f) => s + f.t, 0) / n
  const meanC = frames.reduce((s, f) => s + f.cents, 0) / n
  let covTC = 0
  let varT = 0
  for (const f of frames) {
    covTC += (f.t - meanT) * (f.cents - meanC)
    varT += (f.t - meanT) ** 2
  }
  const slope = varT > 0 ? covTC / varT : 0
  const intercept = meanC - slope * meanT
  let re = 0
  let im = 0
  for (const f of frames) {
    const residual = f.cents - (slope * f.t + intercept)
    const phase = 2 * Math.PI * rateHz * f.t
    re += residual * Math.cos(phase)
    im += residual * Math.sin(phase)
  }
  return (2 * Math.hypot(re, im)) / n
}

/**
 * Best single-frequency fit near a detector-estimated rate. The FFT rate is
 * quantized (~0.1 Hz bins); over a multi-second window even a 0.1 Hz error
 * sinc-attenuates the projected amplitude, which would leave part of the
 * vibrato variance in the wobble score. Scanning ±0.15 Hz recovers it.
 */
export function bestSinusoidFit(
  frames: readonly VoicedFrame[],
  aroundHz: number,
): { rateHz: number; amplitude: number } {
  let best = { rateHz: aroundHz, amplitude: 0 }
  for (let rate = aroundHz - 0.15; rate <= aroundHz + 0.151; rate += 0.05) {
    const amplitude = sinusoidAmplitudeCents(frames, rate)
    if (amplitude > best.amplitude) {
      best = { rateHz: Math.round(rate * 10) / 10, amplitude }
    }
  }
  return best
}

/** Median inter-frame gap, used as the per-frame dwell/duration estimate. */
function estimateHop(frames: readonly { t: number }[]): number {
  const gaps: number[] = []
  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i].t - frames[i - 1].t
    if (gap > 0) gaps.push(gap)
  }
  return gaps.length > 0 ? median(gaps) : DEFAULT_HOP_SEC
}

/** Gaps longer than this split voiced frames into separate runs. */
const RUN_GAP_SEC = 0.12

/**
 * §3 preprocessing: drop unvoiced/low-confidence frames, median-filter f0 to
 * kill YIN octave halving/doubling glitches, convert to MIDI-cents. The
 * filter runs per contiguous voiced run — filtering across an unvoiced gap
 * (a breath, a consonant) would smear pre-gap pitch into post-gap frames.
 */
export function preprocess(
  frames: readonly F0Frame[],
  confMin: number = CONF_MIN,
): VoicedFrame[] {
  const voiced = frames.filter((f) => f.f0 > 0 && f.conf >= confMin)
  const result: VoicedFrame[] = []
  let runStart = 0
  for (let i = 1; i <= voiced.length; i++) {
    const gap = i < voiced.length ? voiced[i].t - voiced[i - 1].t : Infinity
    if (gap <= RUN_GAP_SEC) continue
    const run = voiced.slice(runStart, i)
    const filtered = medianFilter(
      run.map((f) => f.f0),
      MEDIAN_WINDOW,
    )
    for (let j = 0; j < run.length; j++) {
      result.push({ t: run[j].t, cents: hzToCents(filtered[j]) })
    }
    runStart = i
  }
  return result
}

// ── §4.1 Vocal range ─────────────────────────────────────────

export interface RangeResult {
  lowMidi: number
  highMidi: number
  lowNote: string
  highNote: string
  /** Total range span in semitones (highMidi − lowMidi). */
  semitones: number
  /** All qualifying semitone bins (integer MIDI), ascending. */
  qualifyingMidis: number[]
  /** "Your range overlaps most with: …" — a hint, never a verdict. */
  voiceHint: string | null
}

// Overlap table from the spec (§4.1). Ranges are integer MIDI.
const VOICE_TYPES: ReadonlyArray<{ name: string; low: number; high: number }> =
  [
    { name: 'Bass', low: 40, high: 64 }, // E2–E4
    { name: 'Baritone', low: 43, high: 67 }, // G2–G4
    { name: 'Tenor', low: 48, high: 72 }, // C3–C5
    { name: 'Alto', low: 53, high: 77 }, // F3–F5
    { name: 'Mezzo-soprano', low: 57, high: 81 }, // A3–A5
    { name: 'Soprano', low: 60, high: 84 }, // C4–C6
  ]

/** Best-overlapping voice type for a detected range; ties → closest center. */
export function voiceTypeHint(
  lowMidi: number,
  highMidi: number,
): string | null {
  const center = (lowMidi + highMidi) / 2
  let best: { name: string; overlap: number; centerDist: number } | null = null
  for (const vt of VOICE_TYPES) {
    const overlap = Math.min(highMidi, vt.high) - Math.max(lowMidi, vt.low)
    if (overlap <= 0) continue
    const centerDist = Math.abs((vt.low + vt.high) / 2 - center)
    if (
      best === null ||
      overlap > best.overlap ||
      (overlap === best.overlap && centerDist < best.centerDist)
    ) {
      best = { name: vt.name, overlap, centerDist }
    }
  }
  return best?.name ?? null
}

/**
 * Vocal range from the glide task (§4.1). Takes both glides (up and down);
 * dwell accumulates across all of them, so a semitone only needs 150 ms total.
 */
export function computeRange(glides: readonly F0Frame[][]): RangeResult | null {
  const frames = glides.flatMap((g) => preprocess(g))
  if (frames.length === 0) return null

  // Guard rail: drop octave-error outliers around the 2nd–98th percentile of
  // the cents distribution before binning. The one-semitone margin matters:
  // a briefly-held true extreme (say 200 ms on the top note ≈ 1.3% of frames)
  // sits inside the tail but within 100 c of the 98th percentile and must
  // survive, while octave errors sit ~1200 c out and still get clipped.
  const sorted = frames.map((f) => f.cents).sort((a, b) => a - b)
  const lo = percentileSorted(sorted, 0.02) - 100
  const hi = percentileSorted(sorted, 0.98) + 100
  const kept = frames.filter((f) => f.cents >= lo && f.cents <= hi)
  if (kept.length === 0) return null

  const hop = estimateHop(kept)
  const dwell = new Map<number, number>()
  for (const f of kept) {
    // Every frame is within ±50 c of its nearest semitone by construction.
    const midi = centsToMidi(f.cents)
    dwell.set(midi, (dwell.get(midi) ?? 0) + hop)
  }

  const qualifying = [...dwell.entries()]
    .filter(([, sec]) => sec >= BIN_DWELL_MIN_SEC)
    .map(([midi]) => midi)
    .sort((a, b) => a - b)
  if (qualifying.length === 0) return null

  const lowMidi = qualifying[0]
  const highMidi = qualifying[qualifying.length - 1]
  return {
    lowMidi,
    highMidi,
    lowNote: midiToNoteNameOctave(lowMidi),
    highNote: midiToNoteNameOctave(highMidi),
    semitones: highMidi - lowMidi,
    qualifyingMidis: qualifying,
    voiceHint: voiceTypeHint(lowMidi, highMidi),
  }
}

// ── §4.2 Pitch accuracy ──────────────────────────────────────

export type MatchBand = 'bullseye' | 'hit' | 'close' | 'miss' | 'no-voice'

export interface NoteTakeResult {
  targetMidi: number
  /** False when no voiced lock happened → "we couldn't hear a note here". */
  locked: boolean
  /** Median absolute folded error (cents) over the scoring window. */
  deviationCents: number | null
  band: MatchBand
  /** 0–100 per-note score. */
  score: number
  /** §4.4 scoop: ms from voicing onset to the first 100 ms sustained within
   *  ±50 c of target; null when the take never settled. */
  onsetMs: number | null
}

export interface AccuracyResult {
  /** Mean of the per-note scores, 0–100. */
  score: number
  takes: NoteTakeResult[]
  /** Median scoop across settled takes — "you scoop ~180 ms into notes". */
  scoopMedianMs: number | null
}

/** Piecewise-linear per-note score (§4.2): 100@≤12 → 70@35 → 40@60 → 0@≥120. */
export function matchScore(deviationCents: number): number {
  const d = deviationCents
  if (d <= 12) return 100
  if (d <= 35) return 100 - ((d - 12) / 23) * 30
  if (d <= 60) return 70 - ((d - 35) / 25) * 30
  if (d <= 120) return 40 - ((d - 60) / 60) * 40
  return 0
}

function matchBand(deviationCents: number): MatchBand {
  if (deviationCents <= 15) return 'bullseye'
  if (deviationCents <= HIT_TOLERANCE_CENTS) return 'hit'
  if (deviationCents <= 60) return 'close'
  return 'miss'
}

/**
 * Score one match take against a target note (§4.2). Errors are octave-folded.
 * Lock = first 150 ms of contiguous voiced frames within ±60 c (folded); the
 * scoring window is the post-lock frames (attack excluded). No lock → 0.
 */
export function scoreMatchTake(
  frames: readonly F0Frame[],
  targetMidi: number,
): NoteTakeResult {
  const noVoice: NoteTakeResult = {
    targetMidi,
    locked: false,
    deviationCents: null,
    band: 'no-voice',
    score: 0,
    onsetMs: null,
  }
  const voiced = preprocess(frames)
  if (voiced.length === 0) return noVoice

  const hop = estimateHop(voiced)
  const targetCents = targetMidi * 100

  // §4.4 onset/scoop: time from the first voiced frame to the start of the
  // first 100 ms sustained within ±50 c (folded) of the target.
  let onsetMs: number | null = null
  let onsetRunStart = -1
  for (let i = 0; i < voiced.length; i++) {
    const inTolerance =
      Math.abs(foldCents(voiced[i].cents - targetCents)) <=
      ONSET_TOLERANCE_CENTS
    if (!inTolerance) {
      onsetRunStart = -1
      continue
    }
    const contiguous =
      i > 0 && voiced[i].t - voiced[i - 1].t <= 2.5 * hop && onsetRunStart >= 0
    if (!contiguous) onsetRunStart = i
    if (
      i - onsetRunStart + 1 >= LOCK_MIN_FRAMES &&
      voiced[i].t - voiced[onsetRunStart].t + hop >= ONSET_SUSTAIN_SEC
    ) {
      onsetMs = (voiced[onsetRunStart].t - voiced[0].t) * 1000
      break
    }
  }

  // Find the lock: a contiguous run (no unvoiced gaps) within tolerance whose
  // span reaches LOCK_DURATION_SEC.
  let runStart = -1
  let lockEnd = -1
  for (let i = 0; i < voiced.length; i++) {
    const inTolerance =
      Math.abs(foldCents(voiced[i].cents - targetCents)) <= LOCK_TOLERANCE_CENTS
    if (!inTolerance) {
      runStart = -1
      continue
    }
    const contiguous =
      i > 0 && voiced[i].t - voiced[i - 1].t <= 2.5 * hop && runStart >= 0
    if (!contiguous) runStart = i
    if (
      i - runStart + 1 >= LOCK_MIN_FRAMES &&
      voiced[i].t - voiced[runStart].t + hop >= LOCK_DURATION_SEC
    ) {
      lockEnd = i
      break
    }
  }
  if (lockEnd < 0) return noVoice

  // Post-lock frames; if the singer stopped right at the lock, fall back to
  // the lock window itself rather than scoring an empty set.
  let scoring = voiced.slice(lockEnd + 1)
  if (scoring.length === 0) scoring = voiced.slice(runStart, lockEnd + 1)

  const deviation = median(
    scoring.map((f) => Math.abs(foldCents(f.cents - targetCents))),
  )
  return {
    targetMidi,
    locked: true,
    deviationCents: deviation,
    band: matchBand(deviation),
    score: matchScore(deviation),
    onsetMs,
  }
}

/** Accuracy = mean of the per-note scores (§4.2), plus the median scoop. */
export function computeAccuracy(
  takes: readonly NoteTakeResult[],
): AccuracyResult | null {
  if (takes.length === 0) return null
  const score = takes.reduce((sum, take) => sum + take.score, 0) / takes.length
  const onsets = takes
    .map((take) => take.onsetMs)
    .filter((ms): ms is number => ms !== null)
  return {
    score: Math.round(score),
    takes: [...takes],
    scoopMedianMs: onsets.length > 0 ? Math.round(median(onsets)) : null,
  }
}

/**
 * Pick 5 match targets from the detected range (§4.2): between the 25th and
 * 75th percentile, spaced 2–4 semitones apart, shuffled. `random` is
 * injectable for tests. Narrow ranges degrade gracefully to 1-semitone gaps.
 */
export function pickMatchTargets(
  lowMidi: number,
  highMidi: number,
  random: () => number = Math.random,
): number[] {
  const span = highMidi - lowMidi
  const p25 = Math.round(lowMidi + span * 0.25)
  const p75 = Math.round(highMidi - span * 0.25)
  const window = Math.max(1, p75 - p25)
  const gapCount = 4
  const minGap = window >= 2 * gapCount ? 2 : 1

  const gaps: number[] = []
  let total = 0
  for (let i = 0; i < gapCount; i++) {
    const remainingMin = (gapCount - 1 - i) * minGap
    const maxGap = Math.max(minGap, Math.min(4, window - total - remainingMin))
    const gap = minGap + Math.floor(random() * (maxGap - minGap + 1))
    gaps.push(gap)
    total += gap
  }

  const slack = Math.max(0, window - total)
  const start = p25 + Math.floor(random() * (slack + 1))
  let targets: number[] = [start]
  for (const gap of gaps) {
    targets.push(
      Math.min(highMidi, Math.max(lowMidi, targets[targets.length - 1] + gap)),
    )
  }

  // Narrow ranges can clamp successive targets onto the same note. Spread
  // duplicates across the rest of the range so the singer gets distinct
  // notes whenever the range has enough of them.
  const distinct = [...new Set(targets)]
  for (let m = lowMidi; distinct.length <= gapCount && m <= highMidi; m++) {
    if (!distinct.includes(m)) distinct.push(m)
  }
  while (distinct.length <= gapCount) distinct.push(targets[0])
  targets = distinct

  // Fisher–Yates shuffle with the injected source.
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[targets[i], targets[j]] = [targets[j], targets[i]]
  }
  return targets
}

// ── §4.3 Steadiness ──────────────────────────────────────────

export interface VibratoInfo {
  rateHz: number
  /** Modulation amplitude in cents — shown as "vibrato: 5.6 Hz, ±38 c". */
  extentCents: number
}

export interface SteadinessResult {
  /** The singer's own median pitch, MIDI-cents. */
  referenceCents: number
  referenceNote: string
  /** OLS slope of cents vs. time — "drifted ~4 cents/sec flat". */
  driftCentsPerSec: number
  /** SD of residual cents after detrending, vibrato excluded (v1.1). */
  wobbleSdCents: number
  /** Detected vibrato — labeled a feature, never scored as wobble. */
  vibrato: VibratoInfo | null
  /** 0–100 steadiness score. */
  score: number
  /** Seconds of voiced audio that were actually scored. */
  voicedSeconds: number
}

/** Piecewise steadiness score from residual SD (§4.3). */
export function steadinessScore(sdCents: number): number {
  const sd = sdCents
  if (sd <= 8) return 100 - (sd / 8) * 5
  if (sd <= 20) return 95 - ((sd - 8) / 12) * 25
  if (sd <= 40) return 70 - ((sd - 20) / 20) * 30
  if (sd <= 70) return 40 - ((sd - 40) / 30) * 30
  return Math.max(0, 10 - ((sd - 70) / 50) * 10)
}

/**
 * Steadiness from the hold task (§4.3). Trims onset/release, detrends against
 * the singer's own median pitch (so it never double-penalizes accuracy), and
 * reports drift (slope) and wobble (residual SD) separately.
 */
export function computeSteadiness(
  frames: readonly F0Frame[],
): SteadinessResult | null {
  const voiced = preprocess(frames)
  if (voiced.length === 0) return null

  const start = voiced[0].t + HOLD_TRIM_START_SEC
  const end = voiced[voiced.length - 1].t - HOLD_TRIM_END_SEC
  const kept = voiced.filter((f) => f.t >= start && f.t <= end)
  // Too little material also means a near-zero time spread, which would make
  // the OLS drift slope explode — require a real window, not just 5 frames.
  if (kept.length < 5 || kept[kept.length - 1].t - kept[0].t < 0.3) return null

  // OLS fit of cents vs. time.
  const n = kept.length
  const meanT = kept.reduce((s, f) => s + f.t, 0) / n
  const meanC = kept.reduce((s, f) => s + f.cents, 0) / n
  let covTC = 0
  let varT = 0
  for (const f of kept) {
    covTC += (f.t - meanT) * (f.cents - meanC)
    varT += (f.t - meanT) ** 2
  }
  const slope = varT > 0 ? covTC / varT : 0
  const intercept = meanC - slope * meanT

  const residualVariance =
    kept.reduce((s, f) => s + (f.cents - (slope * f.t + intercept)) ** 2, 0) / n

  // v1.1: vibrato is a feature, not wobble. The FFT detector finds the
  // modulation RATE; the amplitude is measured here by projecting the
  // detrended residual onto that single frequency (the analyzer's own
  // depthCents is 2×RMS of the WHOLE signal — subtracting that would erase
  // real wobble along with the vibrato). Broadband shakiness projects only
  // weakly onto one frequency, so an unsteady voice stays unsteady.
  const vib = detectVibrato(
    kept.map((f) => ({ time: f.t, freq: 0, midi: f.cents / 100 })),
  )
  let vibrato: VibratoInfo | null = null
  let wobble = Math.sqrt(residualVariance)
  if (
    vib.detected &&
    vib.rateHz >= VIBRATO_MIN_HZ &&
    vib.rateHz <= VIBRATO_MAX_HZ
  ) {
    const fit = bestSinusoidFit(kept, vib.rateHz)
    if (fit.amplitude >= 10) {
      vibrato = { rateHz: fit.rateHz, extentCents: Math.round(fit.amplitude) }
      wobble = Math.sqrt(Math.max(0, residualVariance - fit.amplitude ** 2 / 2))
    }
  }

  const referenceCents = median(kept.map((f) => f.cents))
  return {
    referenceCents,
    referenceNote: midiToNoteNameOctave(centsToMidi(referenceCents)),
    driftCentsPerSec: slope,
    wobbleSdCents: wobble,
    vibrato,
    score: Math.round(steadinessScore(wobble)),
    voicedSeconds: kept.length * estimateHop(kept),
  }
}

// ── Aggregate result, baseline summary and delta ─────────────

export interface MirrorResult {
  range: RangeResult | null
  accuracy: AccuracyResult | null
  steadiness: SteadinessResult | null
}

export interface MatchTake {
  targetMidi: number
  frames: F0Frame[]
}

/** Compute the full mirror result from the three tasks' raw frame streams. */
export function computeMirrorResult(input: {
  glides: F0Frame[][]
  hold: F0Frame[]
  matches: MatchTake[]
}): MirrorResult {
  return {
    range: computeRange(input.glides),
    accuracy: computeAccuracy(
      input.matches.map((m) => scoreMatchTake(m.frames, m.targetMidi)),
    ),
    steadiness: computeSteadiness(input.hold),
  }
}

/** Flat numbers persisted as the baseline — derived metrics only, never audio. */
export interface MirrorSummary {
  lowMidi: number | null
  highMidi: number | null
  semitones: number | null
  accuracy: number | null
  steadiness: number | null
}

export function summarize(result: MirrorResult): MirrorSummary {
  return {
    lowMidi: result.range?.lowMidi ?? null,
    highMidi: result.range?.highMidi ?? null,
    semitones: result.range?.semitones ?? null,
    accuracy: result.accuracy?.score ?? null,
    steadiness: result.steadiness?.score ?? null,
  }
}

export interface MirrorDelta {
  semitones: number | null
  accuracy: number | null
  steadiness: number | null
}

/** Per-metric change vs. a saved baseline; null where either side is missing. */
export function computeDelta(
  baseline: MirrorSummary,
  current: MirrorSummary,
): MirrorDelta {
  const diff = (a: number | null, b: number | null): number | null =>
    a !== null && b !== null ? b - a : null
  return {
    semitones: diff(baseline.semitones, current.semitones),
    accuracy: diff(baseline.accuracy, current.accuracy),
    steadiness: diff(baseline.steadiness, current.steadiness),
  }
}
