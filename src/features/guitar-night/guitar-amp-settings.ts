// Guitar Night amp settings — versioned, local-only amplifier preferences.
// ============================================================

import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, GUITAR_ELECTRIC_AMP_CABINETS, GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS, normalizeGuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'

export const GUITAR_NIGHT_AMP_SETTINGS_VERSION = 1 as const
export const GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY =
  'guitar-night-amp-settings-v1'

export type GuitarNightAmpCuratedPresetId =
  | 'studio-clean'
  | 'edge'
  | 'crunch'
  | 'lead'

export type GuitarNightAmpPresetId = GuitarNightAmpCuratedPresetId | 'custom'

export interface GuitarNightAmpSettingsV1 extends GuitarElectricAmpParameters {
  readonly version: typeof GUITAR_NIGHT_AMP_SETTINGS_VERSION
  readonly presetId: GuitarNightAmpPresetId
}

export interface GuitarNightAmpPreset {
  readonly id: GuitarNightAmpCuratedPresetId
  readonly label: string
  readonly description: string
  readonly settings: GuitarElectricAmpParameters
}

function ampParameters(
  parameters: GuitarElectricAmpParameters,
): GuitarElectricAmpParameters {
  return Object.freeze({ ...parameters })
}

export const GUITAR_NIGHT_AMP_PRESETS: readonly GuitarNightAmpPreset[] =
  Object.freeze([
    Object.freeze({
      id: 'studio-clean',
      label: 'Studio clean',
      description: 'Clear attack with gentle cabinet warmth.',
      settings: ampParameters({
        enabled: true,
        drive: 0.22,
        bass: 0.08,
        mid: -0.1,
        treble: 0.08,
        presence: -0.04,
        output: 0.72,
        cabinet: 'open',
        asymmetry: 0.04,
      }),
    }),
    Object.freeze({
      id: 'edge',
      label: 'Edge',
      description: 'The familiar Guitar Night colour with a responsive edge.',
      settings: ampParameters(DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS),
    }),
    Object.freeze({
      id: 'crunch',
      label: 'Crunch',
      description: 'Denser rhythm drive with a forward middle.',
      settings: ampParameters({
        enabled: true,
        drive: 0.68,
        bass: -0.04,
        mid: 0.24,
        treble: -0.18,
        presence: 0.06,
        output: 0.4,
        cabinet: 'balanced',
        asymmetry: 0.32,
      }),
    }),
    Object.freeze({
      id: 'lead',
      label: 'Lead',
      description: 'Sustaining drive with focused mids and a darker cabinet.',
      settings: ampParameters({
        enabled: true,
        drive: 0.84,
        bass: -0.1,
        mid: 0.38,
        treble: -0.22,
        presence: 0.08,
        output: 0.25,
        cabinet: 'dark',
        asymmetry: 0.46,
      }),
    }),
  ])

const CURATED_PRESET_IDS = GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.id)
const PRESET_IDS: readonly GuitarNightAmpPresetId[] = [
  ...CURATED_PRESET_IDS,
  'custom',
]
const NUMERIC_PARAMETER_KEYS = [
  'drive',
  'bass',
  'mid',
  'treble',
  'presence',
  'output',
  'asymmetry',
] as const

export const DEFAULT_GUITAR_NIGHT_AMP_SETTINGS: GuitarNightAmpSettingsV1 =
  Object.freeze({
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId: 'edge',
    ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
  })

function cloneSettings(
  settings: GuitarNightAmpSettingsV1,
): GuitarNightAmpSettingsV1 {
  return { ...settings }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPresetId(value: unknown): value is GuitarNightAmpPresetId {
  return PRESET_IDS.some((presetId) => presetId === value)
}

export function isGuitarNightAmpCuratedPresetId(
  value: unknown,
): value is GuitarNightAmpCuratedPresetId {
  return CURATED_PRESET_IDS.some((presetId) => presetId === value)
}

function isCabinet(
  value: unknown,
): value is GuitarElectricAmpParameters['cabinet'] {
  return GUITAR_ELECTRIC_AMP_CABINETS.some((cabinet) => cabinet === value)
}

function hasFiniteNumericParameters(value: Record<string, unknown>): boolean {
  return NUMERIC_PARAMETER_KEYS.every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  )
}

function fallbackSettings(): GuitarNightAmpSettingsV1 {
  return cloneSettings(DEFAULT_GUITAR_NIGHT_AMP_SETTINGS)
}

/** Return a fresh, canonical copy of one curated amp preset. */
export function guitarNightAmpSettingsForPreset(
  presetId: GuitarNightAmpCuratedPresetId,
): GuitarNightAmpSettingsV1 {
  const preset = GUITAR_NIGHT_AMP_PRESETS.find(
    (candidate) => candidate.id === presetId,
  )
  if (preset === undefined) return fallbackSettings()
  return {
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId,
    ...preset.settings,
  }
}

/**
 * Validate the persisted envelope strictly, then clamp finite out-of-range
 * controls. Missing, non-finite, corrupt, and future-version states fall back
 * as one unit so a half-valid amp cannot surprise the listener.
 */
export function normalizeGuitarNightAmpSettings(
  value: unknown,
): GuitarNightAmpSettingsV1 {
  if (
    !isRecord(value) ||
    value.version !== GUITAR_NIGHT_AMP_SETTINGS_VERSION ||
    !isPresetId(value.presetId) ||
    typeof value.enabled !== 'boolean' ||
    !isCabinet(value.cabinet) ||
    !hasFiniteNumericParameters(value)
  ) {
    return fallbackSettings()
  }

  const parameters = normalizeGuitarElectricAmpParameters({
    enabled: value.enabled,
    drive: value.drive as number,
    bass: value.bass as number,
    mid: value.mid as number,
    treble: value.treble as number,
    presence: value.presence as number,
    output: value.output as number,
    cabinet: value.cabinet,
    asymmetry: value.asymmetry as number,
  })
  return {
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId: value.presetId,
    ...parameters,
  }
}

/** Make a bounded custom state while retaining every untouched control. */
export function customizeGuitarNightAmpSettings(
  current: GuitarNightAmpSettingsV1,
  changes: Partial<GuitarElectricAmpParameters>,
): GuitarNightAmpSettingsV1 {
  return {
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId: 'custom',
    ...normalizeGuitarElectricAmpParameters(changes, current),
  }
}

/** Read Guitar Night's local preference; no remote or IndexedDB fallback. */
export function loadGuitarNightAmpSettings(): GuitarNightAmpSettingsV1 {
  try {
    const serialized = globalThis.localStorage?.getItem(
      GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY,
    )
    if (serialized === null || serialized === undefined) {
      return fallbackSettings()
    }
    return normalizeGuitarNightAmpSettings(JSON.parse(serialized) as unknown)
  } catch {
    return fallbackSettings()
  }
}

/** Save only a validated V1 envelope and return the exact bounded state. */
export function saveGuitarNightAmpSettings(
  settings: GuitarNightAmpSettingsV1,
): GuitarNightAmpSettingsV1 {
  const normalized = normalizeGuitarNightAmpSettings(settings)
  try {
    globalThis.localStorage?.setItem(
      GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    )
  } catch {
    // Preferences are non-essential; audio must remain usable in private mode.
  }
  return normalized
}

export function clearGuitarNightAmpSettings(): void {
  try {
    globalThis.localStorage?.removeItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY)
  } catch {
    // Treat unavailable local storage exactly like an empty preference store.
  }
}

/** Expose numeric bounds to UI controls without duplicating DSP authority. */
export const GUITAR_NIGHT_AMP_CONTROL_LIMITS =
  GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS
