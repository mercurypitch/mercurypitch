// ============================================================
// Guitar Night drum sound preference — lightweight kit and feel identity
// ============================================================
//
// This module deliberately carries no Drum Night catalogue or humanizer
// import. Guitar Night can render the picker on first paint without pulling
// the generated sample catalogue or measured groove profiles into its entry
// chunk; the room resolves those capabilities only after Play.

export const GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY =
  'mercurypitch_guitar_drum_sound_v1'

export const GUITAR_NIGHT_DRUM_KIT_IDS = Object.freeze([
  'mercury-synth',
  'classic-gm',
  'studio',
  'live',
  'circuit',
] as const)

export type GuitarNightDrumKitId = (typeof GUITAR_NIGHT_DRUM_KIT_IDS)[number]

export const GUITAR_NIGHT_DRUM_FEEL_IDS = Object.freeze([
  'straight',
  'rock',
  'funk',
  'jazz',
  'latin',
  'electronic',
] as const)

export type GuitarNightDrumFeelId = (typeof GUITAR_NIGHT_DRUM_FEEL_IDS)[number]

export interface GuitarNightDrumSoundPreference {
  readonly kitId: GuitarNightDrumKitId
  /** Straight preserves the generated grid; other values use shipped feel. */
  readonly feelId: GuitarNightDrumFeelId
}

export interface GuitarNightDrumSoundOption<Id extends string> {
  readonly id: Id
  readonly label: string
}

/** Small UI descriptors, intentionally independent of the full kit manifest. */
export const GUITAR_NIGHT_DRUM_KIT_OPTIONS: readonly GuitarNightDrumSoundOption<GuitarNightDrumKitId>[] =
  Object.freeze([
    Object.freeze({ id: 'mercury-synth', label: 'Mercury Synth' }),
    Object.freeze({ id: 'classic-gm', label: 'Classic GM' }),
    Object.freeze({ id: 'studio', label: 'Studio' }),
    Object.freeze({ id: 'live', label: 'Live' }),
    Object.freeze({ id: 'circuit', label: 'Circuit' }),
  ])

export const GUITAR_NIGHT_DRUM_FEEL_OPTIONS: readonly GuitarNightDrumSoundOption<GuitarNightDrumFeelId>[] =
  Object.freeze([
    Object.freeze({ id: 'straight', label: 'Straight' }),
    Object.freeze({ id: 'rock', label: 'Rock' }),
    Object.freeze({ id: 'funk', label: 'Funk' }),
    Object.freeze({ id: 'jazz', label: 'Jazz' }),
    Object.freeze({ id: 'latin', label: 'Latin' }),
    Object.freeze({ id: 'electronic', label: 'Electronic' }),
  ])

export const DEFAULT_GUITAR_NIGHT_DRUM_SOUND: GuitarNightDrumSoundPreference =
  Object.freeze({
    kitId: 'mercury-synth',
    feelId: 'straight',
  })

function isGuitarNightDrumKitId(value: unknown): value is GuitarNightDrumKitId {
  return (
    typeof value === 'string' &&
    GUITAR_NIGHT_DRUM_KIT_IDS.includes(value as GuitarNightDrumKitId)
  )
}

function isGuitarNightDrumFeelId(
  value: unknown,
): value is GuitarNightDrumFeelId {
  return (
    typeof value === 'string' &&
    GUITAR_NIGHT_DRUM_FEEL_IDS.includes(value as GuitarNightDrumFeelId)
  )
}

export function readGuitarNightDrumSound(
  storage: Storage | null = browserGuitarNightDrumSoundStorage(),
): GuitarNightDrumSoundPreference {
  if (storage === null) return DEFAULT_GUITAR_NIGHT_DRUM_SOUND
  let raw: string | null
  try {
    raw = storage.getItem(GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY)
  } catch {
    return DEFAULT_GUITAR_NIGHT_DRUM_SOUND
  }
  if (raw === null) return DEFAULT_GUITAR_NIGHT_DRUM_SOUND
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return DEFAULT_GUITAR_NIGHT_DRUM_SOUND
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_GUITAR_NIGHT_DRUM_SOUND
  }
  const value = parsed as Record<string, unknown>
  return Object.freeze({
    kitId: isGuitarNightDrumKitId(value.kitId)
      ? value.kitId
      : DEFAULT_GUITAR_NIGHT_DRUM_SOUND.kitId,
    feelId: isGuitarNightDrumFeelId(value.feelId)
      ? value.feelId
      : DEFAULT_GUITAR_NIGHT_DRUM_SOUND.feelId,
  })
}

export function writeGuitarNightDrumSound(
  preference: GuitarNightDrumSoundPreference,
  storage: Storage | null = browserGuitarNightDrumSoundStorage(),
): void {
  if (storage === null) return
  const safePreference: GuitarNightDrumSoundPreference = {
    kitId: isGuitarNightDrumKitId(preference.kitId)
      ? preference.kitId
      : DEFAULT_GUITAR_NIGHT_DRUM_SOUND.kitId,
    feelId: isGuitarNightDrumFeelId(preference.feelId)
      ? preference.feelId
      : DEFAULT_GUITAR_NIGHT_DRUM_SOUND.feelId,
  }
  try {
    storage.setItem(
      GUITAR_NIGHT_DRUM_SOUND_STORAGE_KEY,
      JSON.stringify(safePreference),
    )
  } catch {
    // A denied or full local store must never block the room or its transport.
  }
}

/** Null whenever the browser denies or does not expose local storage. */
export function browserGuitarNightDrumSoundStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}
