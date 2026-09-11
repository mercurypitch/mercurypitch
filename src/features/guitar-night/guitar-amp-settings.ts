// ============================================================
// Guitar Night amp settings — local tone presets with lossless Lite migration.
// ============================================================

import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, GUITAR_ELECTRIC_AMP_CABINETS, GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS, normalizeGuitarElectricAmpParameters, } from '@/lib/guitar/guitar-electric-amp'

export const GUITAR_NIGHT_AMP_SETTINGS_VERSION = 2 as const
export const GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY =
  'guitar-night-amp-settings-v2'
export const GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY =
  'guitar-night-amp-settings-v1'

type GuitarNightAmpLitePresetId = 'studio-clean' | 'edge' | 'crunch'
export type GuitarNightAmpCuratedPresetId =
  | 'tight'
  | 'articulate'
  | 'heavy'
  | 'lead'
  | GuitarNightAmpLitePresetId
export type GuitarNightAmpPresetId = GuitarNightAmpCuratedPresetId | 'custom'

type GuitarNightAmpTone = GuitarElectricAmpParameters & {
  engine: 'lite' | 'studio'
  head: NonNullable<GuitarElectricAmpParameters['head']>
  character: number
}

export interface GuitarNightAmpSettingsV2 extends GuitarNightAmpTone {
  readonly version: typeof GUITAR_NIGHT_AMP_SETTINGS_VERSION
  readonly presetId: GuitarNightAmpPresetId
}

export interface GuitarNightAmpPreset {
  readonly id: GuitarNightAmpCuratedPresetId
  readonly label: string
  readonly description: string
  readonly settings: GuitarNightAmpTone
}

function ampParameters(
  parameters: GuitarElectricAmpParameters,
): GuitarNightAmpTone {
  return Object.freeze({
    engine: 'lite',
    head: 'definition',
    character: 1,
    ...parameters,
  })
}

const STUDIO_PARAMETERS = ampParameters({
  enabled: true,
  engine: 'studio',
  head: 'definition',
  character: 1,
  drive: 0.7,
  bass: 0,
  mid: 0,
  treble: 0,
  presence: 0,
  output: 0.6,
  cabinet: 'balanced',
  asymmetry: 0,
})

export const GUITAR_NIGHT_AMP_PRESETS: readonly GuitarNightAmpPreset[] =
  Object.freeze([
    Object.freeze({
      id: 'tight',
      label: 'Tight',
      description: 'Focused distortion with a controlled low end.',
      settings: STUDIO_PARAMETERS,
    }),
    Object.freeze({
      id: 'articulate',
      label: 'Articulate',
      description:
        'A more open attack from the same Definition head and cabinet.',
      settings: ampParameters({ ...STUDIO_PARAMETERS, character: 0 }),
    }),
    Object.freeze({
      id: 'heavy',
      label: 'Heavy',
      description: 'The original stronger head, with the same cabinet IR.',
      settings: ampParameters({ ...STUDIO_PARAMETERS, head: 'heavy' }),
    }),
    Object.freeze({
      id: 'studio-clean',
      label: 'Studio clean',
      description: 'Lite: clear attack with gentle cabinet warmth.',
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
      description:
        'Lite: the familiar Guitar Night colour with a responsive edge.',
      settings: ampParameters({
        ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
        engine: 'lite',
      }),
    }),
    Object.freeze({
      id: 'crunch',
      label: 'Crunch',
      description: 'Lite: denser rhythm drive with a forward middle.',
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
      description:
        'Studio: sustaining solo drive with forward mids and a smoother edge.',
      settings: ampParameters({
        ...STUDIO_PARAMETERS,
        head: 'lead',
      }),
    }),
  ])

const CURATED_PRESET_IDS = GUITAR_NIGHT_AMP_PRESETS.map((preset) => preset.id)
const PRESET_IDS: readonly GuitarNightAmpPresetId[] = [
  ...CURATED_PRESET_IDS,
  'custom',
]
const LEGACY_PRESET_IDS = ['studio-clean', 'edge', 'crunch', 'lead', 'custom']
const NUMERIC_PARAMETER_KEYS = [
  'drive',
  'bass',
  'mid',
  'treble',
  'presence',
  'output',
  'asymmetry',
] as const

