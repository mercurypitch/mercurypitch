// ============================================================
// One continuous scale through the three room presets
// ============================================================
//
// Quiet, Home and Noisy are three points, and the owner's report is that the
// gap between two of them is where the right answer lives: "that noisy preset
// is really restrictive, it needs my mouth close to the mic and very loud ...
// I am considering something sort of a preset in between noisy and home".
//
// So the presets become stops on a 0-100 line rather than the only places you
// may stand. Position 0, 50 and 100 reproduce Quiet, Home and Noisy EXACTLY —
// that is the property the tests pin, because anyone who never touches the
// slider must keep the settings they already had. Everything between is a
// straight line from one stop to the next.
//
// Piecewise, not one line end to end: `sensitivity` runs 7 -> 5 -> 9, which is
// not monotonic. A single interpolation from 7 to 9 would silently move Home
// off its own value, and Home is the default every new singer starts on.

// Type-only import of the store, deliberately: the store imports this module
// at RUNTIME to apply a position, so a value import here would close a cycle
// around two module-level `createPersistedSignal` calls. Types are erased.
import type { SensitivityPreset, SettingsConfig } from '@/stores/settings-store'

/**
 * The three rooms. Lives here rather than in the store because the store now
 * reads it through this module — one direction only. Re-exported from
 * `settings-store` so existing importers do not care where it moved to.
 */
export const SENSITIVITY_PRESETS: Record<
  SensitivityPreset,
  Omit<SettingsConfig, 'bands' | 'tonicAnchor'>
> = {
  quiet: {
    detectionThreshold: 0.05,
    sensitivity: 7,
    minConfidence: 0.3,
    minAmplitude: 1,
  },
  home: {
    detectionThreshold: 0.1,
    sensitivity: 5,
    minConfidence: 0.5,
    minAmplitude: 2,
  },
  noisy: {
    detectionThreshold: 0.2,
    sensitivity: 9,
    minConfidence: 0.7,
    minAmplitude: 4,
  },
}

/** The tunable half of a room preset — what the slider actually moves. */
export type SensitivityConfig = Omit<SettingsConfig, 'bands' | 'tonicAnchor'>

export const SENSITIVITY_MIN_POSITION = 0
export const SENSITIVITY_MAX_POSITION = 100

/**
 * The named stops, in slider order: quietest room on the left, noisiest on
 * the right. Ordered by how much noise the setting expects, which is also the
 * order the labels read in.
 */
export const SENSITIVITY_STOPS: ReadonlyArray<{
  position: number
  preset: SensitivityPreset
}> = [
  { position: 0, preset: 'quiet' },
  { position: 50, preset: 'home' },
  { position: 100, preset: 'noisy' },
]

const clampPosition = (position: number): number => {
  if (!Number.isFinite(position)) return 0
  return Math.min(
    SENSITIVITY_MAX_POSITION,
    Math.max(SENSITIVITY_MIN_POSITION, position),
  )
}

