// ============================================================
// Studio record settings — count-in, click, monitoring and the line-up offset, kept on this device
// ============================================================
//
// Device-local, like the playback tier (playback-quality.ts): a count-in is
// a habit of the singer at this desk, and the line-up offset belongs to this
// device's microphone and speakers, not to a song. Storage that throws or is
// missing keeps the defaults for the session.
import { MAX_RECORD_OFFSET_MS } from './take-timing'

export type StudioCountInBars = 0 | 1 | 2

export interface StudioRecordSettings {
  /** Bars of count-in before the playhead: none, one or two. */
  readonly countInBars: StudioCountInBars
  /** A click on every beat while the take records. */
  readonly click: boolean
  /** Hear the microphone through the speakers while armed and recording. */
  readonly monitor: boolean
  /** Moves new takes earlier (positive) or later, in whole ms. */
  readonly offsetMs: number
}

export const DEFAULT_STUDIO_RECORD_SETTINGS: StudioRecordSettings = {
  countInBars: 1,
  click: false,
  monitor: false,
  offsetMs: 0,
}

const KEY = 'mercurypitch.studio.recording'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Settings from anything: whatever does not fit keeps its default. */
export function sanitizeStudioRecordSettings(
  value: unknown,
): StudioRecordSettings {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const bars = raw.countInBars
  const offset = raw.offsetMs
  return {
    countInBars:
      bars === 0 || bars === 1 || bars === 2
        ? bars
        : DEFAULT_STUDIO_RECORD_SETTINGS.countInBars,
    click:
      typeof raw.click === 'boolean'
        ? raw.click
        : DEFAULT_STUDIO_RECORD_SETTINGS.click,
    monitor:
      typeof raw.monitor === 'boolean'
        ? raw.monitor
        : DEFAULT_STUDIO_RECORD_SETTINGS.monitor,
    offsetMs:
      typeof offset === 'number' && Number.isFinite(offset)
        ? Math.max(
            -MAX_RECORD_OFFSET_MS,
            Math.min(MAX_RECORD_OFFSET_MS, Math.round(offset)),
          )
        : DEFAULT_STUDIO_RECORD_SETTINGS.offsetMs,
  }
}

export function readStudioRecordSettings(): StudioRecordSettings {
  try {
    const raw = storage()?.getItem(KEY)
    return raw === null || raw === undefined || raw === ''
      ? DEFAULT_STUDIO_RECORD_SETTINGS
      : sanitizeStudioRecordSettings(JSON.parse(raw))
  } catch {
    return DEFAULT_STUDIO_RECORD_SETTINGS
  }
}

/** Keeps `settings`, sanitized, and gives back what was kept. */
export function writeStudioRecordSettings(
  settings: StudioRecordSettings,
): StudioRecordSettings {
  const kept = sanitizeStudioRecordSettings(settings)
  try {
    storage()?.setItem(KEY, JSON.stringify(kept))
  } catch {
    // Private mode or storage off: the settings last this session.
  }
  return kept
}
