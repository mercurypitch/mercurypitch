import { buildMultiOctaveScale, melodyTotalBeats } from '@/lib/scale-data'
import { keyName } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type { MelodyItem, MelodyNote, NoteName, PlaybackSession, SessionItem, } from '@/types'

/**
 * Is this item pointing at a melody that no longer exists?
 *
 * Deleting a melody deliberately does NOT rewrite the sessions that reference
 * it: `restoreMelody` sits directly below `deleteMelody` as the undo, and
 * rewriting the sessions would make the undo bring back a melody with every
 * session item that used it already gone. So a session item is allowed to
 * point at nothing, and each reader has to say so.
 *
 * Derived rather than stored for the same reason — restoring the melody makes
 * the item whole again with no second write to keep in step.
 */
export function isSessionItemMelodyMissing(item: SessionItem): boolean {
  return (
    item.type === 'melody' &&
    item.melodyId !== null &&
    item.melodyId !== undefined &&
    melodyStore.getMelody(item.melodyId) === undefined
  )
}

/**
 * Builds MelodyItems for a single session item.
 *
 * Extracted from app-store to maintain pure functions separating
 * business logic from state containers.
 */
export function buildSessionItemMelody(item: SessionItem): MelodyItem[] {
  const fallbackNote: MelodyNote = {
    midi: 60,
    name: 'C',
    octave: 4,
    freq: 261.63,
  }

  if ((item.type as string) === 'scale') {
    const scaleType = item.scaleType ?? 'major'
    const beats = item.beats ?? 8
    const numOctaves = beats > 12 ? 2 : 1
    const currentOctave = melodyStore.getCurrentOctave()
    const scale = buildMultiOctaveScale(
      keyName(),
      currentOctave,
      numOctaves,
      scaleType,
    )

    // `buildMultiOctaveScale` cannot return an empty scale: an unparseable
    // custom scale yields null (parseCustomScaleDegrees returns null below two
    // degrees, never []), every SCALE_DEFINITIONS entry has degrees, and the
    // last resort is MAJOR_SCALE_INTERVALS. There used to be a second
    // single-note fallback here for the empty case; it could not run, and a
    // fallback that never fires still reads to the next person as a case that
    // happens. If one ever does arrive, the shared fallback below catches it.
    const numNotes = Math.min(scale.length, beats)
    return scale.slice(0, numNotes).map((note, i) => ({
      id: melodyStore.generateId(),
      note: {
        midi: note.midi,
        name: note.name as NoteName,
        octave: note.octave,
        freq: note.freq,
      },
      startBeat: i,
      duration: 1,
    }))
  }

  if (item.type === 'rest') {
    // Rest logic generally handled by skipping in the sequencer,
    // but if converted to melody it's essentially empty
    return []
  }

  if ((item.type as string) === 'preset') {
    if (item.items && item.items.length > 0) {
      return [...item.items].map((melodyItem) => ({
        ...melodyItem,
        id: melodyStore.generateId(),
      }))
    }
  }

  if (item.type === 'melody' && item.melodyId !== undefined) {
    const melody = melodyStore.getMelody(item.melodyId)
    if (melody && melody.items.length > 0) {
      return [...melody.items].map((melodyItem) => ({
        ...melodyItem,
        id: melodyStore.generateId(),
      }))
    }
    // A melody item resolves to ITS melody or to nothing at all. The fallback
    // below exists for scale and preset items, where a single sustained note
    // is a defensible stand-in for a source that produced nothing; here it
    // scored the singer against one C4 under the label of the melody they had
    // written, with no sign anywhere that the melody was gone. Empty makes the
    // item skippable, and `isSessionItemMelodyMissing` makes it sayable.
    return []
  }

  // Fallback
  return [
    {
      id: melodyStore.generateId(),
      note: fallbackNote,
      startBeat: 0,
      duration: 1,
    },
  ]
}

/**
 * Builds a single concatenated MelodyItem[] from all items of a PlaybackSession,
 * shifting each item's startBeats so they play sequentially.
 */
export function buildSessionPlaybackMelody(session: PlaybackSession): {
  items: MelodyItem[]
  durationBeats: number
} {
  const all: MelodyItem[] = []
  let offset = 0
  for (const item of session.items) {
    const built = buildSessionItemMelody(item)
    if (built.length === 0) {
      // For rest items, advance offset by their (approx) beat duration
      if (item.type === 'rest') {
        const restBeats = Math.max(1, Math.round((item.restMs ?? 2000) / 500))
        offset += restBeats
      }
      continue
    }
    const shifted = built.map((b) => ({
      ...b,
      id: melodyStore.generateId(),
      startBeat: b.startBeat + offset,
    }))
    all.push(...shifted)
    offset += melodyTotalBeats(built)
  }
  return { items: all, durationBeats: offset }
}

/**
 * Convenience helper: build a scale of `beats` notes into the melodyStore.
 * Intended for the editor and session sequencer fallback paths.
 */
export function buildScaleMelody(
  scaleType: string,
  beats: number,
  _label?: string,
): void {
  const items = buildSessionItemMelody({
    type: 'scale' as 'rest',
    scaleType,
    beats,
    label: _label,
  } as SessionItem)
  melodyStore.setMelody(items)
}
