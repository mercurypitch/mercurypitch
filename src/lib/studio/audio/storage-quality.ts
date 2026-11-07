// ============================================================
// Studio storage quality — Full quality or Save space for new audio, chosen on this device, and how much of each a song holds
// ============================================================
//
// Device-local, like the record settings (record-settings.ts) and the
// playback tier: the room a browser has is this device's, not a song's. The
// choice applies as audio is imported. A take keeps the format it came in
// with (StudioAsset.canonicalPcmFormat), so a change never touches a song
// already made, and one song can hold takes of both.
//
// Full quality, the default, keeps each take's ready-to-play copy as 32-bit
// floats, as every take was kept before. Save space keeps it as 16-bit
// steps (canonical-pcm16.ts), half the room: exact for a 16-bit 48 kHz WAV,
// and otherwise within half a step, 98 dB under the take's own peak.
// Playback, renders and exports run on floats either way. The original
// file is kept whole in both: it is the take's source.
//
// The Studio asks once, on the first import on a device. An answer the
// singer asks to remember is kept here; one not remembered lasts until the
// page is loaded again, and the next visit asks again. A choice made in
// Song options is remembered. Storage that throws or is missing keeps the
// default for the session.
import { STUDIO_PROJECT_STORAGE_LIMITS } from '../model/storage-limits'
import type { CanonicalPcmFormat } from './canonical-pcm'
import { canonicalPcmByteLength } from './canonical-pcm'

export type StudioStorageQuality = 'full' | 'compact'

export interface StudioStorageSettings {
  readonly quality: StudioStorageQuality
  /** The singer chose and asked not to be asked again on this device. */
  readonly remembered: boolean
}

export const DEFAULT_STUDIO_STORAGE_SETTINGS: StudioStorageSettings = {
  quality: 'full',
  remembered: false,
}

const KEY = 'mercurypitch.studio.storage'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Settings from anything: a remembered choice only when both its parts fit. */
export function sanitizeStudioStorageSettings(
  value: unknown,
): StudioStorageSettings {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const quality = raw.quality
  return quality === 'full' || quality === 'compact'
    ? { quality, remembered: raw.remembered === true }
    : DEFAULT_STUDIO_STORAGE_SETTINGS
}

export function readStudioStorageSettings(): StudioStorageSettings {
  try {
    const raw = storage()?.getItem(KEY)
    return raw === null || raw === undefined || raw === ''
      ? DEFAULT_STUDIO_STORAGE_SETTINGS
      : sanitizeStudioStorageSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_STUDIO_STORAGE_SETTINGS
  }
}

/** Keeps `settings`, sanitized, and gives back what was kept. */
export function writeStudioStorageSettings(
  settings: StudioStorageSettings,
): StudioStorageSettings {
  const kept = sanitizeStudioStorageSettings(settings)
  try {
    storage()?.setItem(KEY, JSON.stringify(kept))
  } catch {
    // Private mode or storage off: the choice lasts this session.
  }
  return kept
}

/** This visit's answer, when it was not remembered: gone with the page. */
let visit: StudioStorageQuality | null = null
const listeners = new Set<(quality: StudioStorageQuality) => void>()

/**
 * The choice that holds now: the one remembered on this device, else this
 * visit's answer. Null until the singer has chosen, when an import asks.
 */
export function studioStorageChoice(): StudioStorageQuality | null {
  const kept = readStudioStorageSettings()
  return kept.remembered ? kept.quality : visit
}

/** How new audio is kept now: the choice, or Full quality before there is one. */
export function studioStorageQuality(): StudioStorageQuality {
  return studioStorageChoice() ?? DEFAULT_STUDIO_STORAGE_SETTINGS.quality
}

/** The singer's choice: for this visit, and kept on this device when `remember`. */
export function chooseStudioStorage(
  quality: StudioStorageQuality,
  remember: boolean,
): void {
  visit = quality
  if (remember) writeStudioStorageSettings({ quality, remembered: true })
  for (const listener of listeners) listener(quality)
}

export function subscribeStudioStorage(
  listener: (quality: StudioStorageQuality) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The canonical copy a quality keeps. */
export function studioCanonicalFormat(
  quality: StudioStorageQuality,
): CanonicalPcmFormat {
  return quality === 'compact' ? 'int16' : 'float32'
}

/** A take's shape, as the room it needs is counted. */
export interface StudioTakeShape {
  readonly frames: number
  readonly channels: 1 | 2
  /** The original file's size: it is kept whole. */
  readonly originalBytes: number
}

/** A WAV file's size: its 44-byte header and its samples. */
export function wavByteLength(
  frames: number,
  channels: number,
  bitsPerSample: 16 | 24,
): number {
  return 44 + frames * channels * (bitsPerSample / 8)
}

/**
 * The take the Studio's numbers are told in: four minutes of stereo at
 * 48 kHz, a 16-bit WAV. One is 132 MiB at Full quality, 88 MiB to Save
 * space.
 */
export const STUDIO_REFERENCE_TAKE: StudioTakeShape = {
  frames: 240 * 48_000,
  channels: 2,
  originalBytes: wavByteLength(240 * 48_000, 2, 16),
}

/** What a take costs a song's audio budget: its original and its canonical copy. */
export function studioTakeStorageBytes(
  take: StudioTakeShape,
  quality: StudioStorageQuality,
): number {
  return (
    take.originalBytes +
    canonicalPcmByteLength(
      take.frames,
      take.channels,
      studioCanonicalFormat(quality),
    )
  )
}

/**
 * How many takes like `take` one song holds, by the same count as the
 * storage budget (storage-limits.ts): 3 of the reference take at Full
 * quality, 5 to Save space.
 */
export function studioTakesPerSong(
  take: StudioTakeShape,
  quality: StudioStorageQuality,
): number {
  return Math.min(
    STUDIO_PROJECT_STORAGE_LIMITS.assetCount,
    Math.floor(
      STUDIO_PROJECT_STORAGE_LIMITS.audioBytes /
        studioTakeStorageBytes(take, quality),
    ),
  )
}
