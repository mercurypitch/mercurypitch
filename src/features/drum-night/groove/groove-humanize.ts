// ============================================================
// Groove humanizer — seeded, literature-anchored feel for drum events
// ============================================================
//
// Pure batch transform: (events, options) -> per-event timing offset,
// velocity, and ornaments. Grounded in the microtiming literature: swing
// ratio follows the Friberg tempo curve; timing noise is 1/f-correlated
// (Voss-McCartney rows plus a shared leaky drift walk), never white; style
// feel bias stays kit-coherent and small; every non-swing component is
// clamped asymmetrically because early deviations are judged more harshly
// than late ones. Intensity 0 reduces to pure swing. Per-style per-position
// tables extracted offline from the Groove MIDI Dataset (CC-BY 4.0) can
// later override the flat defaults without changing this interface.

import type { DrumVoiceId } from '@/lib/drum-voices'
import { fnv1a32, mulberry32 } from '../audio/drum-sample-select'
import generatedProfiles from './groove-profiles.generated.json'

export type HumanizeStyle = 'electronic' | 'funk' | 'jazz' | 'latin' | 'rock'

export interface HumanizeOptions {
  readonly style: HumanizeStyle
  /** 0 = quantized except swing; 1 = full real-performance magnitudes. */
  readonly intensity: number
  readonly seed: number
  readonly tempoBpm: number
  /** Replay identical offsets every loop pass (bar dropped from noise). */
  readonly locked?: boolean
}

export interface HumanizeInputEvent {
  readonly articulation: DrumVoiceId
  readonly bar: number
  /** Sixteenth position within the bar, 0..15. */
  readonly step: number
  readonly velocity: number
  readonly accent?: boolean
}

export interface HumanizeOrnament {
  readonly kind: 'flam'
  /** Grace note lead before the main hit, milliseconds. */
  readonly leadMs: number
  readonly velocity: number
}

export interface HumanizedEvent {
  /** Total shift from the grid, swing included; positive is late. */
  readonly timeOffsetMs: number
  readonly velocity: number
  readonly ornaments: readonly HumanizeOrnament[]
}

export interface GhostSuggestion {
  readonly articulation: 'snare'
  readonly step: number
  readonly velocity: number
}

type InstrumentClass = 'hat' | 'kick' | 'other' | 'snare'

interface HumanizeStyleProfile {
  readonly swingLevel: 'eighth' | 'none' | 'sixteenth'
  /** Fixed sixteenth ratio; eighth level uses the tempo curve instead. */
  readonly swingRatio: number
  /** Kit-coherent lateness applied to snare/hats/ride, not the kick anchor. */
  readonly feelBiasMs: Readonly<Record<InstrumentClass, number>>
  readonly timingSdMs: Readonly<Record<InstrumentClass, number>>
  readonly driftRmsMs: number
  readonly driftCapMs: number
  readonly velocitySd: number
  readonly accent: {
    readonly down: number
    readonly eighthOff: number
    readonly sixteenthOff: number
  }
  readonly flamProb: number
  readonly ghostProb: number
  readonly earlyCapMs: number
  readonly lateCapMs: number
}

export const HUMANIZE_STYLE_PROFILES: Readonly<
  Record<HumanizeStyle, HumanizeStyleProfile>
