// ============================================================
// Studio record settings — count-in, click, monitoring, punch, the input and the line-up offset, kept on this device
// ============================================================
//
// Device-local, like the playback tier (playback-quality.ts): a count-in is
// a habit of the singer at this desk, and the line-up offset belongs to this
// device's microphone and speakers, not to a song. The input is this
// device's too: a microphone's id means nothing on another one. Storage that
// throws or is missing keeps the defaults for the session.
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
  /** With a range on the ruler, a take records only inside it (take-plan.ts). */
  readonly punch: boolean
  /** The microphone takes record from; null for the system's default. */
  readonly inputDeviceId: string | null
  /** Its name when it was chosen, to say which one went missing. */
  readonly inputLabel: string | null
}

export const DEFAULT_STUDIO_RECORD_SETTINGS: StudioRecordSettings = {
  countInBars: 1,
  click: false,
  monitor: false,
  offsetMs: 0,
  punch: false,
  inputDeviceId: null,
  inputLabel: null,
}

const flag = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback

/** A device id or name as kept: text, not too long, or none. */
const text = (value: unknown) =>
  typeof value === 'string' && value !== '' && value.length <= 512
    ? value
    : null

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
  const defaults = DEFAULT_STUDIO_RECORD_SETTINGS
  const inputDeviceId = text(raw.inputDeviceId)
  return {
    countInBars:
      bars === 0 || bars === 1 || bars === 2 ? bars : defaults.countInBars,
    click: flag(raw.click, defaults.click),
    monitor: flag(raw.monitor, defaults.monitor),
    punch: flag(raw.punch, defaults.punch),
    inputDeviceId,
    inputLabel: inputDeviceId === null ? null : text(raw.inputLabel),
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
