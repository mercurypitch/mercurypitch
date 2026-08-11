// Guitar input profiles keep capture routes explicit and take metadata truthful.
// ============================================================

export type GuitarInputProfileKind = 'microphone' | 'interface' | 'midi'

export interface GuitarInputDeviceOption {
  id: string
  label: string
}

/**
 * Memory-only route metadata pinned to a take. Labels are diagnostic context,
 * not identity; no raw input and no browser permission state enters a take.
 */
export interface GuitarInputProfileSnapshot {
  kind: GuitarInputProfileKind
  requestedDeviceId: string | null
  activeDeviceId: string | null
  activeDeviceLabel: string | null
}

export const GUITAR_INPUT_PROFILE_STORAGE_KEY = 'mp.guitarNight.inputProfile'
export const GUITAR_AUDIO_INPUT_STORAGE_KEY = 'mp.guitarInputDevice'
export const GUITAR_MIDI_INPUT_STORAGE_KEY = 'mp.guitarNight.midiInput'

export const DEFAULT_GUITAR_INPUT_PROFILE: GuitarInputProfileKind = 'microphone'

export function isGuitarInputProfileKind(
  value: unknown,
): value is GuitarInputProfileKind {
  return value === 'microphone' || value === 'interface' || value === 'midi'
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readStorage(key: string, storage: Storage | null): string | null {
  try {
    const value = storage?.getItem(key) ?? null
    return value !== null && value.length > 0 ? value : null
  } catch {
    return null
  }
}

function writeStorage(
  key: string,
  value: string | null,
  storage: Storage | null,
): void {
  try {
    if (value === null || value.length === 0) storage?.removeItem(key)
    else storage?.setItem(key, value)
  } catch {
    // A blocked storage area must not stop an input from opening.
  }
}

export function loadGuitarInputProfile(
  storage: Storage | null = browserStorage(),
): GuitarInputProfileKind {
  const saved = readStorage(GUITAR_INPUT_PROFILE_STORAGE_KEY, storage)
  return isGuitarInputProfileKind(saved) ? saved : DEFAULT_GUITAR_INPUT_PROFILE
}

export function saveGuitarInputProfile(
  kind: GuitarInputProfileKind,
  storage: Storage | null = browserStorage(),
): void {
  writeStorage(GUITAR_INPUT_PROFILE_STORAGE_KEY, kind, storage)
}

export function loadGuitarAudioInputId(
  storage: Storage | null = browserStorage(),
): string | null {
  return readStorage(GUITAR_AUDIO_INPUT_STORAGE_KEY, storage)
}

export function saveGuitarAudioInputId(
  deviceId: string | null,
  storage: Storage | null = browserStorage(),
): void {
  writeStorage(GUITAR_AUDIO_INPUT_STORAGE_KEY, deviceId, storage)
}

export function loadGuitarMidiInputId(
  storage: Storage | null = browserStorage(),
): string | null {
  return readStorage(GUITAR_MIDI_INPUT_STORAGE_KEY, storage)
}

export function saveGuitarMidiInputId(
  deviceId: string | null,
  storage: Storage | null = browserStorage(),
): void {
  writeStorage(GUITAR_MIDI_INPUT_STORAGE_KEY, deviceId, storage)
}

export function guitarInputProfileLabel(kind: GuitarInputProfileKind): string {
  if (kind === 'interface') return 'Plugged in'
  if (kind === 'midi') return 'MIDI'
  return 'Room mic'
}
