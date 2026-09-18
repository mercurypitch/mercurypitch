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
  'muldjord',
  'crocell',
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
  /**
   * The credits this kit's licence obliges us to show, when it has any.
   *
   * Declared here rather than looked up: the manifest carries the same
   * `spdx` and `noticePath`, but importing it would pull the generated
   * sample catalogue into Guitar Night's first paint, which is the whole
   * point of this module. `src/tests/guitar-night-kit-credits.test.ts`
   * checks these against the manifest instead, so a kit that joins the
   * picker cannot ship without the notice its licence requires — which a
   * hardcoded `kitId === 'muldjord' || kitId === 'crocell'` in the picker
   * could, and did.
   */
  readonly credit?: GuitarNightDrumKitCredit
}

export interface GuitarNightDrumKitCredit {
  /** e.g. "Kit credits · CC BY 4.0" */
  readonly label: string
  /** The shipped notice, under `public/drum-night/kits/`. */
  readonly href: string
}

function kitCredit(spdx: string, notice: string): GuitarNightDrumKitCredit {
  return {
    label: `Kit credits · ${spdx.replace(/-/g, ' ')}`,
    href: `/drum-night/kits/${notice}`,
  }
}

/** Small UI descriptors, intentionally independent of the full kit manifest. */
export const GUITAR_NIGHT_DRUM_KIT_OPTIONS: readonly GuitarNightDrumSoundOption<GuitarNightDrumKitId>[] =
  Object.freeze([
    Object.freeze({ id: 'mercury-synth', label: 'Mercury Synth' }),
    Object.freeze({
      id: 'classic-gm',
      label: 'Classic GM',
      credit: kitCredit('Apache-2.0', 'classic-gm/LICENSE.md'),
    }),
    Object.freeze({
      id: 'studio',
      label: 'Studio',
      credit: kitCredit('CC0-1.0', 'studio/LICENSE.md'),
    }),
    Object.freeze({
      id: 'live',
      label: 'Live',
      credit: kitCredit('CC-BY-SA-4.0', 'live/LICENSE.md'),
    }),
    Object.freeze({ id: 'circuit', label: 'Circuit' }),
    Object.freeze({
      id: 'muldjord',
      label: 'Muldjord',
      credit: kitCredit('CC-BY-4.0', 'muldjord/LICENSE.md'),
    }),
    Object.freeze({
      id: 'crocell',
      label: 'Crocell',
      credit: kitCredit('CC-BY-4.0', 'crocell/LICENSE.md'),
    }),
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

export function isGuitarNightDrumKitId(
  value: unknown,
): value is GuitarNightDrumKitId {
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

/** The picker's credits for a kit, or null when its licence asks for none. */
export function guitarNightDrumKitCredit(
  kitId: GuitarNightDrumKitId,
): GuitarNightDrumKitCredit | null {
  return (
    GUITAR_NIGHT_DRUM_KIT_OPTIONS.find((option) => option.id === kitId)
      ?.credit ?? null
  )
}