> = Object.freeze({
  rock: Object.freeze({
    swingLevel: 'none',
    swingRatio: 1,
    feelBiasMs: Object.freeze({ kick: 0, snare: 3, hat: 3, other: 0 }),
    timingSdMs: Object.freeze({ kick: 5, snare: 3, hat: 4, other: 6 }),
    driftRmsMs: 4,
    driftCapMs: 10,
    velocitySd: 8,
    accent: { down: 1, eighthOff: 0.85, sixteenthOff: 0.7 },
    flamProb: 0.01,
    ghostProb: 0.1,
    earlyCapMs: 10,
    lateCapMs: 14,
  }),
  funk: Object.freeze({
    swingLevel: 'sixteenth',
    swingRatio: 1.2,
    feelBiasMs: Object.freeze({ kick: 0, snare: 6, hat: 6, other: 0 }),
    timingSdMs: Object.freeze({ kick: 6, snare: 4, hat: 5, other: 6 }),
    driftRmsMs: 5,
    driftCapMs: 12,
    velocitySd: 10,
    accent: { down: 1, eighthOff: 0.8, sixteenthOff: 0.65 },
    flamProb: 0.02,
    ghostProb: 0.35,
    earlyCapMs: 12,
    lateCapMs: 18,
  }),
  jazz: Object.freeze({
    swingLevel: 'eighth',
    swingRatio: 1,
    feelBiasMs: Object.freeze({ kick: 0, snare: 8, hat: -4, other: 0 }),
    timingSdMs: Object.freeze({ kick: 8, snare: 7, hat: 10, other: 9 }),
    driftRmsMs: 8,
    driftCapMs: 16,
    velocitySd: 12,
    accent: { down: 1, eighthOff: 0.75, sixteenthOff: 0.7 },
    flamProb: 0.03,
    ghostProb: 0.2,
    earlyCapMs: 14,
    lateCapMs: 22,
  }),
  latin: Object.freeze({
    swingLevel: 'sixteenth',
    swingRatio: 1.08,
    feelBiasMs: Object.freeze({ kick: 0, snare: 0, hat: 0, other: 0 }),
    timingSdMs: Object.freeze({ kick: 6, snare: 5, hat: 7, other: 7 }),
    driftRmsMs: 6,
    driftCapMs: 12,
    velocitySd: 10,
    accent: { down: 1, eighthOff: 0.85, sixteenthOff: 0.75 },
    flamProb: 0.02,
    ghostProb: 0.15,
    earlyCapMs: 12,
    lateCapMs: 18,
  }),
  electronic: Object.freeze({
    swingLevel: 'none',
    swingRatio: 1,
    feelBiasMs: Object.freeze({ kick: 0, snare: 0, hat: 0, other: 0 }),
    timingSdMs: Object.freeze({ kick: 1, snare: 1, hat: 1.5, other: 2 }),
    driftRmsMs: 1,
    driftCapMs: 3,
    velocitySd: 2,
    accent: { down: 1, eighthOff: 0.9, sixteenthOff: 0.8 },
    flamProb: 0,
    ghostProb: 0,
    earlyCapMs: 3,
    lateCapMs: 3,
  }),
})

// Reserved PRNG stream ids so every random purpose reads independent draws.
const STREAM_DRIFT = 101
const STREAM_PINK = 102
const STREAM_VELOCITY = 103
const STREAM_FLAM = 104
const STREAM_GHOST = 105

const PINK_ROWS = 5
/** sd of one uniform(-1, 1) row; normalizes the row sum to unit variance. */
const PINK_ROW_SD = Math.sqrt(1 / 3)
const DRIFT_LEAK = 0.985
/** Stationary sd multiplier for the leaky walk fed by uniform(-1, 1). */
const DRIFT_STATIONARY = PINK_ROW_SD / Math.sqrt(1 - DRIFT_LEAK * DRIFT_LEAK)
const FLAM_VELOCITY_RATIO = 0.55
/** Perceived flam range: below is a doubled hit, above is two separate notes. */
const MIN_FLAM_LEAD_MS = 15
const MAX_FLAM_LEAD_MS = 35
const GHOST_VELOCITY_MEAN = 28
const GHOST_VELOCITY_SD = 6

interface GeneratedPositionRows {
  readonly offMeanMs: readonly (number | null)[]
  readonly offSdMs: readonly (number | null)[]
  readonly velMean: readonly (number | null)[]
  readonly velSd: readonly (number | null)[]
}

interface GeneratedStyle {
  readonly positions: Readonly<Record<string, GeneratedPositionRows>>
  readonly ghostProb: number
  readonly ghostVel: readonly number[] | null
  readonly flamProb: number
  readonly flamLeadMs: readonly number[] | null
}

interface GeneratedProfiles {
  readonly schemaVersion: number
  readonly styles: Readonly<Record<string, GeneratedStyle>>
}

/**
 * One measured cell, already reshaped for runtime use.
 *
 * The dataset's raw spread runs 10-25 ms, which lands in the range listeners
 * rate as sloppy, so magnitudes are NOT taken literally: the tables supply the
 * *shape* of real playing — which positions sit late, which are looser, where
 * the accents fall — and that shape is renormalized onto the literature-
 * anchored per-style magnitudes. Means are the exception: they are small and
 * meaningful, so they pass through under a bound.
 */