/** Kept short of float noise, so persisted settings stay readable. */
const round = (value: number, places: number): number => {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

const mix = (from: number, to: number, t: number): number =>
  from + (to - from) * t

/** Where a named preset sits on the line. */
export function sensitivityPositionOf(preset: SensitivityPreset): number {
  return SENSITIVITY_STOPS.find((stop) => stop.preset === preset)?.position ?? 0
}

/**
 * The settings for any point on the line. At a stop this returns that
 * preset's own numbers untouched, not a rounded reconstruction of them.
 */
export function sensitivityConfigAt(position: number): SensitivityConfig {
  const at = clampPosition(position)

  const exact = SENSITIVITY_STOPS.find((stop) => stop.position === at)
  if (exact !== undefined) return { ...SENSITIVITY_PRESETS[exact.preset] }

  let lower = SENSITIVITY_STOPS[0]!
  let upper = SENSITIVITY_STOPS[SENSITIVITY_STOPS.length - 1]!
  for (let i = 0; i < SENSITIVITY_STOPS.length - 1; i += 1) {
    const a = SENSITIVITY_STOPS[i]!
    const b = SENSITIVITY_STOPS[i + 1]!
    if (at >= a.position && at <= b.position) {
      lower = a
      upper = b
      break
    }
  }

  const span = upper.position - lower.position
  const t = span === 0 ? 0 : (at - lower.position) / span
  const from = SENSITIVITY_PRESETS[lower.preset]
  const to = SENSITIVITY_PRESETS[upper.preset]

  return {
    detectionThreshold: round(
      mix(from.detectionThreshold, to.detectionThreshold, t),
      4,
    ),
    sensitivity: round(mix(from.sensitivity, to.sensitivity, t), 2),
    minConfidence: round(mix(from.minConfidence, to.minConfidence, t), 4),
    minAmplitude: round(mix(from.minAmplitude, to.minAmplitude, t), 2),
  }
}

/**
 * The stop a position reads as. This is the label shown above the slider —
 * the owner's "we auto select preset above". A tie goes to the quieter stop,
 * because the quieter setting is the one that lets more sound through, and
 * over-reporting how much a singer is being gated is the kinder error.
 */
export function nearestSensitivityPreset(position: number): SensitivityPreset {
  const at = clampPosition(position)
  let best = SENSITIVITY_STOPS[0]!
  for (const stop of SENSITIVITY_STOPS) {
    if (Math.abs(stop.position - at) < Math.abs(best.position - at)) best = stop
  }
  return best.preset
}

/**
 * True when a position IS a named stop rather than somewhere between two.
 * The label says "Home" either way; this is what lets the UI distinguish
 * "Home" from "between Home and Noisy" without inventing new preset names.
 */
export function isAtSensitivityStop(position: number): boolean {
  const at = clampPosition(position)
  return SENSITIVITY_STOPS.some((stop) => stop.position === at)
}

/**
 * Where an existing settings object sits on the line — for singers who set
 * their thresholds before the slider existed, and for the raw Pitch Detection
 * sliders in Settings, which can still write any values they like.
 *
 * Matched on `minAmplitude` because that is the RMS gate: the number that
 * decides whether a sound is heard at all, and the one the report is about.
 * Ties and out-of-range values resolve to the nearest stop.
 */
export function sensitivityPositionForConfig(
  config: Pick<SensitivityConfig, 'minAmplitude'>,
): number {
  const target = config.minAmplitude
  if (!Number.isFinite(target)) return 0

  let best = 0
  let bestDistance = Number.POSITIVE_INFINITY
  for (let position = 0; position <= 100; position += 1) {
    const distance = Math.abs(
      sensitivityConfigAt(position).minAmplitude - target,
    )
    if (distance < bestDistance) {
      bestDistance = distance
      best = position
    }
  }
  return best
}

const PRESET_LABELS: Record<SensitivityPreset, string> = {
  quiet: 'Quiet',
  home: 'Home',
  noisy: 'Noisy',
}

export function sensitivityPresetLabel(preset: SensitivityPreset): string {
  return PRESET_LABELS[preset]
}

/**
 * What to show above the slider. At a stop it is simply that room's name; in
 * between it names both neighbours, because "Home" alone would be a lie about
 * a gate that is halfway to Noisy — and the whole point of the slider is that
 * the singer chose to stand between two rooms.
 */
export function describeSensitivityPosition(position: number): string {
  const at = clampPosition(position)
  const exact = SENSITIVITY_STOPS.find((stop) => stop.position === at)
  if (exact !== undefined) return PRESET_LABELS[exact.preset]

  for (let i = 0; i < SENSITIVITY_STOPS.length - 1; i += 1) {
    const lower = SENSITIVITY_STOPS[i]!
    const upper = SENSITIVITY_STOPS[i + 1]!
    if (at > lower.position && at < upper.position) {
      return `Between ${PRESET_LABELS[lower.preset]} and ${PRESET_LABELS[upper.preset]}`
    }
  }
  return PRESET_LABELS[nearestSensitivityPreset(at)]
}
