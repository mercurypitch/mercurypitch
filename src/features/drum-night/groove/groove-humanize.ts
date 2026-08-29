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
const GHOST_VELOCITY_MEAN = 28
const GHOST_VELOCITY_SD = 6

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

    const bias = profile.feelBiasMs[instrument] * biasWeight
    const pink =
      pinkNoiseAt(options.seed, instrument, index) *
      profile.timingSdMs[instrument] *
      intensity
    const wobble = bias + drift[index] * intensity + pink
    const clamped = Math.min(
      profile.lateCapMs,
      Math.max(-profile.earlyCapMs, wobble),
    )

    const accentDelta =
      (accentMultiplier(profile, event.step) - 1) * event.velocity * biasWeight
    const velocityNoise =
      gaussianAt(options.seed, STREAM_VELOCITY, instrument.length, index) *
      profile.velocitySd *
      intensity
    const velocity = Math.min(
      127,
      Math.max(1, Math.round(event.velocity + accentDelta + velocityNoise)),
    )

    const ornaments: HumanizeOrnament[] = []
    if (
      event.accent === true &&
      event.articulation === 'snare' &&
      profile.flamProb > 0 &&
      uniform(options.seed, STREAM_FLAM, event.bar, event.step) <
        profile.flamProb * intensity
    ) {
      const lead =
        25 +
        (uniform(options.seed, STREAM_FLAM, event.bar, event.step, 7) * 2 - 1) *
          10
      ornaments.push({
        kind: 'flam',
        leadMs: lead,
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
  const probability = profile.ghostProb * intensity
  if (probability <= 0) return []
  const ghosts: GhostSuggestion[] = []
  for (let step = 0; step < 16; step += 1) {
    if (occupiedSteps.has(step)) continue
    if (uniform(options.seed, STREAM_GHOST, bar, step) >= probability) continue
    const velocity = Math.min(
      40,
      Math.max(
        15,
        Math.round(
          GHOST_VELOCITY_MEAN +
            gaussianAt(options.seed, STREAM_GHOST, bar, step, 3) *
              GHOST_VELOCITY_SD,
        ),
      ),
    )
    ghosts.push({ articulation: 'snare', step, velocity })
  }
  return ghosts
}