export const DEFAULT_GUITAR_NIGHT_AMP_SETTINGS: GuitarNightAmpSettingsV2 =
  Object.freeze({
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId: 'tight',
    ...STUDIO_PARAMETERS,
  })

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

function fallbackSettings(): GuitarNightAmpSettingsV2 {
  return { ...DEFAULT_GUITAR_NIGHT_AMP_SETTINGS }
}

/** Return a fresh, canonical copy of one curated amp preset. */
export function guitarNightAmpSettingsForPreset(
  presetId: GuitarNightAmpCuratedPresetId,
): GuitarNightAmpSettingsV2 {
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
 * A V1 preference keeps the exact Lite tone and bypass state. An incomplete or
 * unsupported envelope falls back as one unit; it never blends old and new
 * controls. The old Lite Lead becomes Custom without changing its sound;
 * only explicitly choosing the new Lead adopts the Studio head. Reading or
 * migrating does not rewrite either storage key.
 */
export function normalizeGuitarNightAmpSettings(
  value: unknown,
): GuitarNightAmpSettingsV2 {
  if (
    !isRecord(value) ||
    (value.version !== 1 &&
      value.version !== GUITAR_NIGHT_AMP_SETTINGS_VERSION) ||
    !isPresetId(value.presetId) ||
    typeof value.enabled !== 'boolean' ||
    !isCabinet(value.cabinet) ||
    !NUMERIC_PARAMETER_KEYS.every(
      (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
    )
  )
    return fallbackSettings()

  const legacy = value.version === 1
  if (
    legacy
      ? !LEGACY_PRESET_IDS.includes(value.presetId)
      : (value.engine !== 'lite' && value.engine !== 'studio') ||
        (value.head !== 'definition' &&
          value.head !== 'heavy' &&
          value.head !== 'lead') ||
        typeof value.character !== 'number' ||
        !Number.isFinite(value.character)
  )
    return fallbackSettings()

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
    engine: legacy ? 'lite' : (value.engine as 'lite' | 'studio'),
    head: legacy ? 'definition' : (value.head as GuitarNightAmpTone['head']),
    character: legacy ? 1 : (value.character as number),
  })
  return {
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId:
      value.presetId === 'lead' &&
      (parameters.engine !== 'studio' || parameters.head !== 'lead')
        ? 'custom'
        : value.presetId,
    ...ampParameters(parameters),
  }
}

/** Make a bounded custom state while retaining every untouched control. */
export function customizeGuitarNightAmpSettings(
  current: GuitarNightAmpSettingsV2,
  changes: Partial<GuitarElectricAmpParameters>,
): GuitarNightAmpSettingsV2 {
  return {
    version: GUITAR_NIGHT_AMP_SETTINGS_VERSION,
    presetId: 'custom',
    ...ampParameters(normalizeGuitarElectricAmpParameters(changes, current)),
  }
}

/** Read V2 first; use V1 only when the newer preference is absent. */
export function loadGuitarNightAmpSettings(): GuitarNightAmpSettingsV2 {
  try {
    const serialized =
      globalThis.localStorage?.getItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY) ??
      globalThis.localStorage?.getItem(GUITAR_NIGHT_AMP_LEGACY_STORAGE_KEY)
    if (serialized === null || serialized === undefined)
      return fallbackSettings()
    return normalizeGuitarNightAmpSettings(JSON.parse(serialized) as unknown)
  } catch {
    return fallbackSettings()
  }
}

/** Save a validated V2 preference without destroying the previous app's V1 copy. */
export function saveGuitarNightAmpSettings(
  settings: GuitarNightAmpSettingsV2,
): GuitarNightAmpSettingsV2 {
  const normalized = normalizeGuitarNightAmpSettings(settings)
  try {
    globalThis.localStorage?.setItem(
      GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    )
  } catch {
    // Preferences are non-essential; audio remains usable in private mode.
  }
  return normalized
}

/** Clear this version only; an older preference remains available for migration. */
export function clearGuitarNightAmpSettings(): void {
  try {
    globalThis.localStorage?.removeItem(GUITAR_NIGHT_AMP_SETTINGS_STORAGE_KEY)
  } catch {
    // Treat unavailable local storage exactly like an empty preference store.
  }
}

export const GUITAR_NIGHT_AMP_CONTROL_LIMITS =
  GUITAR_ELECTRIC_AMP_PARAMETER_LIMITS
