// ============================================================
// Drum feel preference — one persisted setting for the humanizer
// ============================================================
//
// The route reads this once and writes it on every change. Storage is treated
// as hostile: a private window, cleared site data, or a browser that throws on
// access all resolve to the defaults rather than breaking the page. Feel stays
// off until asked for, and imported files keep their authored timing unless
// the user opts in — their velocity and microtiming are already evidence.

import type { HumanizeStyle } from './groove-humanize'

export const DRUM_FEEL_STORAGE_KEY = 'mercurypitch_drum_feel'

const STYLES: readonly HumanizeStyle[] = [
  'rock',
  'funk',
  'jazz',
  'latin',
  'electronic',
]

export interface DrumFeelSettings {
  readonly enabled: boolean
  readonly style: HumanizeStyle
  /** 0 keeps swing only; 1 reaches real-performance magnitudes. */
  readonly intensity: number
  /** Replay identical feel on every loop pass. */
  readonly locked: boolean
  /** Imported MIDI and GP files carry authored timing; off by default. */
  readonly applyToImported: boolean
}

export const DEFAULT_DRUM_FEEL_SETTINGS: DrumFeelSettings = Object.freeze({
  enabled: false,
  style: 'rock',
  intensity: 0.6,
  locked: false,
  applyToImported: false,
})

export function isHumanizeStyle(value: unknown): value is HumanizeStyle {
  return typeof value === 'string' && STYLES.includes(value as HumanizeStyle)
}

function boolField(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function readDrumFeelSettings(
  storage: Storage | null,
): DrumFeelSettings {
  if (storage === null) return DEFAULT_DRUM_FEEL_SETTINGS
  let raw: string | null
  try {
    raw = storage.getItem(DRUM_FEEL_STORAGE_KEY)
  } catch {
    return DEFAULT_DRUM_FEEL_SETTINGS
  }
  if (raw === null) return DEFAULT_DRUM_FEEL_SETTINGS
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_DRUM_FEEL_SETTINGS
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_DRUM_FEEL_SETTINGS
  }
  const value = parsed as Record<string, unknown>
  const intensity = value.intensity
  return {
    enabled: boolField(value.enabled, DEFAULT_DRUM_FEEL_SETTINGS.enabled),
    style: isHumanizeStyle(value.style)
      ? value.style
      : DEFAULT_DRUM_FEEL_SETTINGS.style,
    intensity:
      typeof intensity === 'number' && Number.isFinite(intensity)
        ? Math.min(1, Math.max(0, intensity))
        : DEFAULT_DRUM_FEEL_SETTINGS.intensity,
    locked: boolField(value.locked, DEFAULT_DRUM_FEEL_SETTINGS.locked),
    applyToImported: boolField(
      value.applyToImported,
      DEFAULT_DRUM_FEEL_SETTINGS.applyToImported,
    ),
  }
}

export function writeDrumFeelSettings(
  storage: Storage | null,
  settings: DrumFeelSettings,
): void {
  if (storage === null) return
  try {
    storage.setItem(DRUM_FEEL_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // A full or locked-down store is not worth interrupting playback for.
  }
}

/** Null whenever the browser denies or lacks storage. */
export function browserDrumFeelStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