interface ProfileCell {
  /** Measured residual mean for this position, bounded (ms). */
  readonly offMeanMs: number
  /** Timing looseness relative to this articulation's own average. */
  readonly offSdScale: number
  /** Accent shape relative to this articulation's own average velocity. */
  readonly velScale: number
  /** Velocity spread relative to this articulation's own average. */
  readonly velSdScale: number
}

const PROFILES = generatedProfiles as unknown as GeneratedProfiles
/** Measured means beyond this are treated as dataset artifacts, not feel. */
const MAX_TABLE_MEAN_MS = 12
/** Shape multipliers stay near 1 so no position collapses or explodes. */
const MIN_SHAPE_SCALE = 0.4
const MAX_SHAPE_SCALE = 2
/** The accent shape nudges authored velocity; it never replaces intent. */
const ACCENT_TABLE_WEIGHT = 0.35
const MAX_ACCENT_TABLE_DELTA = 25

function clampRange(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function rowMean(row: readonly (number | null)[]): number {
  let sum = 0
  let count = 0
  for (const value of row) {
    if (value !== null && Number.isFinite(value)) {
      sum += value
      count += 1
    }
  }
  return count === 0 ? 0 : sum / count
}

function buildStyleCells(
  style: GeneratedStyle,
): Map<string, readonly (ProfileCell | null)[]> {
  const byArticulation = new Map<string, readonly (ProfileCell | null)[]>()
  for (const [articulation, rows] of Object.entries(style.positions)) {
    const meanOffSd = rowMean(rows.offSdMs)
    const meanVel = rowMean(rows.velMean)
    const meanVelSd = rowMean(rows.velSd)
    const cells: (ProfileCell | null)[] = []
    for (let step = 0; step < 16; step += 1) {
      const offMean = rows.offMeanMs[step]
      const offSd = rows.offSdMs[step]
      const vel = rows.velMean[step]
      const velSd = rows.velSd[step]
      if (
        offMean === null ||
        offSd === null ||
        vel === null ||
        velSd === null ||
        meanOffSd <= 0 ||
        meanVel <= 0 ||
        meanVelSd <= 0
      ) {
        cells.push(null)
        continue
      }
      cells.push({
        offMeanMs: clampRange(offMean, -MAX_TABLE_MEAN_MS, MAX_TABLE_MEAN_MS),
        offSdScale: clampRange(
          offSd / meanOffSd,
          MIN_SHAPE_SCALE,
          MAX_SHAPE_SCALE,
        ),
        velScale: clampRange(vel / meanVel, MIN_SHAPE_SCALE, MAX_SHAPE_SCALE),
        velSdScale: clampRange(
          velSd / meanVelSd,
          MIN_SHAPE_SCALE,
          MAX_SHAPE_SCALE,
        ),
      })
    }
    byArticulation.set(articulation, cells)
  }
  return byArticulation
}

const PROFILE_CELLS: ReadonlyMap<
  string,
  ReadonlyMap<string, readonly (ProfileCell | null)[]>
> = new Map(
  Object.entries(PROFILES.styles).map(([style, data]) => [
    style,
    buildStyleCells(data),
  ]),
)

/** Measured cell for one position, or null when the dataset had no evidence. */
export function measuredProfileCell(
  style: HumanizeStyle,
  articulation: DrumVoiceId,
  step: number,
): ProfileCell | null {
  const cells = PROFILE_CELLS.get(style)?.get(articulation)
  if (cells === undefined) return null
  return cells[((step % 16) + 16) % 16] ?? null
}

function measuredStyle(style: HumanizeStyle): GeneratedStyle | null {
  return PROFILES.styles[style] ?? null
}

function instrumentClass(articulation: DrumVoiceId): InstrumentClass {
  if (articulation === 'kick') return 'kick'
  if (articulation === 'snare' || articulation === 'sidestick') return 'snare'
  if (
    articulation === 'hh-closed' ||
    articulation === 'hh-pedal' ||
    articulation === 'hh-open' ||
    articulation === 'ride'
  ) {
    return 'hat'
  }
  return 'other'
}

function uniform(seed: number, ...stream: number[]): number {
  return mulberry32(fnv1a32(seed, ...stream))()
}

/** Standard normal from two hashed uniforms (Box-Muller). */
function gaussianAt(seed: number, ...stream: number[]): number {
  const u = Math.max(uniform(seed, ...stream, 1), 1e-12)
  const v = uniform(seed, ...stream, 2)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Friberg & Sundström jazz swing ratio: 3.5 slow, linear to 1.0 at 300 BPM. */
export function swingRatioForTempo(tempoBpm: number): number {
  const beatMs = 60_000 / Math.max(1, tempoBpm)
  const shortMs = Math.max(100, beatMs / 4.5)
  return Math.min(3.5, Math.max(1, (beatMs - shortMs) / shortMs))
}

/**
 * Late-only structural swing shift for a sixteenth position. Eighth-level
 * swing (jazz) follows the tempo curve; sixteenth-level uses the style's
 * fixed ratio. On-beats never move.
 */
export function swingShiftMs(
  style: HumanizeStyle,
  step: number,
  tempoBpm: number,
): number {
  const profile = HUMANIZE_STYLE_PROFILES[style]
  const beatMs = 60_000 / Math.max(1, tempoBpm)
  if (profile.swingLevel === 'eighth') {
    if (step % 4 !== 2) return 0
    const ratio = swingRatioForTempo(tempoBpm)
    return beatMs * (ratio / (1 + ratio) - 0.5)
  }
  if (profile.swingLevel === 'sixteenth') {
    if (step % 2 !== 1) return 0
    const ratio = profile.swingRatio
    return (beatMs / 2) * (ratio / (1 + ratio) - 0.5)
  }
  return 0
}

/** Voss-McCartney pink noise sampled functionally at an absolute step index. */
function pinkNoiseAt(
  seed: number,
  instrument: InstrumentClass,
  index: number,
): number {
  const instrumentTag = ['kick', 'snare', 'hat', 'other'].indexOf(instrument)
  let sum = 0
  for (let row = 0; row < PINK_ROWS; row += 1) {
    const cell = Math.floor(index / 2 ** row)
    sum += uniform(seed, STREAM_PINK, instrumentTag, row, cell) * 2 - 1
  }
  return sum / (Math.sqrt(PINK_ROWS) * PINK_ROW_SD)
}

/** Shared leaky drift walk, evaluated for indexes 0..maxIndex inclusive. */
function driftSeries(
  seed: number,
  profile: HumanizeStyleProfile,
  maxIndex: number,
): number[] {
  const sigma = profile.driftRmsMs / DRIFT_STATIONARY
  const series: number[] = new Array(maxIndex + 1)
  let value = 0
  for (let index = 0; index <= maxIndex; index += 1) {
    const draw = uniform(seed, STREAM_DRIFT, index) * 2 - 1
    value = DRIFT_LEAK * value + sigma * draw
    value = Math.min(profile.driftCapMs, Math.max(-profile.driftCapMs, value))
    series[index] = value
  }
  return series
}

function accentMultiplier(profile: HumanizeStyleProfile, step: number): number {
  if (step % 4 === 0) return profile.accent.down
  if (step % 4 === 2) return profile.accent.eighthOff
  return profile.accent.sixteenthOff
}

export function humanizeDrumEvents(
  events: readonly HumanizeInputEvent[],
  options: HumanizeOptions,
): HumanizedEvent[] {
  const profile = HUMANIZE_STYLE_PROFILES[options.style]
  const intensity = Math.min(1, Math.max(0, options.intensity))
  const locked = options.locked === true
  const biasWeight = Math.min(1, intensity * 1.25)

  const noiseIndex = (event: HumanizeInputEvent): number =>
    locked ? event.step : event.bar * 16 + event.step

  let maxIndex = 0
  for (const event of events) maxIndex = Math.max(maxIndex, noiseIndex(event))
  const drift = driftSeries(options.seed, profile, maxIndex)

  return events.map((event) => {
    const instrument = instrumentClass(event.articulation)
    const index = noiseIndex(event)
    const swing = swingShiftMs(options.style, event.step, options.tempoBpm)

    const measured = measuredProfileCell(
      options.style,
      event.articulation,
      event.step,
    )
    const bias =
      (profile.feelBiasMs[instrument] + (measured?.offMeanMs ?? 0)) * biasWeight
    const pink =
      pinkNoiseAt(options.seed, instrument, index) *
      profile.timingSdMs[instrument] *
      (measured?.offSdScale ?? 1) *
      intensity
    const wobble = bias + drift[index] * intensity + pink
    const clamped = Math.min(
      profile.lateCapMs,
      Math.max(-profile.earlyCapMs, wobble),
    )

    // Measured accents nudge the authored velocity toward how drummers
    // actually shade this position; hand tables cover what was never measured.
    const accentDelta =
      measured === null
        ? (accentMultiplier(profile, event.step) - 1) *
          event.velocity *
          biasWeight
        : clampRange(
            (measured.velScale - 1) *
              event.velocity *
              biasWeight *
              ACCENT_TABLE_WEIGHT,
            -MAX_ACCENT_TABLE_DELTA,
            MAX_ACCENT_TABLE_DELTA,
          )
    const velocityNoise =
      gaussianAt(options.seed, STREAM_VELOCITY, instrument.length, index) *
      profile.velocitySd *
      (measured?.velSdScale ?? 1) *
      intensity
    const velocity = Math.min(
      127,
      Math.max(1, Math.round(event.velocity + accentDelta + velocityNoise)),
    )

    const ornaments: HumanizeOrnament[] = []
    const measuredStyleData = measuredStyle(options.style)
    const flamProb =
      profile.flamProb > 0 && measuredStyleData !== null
        ? measuredStyleData.flamProb
        : profile.flamProb
    if (
      event.accent === true &&
      event.articulation === 'snare' &&
      flamProb > 0 &&
      uniform(options.seed, STREAM_FLAM, event.bar, event.step) <
        flamProb * intensity
    ) {
      const measuredLead = measuredStyleData?.flamLeadMs?.[0]
      const leadCenter =
        measuredLead !== undefined && Number.isFinite(measuredLead)
          ? clampRange(measuredLead, MIN_FLAM_LEAD_MS, MAX_FLAM_LEAD_MS)
          : 25
      const lead =
        leadCenter +
        (uniform(options.seed, STREAM_FLAM, event.bar, event.step, 7) * 2 - 1) *
          10
      ornaments.push({
        kind: 'flam',
        leadMs: clampRange(lead, MIN_FLAM_LEAD_MS, MAX_FLAM_LEAD_MS),
        velocity: Math.max(1, Math.round(velocity * FLAM_VELOCITY_RATIO)),
      })
    }

    return {
      timeOffsetMs: swing + clamped,
      velocity,
      ornaments,
    }
  })
}

/**
 * Deterministic snare-ghost proposals for the free sixteenths of one bar.
 * Callers own placement into their grid; electronic style never ghosts.
 */
export function suggestGhostSteps(
  occupiedSteps: ReadonlySet<number>,
  bar: number,
  options: HumanizeOptions,
): GhostSuggestion[] {
  const profile = HUMANIZE_STYLE_PROFILES[options.style]
  const intensity = Math.min(1, Math.max(0, options.intensity))
  const measuredStyleData = measuredStyle(options.style)
  const baseProb =
    profile.ghostProb > 0 && measuredStyleData !== null
      ? measuredStyleData.ghostProb
      : profile.ghostProb
  const probability = baseProb * intensity
  if (probability <= 0) return []
  const measuredGhostVel = measuredStyleData?.ghostVel?.[0]
  const ghostCenter =
    measuredGhostVel !== undefined && Number.isFinite(measuredGhostVel)
      ? clampRange(measuredGhostVel, 15, 40)
      : GHOST_VELOCITY_MEAN
  const ghosts: GhostSuggestion[] = []
  for (let step = 0; step < 16; step += 1) {
    if (occupiedSteps.has(step)) continue
    if (uniform(options.seed, STREAM_GHOST, bar, step) >= probability) continue
    const velocity = Math.min(
      40,
      Math.max(
        15,
        Math.round(
          ghostCenter +
            gaussianAt(options.seed, STREAM_GHOST, bar, step, 3) *
              GHOST_VELOCITY_SD,
        ),
      ),
    )
    ghosts.push({ articulation: 'snare', step, velocity })
  }
  return ghosts
}
