// ============================================================
// Studio take notes — the notes a MIDI lane's player played into a take, kept beside its audio for a notes viewer
// ============================================================
//
// A MIDI lane keeps the sound of its instrument as an ordinary take, and
// the notes that made the sound are kept too, in a plain shape a later
// notes viewer can read (Compose's piano roll, the stem mixer's note
// editor). Each note is logged at the clock time its sound started and
// stopped: the instrument's own times, so the notes line up with the audio.
// They are placed on the song as the take's audio is: its first sample on
// `heardFirst`, every later one 1/48000 s after. A loop's passes are windows
// of one take, so a note in a later pass sits past the range, where the
// take's audio does before its clip folds it in. Kept on this device by the
// take's id, never in the song: its validator refuses a field it does not
// know, so a song carrying one would not open in an older build.
import { STUDIO_SAMPLE_RATE } from '../model/types'

/** One note of a take, on the song's 48 kHz frames as the take's audio sits before any cut. */
export interface StudioTakeNote {
  readonly midi: number
  /** The key's MIDI velocity, 1 to 127. */
  readonly velocity: number
  readonly startFrame: number
  /** After `startFrame`: a note still held when the take ends, ends with it. */
  readonly endFrame: number
}

/** A note as it sounded, on the clock, in seconds; `end` null while it sounds. */
export interface StudioPlayedNote {
  readonly midi: number
  readonly velocity: number
  readonly start: number
  readonly end: number | null
}

/** Where a take sits: its first sample's song frame and clock time, and how long it ran. */
export interface StudioNotedTake {
  readonly heardFirst: number
  readonly capturedFrom: number
  readonly seconds: number
}

/** The most notes a take keeps, as a piano performance take does. */
export const STUDIO_TAKE_MAX_NOTES = 10_000
/** How long a log keeps a note: a take's five minutes, its count-in, and room. */
const LOG_SECONDS = 400

/** A MIDI velocity from the port's 0..1. */
export function midiVelocity(normalized: number): number {
  if (!Number.isFinite(normalized)) return 1
  return Math.min(127, Math.max(1, Math.round(normalized * 127)))
}

/** The notes played on an armed MIDI lane, as they sound, for the takes recorded meanwhile. */
export function createStudioNoteLog() {
  let played: {
    midi: number
    velocity: number
    start: number
    end: number | null
  }[] = []
  const sounding = new Map<string, (typeof played)[number]>()
  return {
    /** Voice `id` began to sound at `at`. */
    started(id: string, midi: number, velocity: number, at: number): void {
      // A note this old belongs to no take the recorder can still keep.
      played = played.filter(
        (note) => note.end === null || note.end > at - LOG_SECONDS,
      )
      const note = {
        midi,
        velocity: midiVelocity(velocity),
        start: at,
        end: null,
      }
      played.push(note)
      sounding.set(id, note)
    },
    /** Voice `id` stopped sounding at `at`. */
    stopped(id: string, at: number): void {
      const note = sounding.get(id)
      if (note === undefined) return
      sounding.delete(id)
      note.end = Math.max(note.start, at)
    },
    /** Every note kept, oldest first. */
    notes(): readonly StudioPlayedNote[] {
      return played.map((note) => ({ ...note }))
    },
  }
}

export type StudioNoteLog = ReturnType<typeof createStudioNoteLog>

/**
 * A take's notes on the song: the ones that began while it captured, each
 * ending by the take's end at the latest, in the order they began.
 */
export function studioTakeNotes(
  played: readonly StudioPlayedNote[],
  take: StudioNotedTake,
): StudioTakeNote[] {
  const end = take.capturedFrom + take.seconds
  const frameOf = (time: number) =>
    take.heardFirst +
    Math.round((time - take.capturedFrom) * STUDIO_SAMPLE_RATE)
  const notes: StudioTakeNote[] = []
  for (const note of played) {
    if (note.start < take.capturedFrom || note.start >= end) continue
    const startFrame = frameOf(note.start)
    const endFrame = Math.max(
      startFrame + 1,
      frameOf(Math.min(note.end ?? end, end)),
    )
    notes.push({
      midi: note.midi,
      velocity: note.velocity,
      startFrame,
      endFrame,
    })
    if (notes.length === STUDIO_TAKE_MAX_NOTES) break
  }
  return notes
}

const wholeIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max

function sanitizeNote(value: unknown): StudioTakeNote | null {
  const raw =
    typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {}
  const { midi, velocity, startFrame, endFrame } = raw
  if (!wholeIn(midi, 0, 127) || !wholeIn(velocity, 1, 127)) return null
  if (!wholeIn(startFrame, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER))
    return null
  if (!wholeIn(endFrame, startFrame + 1, Number.MAX_SAFE_INTEGER)) return null
  return { midi, velocity, startFrame, endFrame }
}

/** Notes as read back from storage: each whole, or left out; at most STUDIO_TAKE_MAX_NOTES. */
export function sanitizeStudioTakeNotes(value: unknown): StudioTakeNote[] {
  if (!Array.isArray(value)) return []
  const notes: StudioTakeNote[] = []
  for (const each of value) {
    const note = sanitizeNote(each)
    if (note !== null) notes.push(note)
    if (notes.length === STUDIO_TAKE_MAX_NOTES) break
  }
  return notes
}
