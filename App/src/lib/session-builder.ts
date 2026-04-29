import { buildMultiOctaveScale, melodyTotalBeats } from '@/lib/scale-data'
import { keyName } from '@/stores'
import { melodyStore } from '@/stores/melody-store'
import type {
  MelodyItem,
  MelodyNote,
  NoteName,
  PlaybackSession,
  SessionItem,
} from '@/types'

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

  if (item.type === 'scale') {
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

    if (scale.length > 0) {
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
    return [
      {
        id: melodyStore.generateId(),
        note: fallbackNote,
        startBeat: 0,
        duration: beats,
      },
    ]
  }

  if (item.type === 'rest') {
    // Rest logic generally handled by skipping in the sequencer,
    // but if converted to melody it's essentially empty
    return []
  }

  if (item.type === 'preset') {
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
    type: 'scale',
    scaleType,
    beats,
    label: _label,
  } as SessionItem)
  melodyStore.setMelody(items)
}

