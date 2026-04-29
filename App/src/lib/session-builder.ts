import { buildMultiOctaveScale } from '@/lib/scale-data'
import { melodyStore } from '@/stores/melody-store'
import { keyName } from '@/stores'
import type { SessionItem, MelodyItem, MelodyNote, NoteName } from '@/types'

/**
 * Builds MelodyItems for a single session item.
 * 
 * Extracted from app-store to maintain pure functions separating
 * business logic from state containers.
 */
export function buildSessionItemMelody(item: SessionItem): MelodyItem[] {
  const fallbackNote: MelodyNote = { midi: 60, name: 'C', octave: 4, freq: 261.63 }

  if (item.type === 'scale') {
    const scaleType = item.scaleType ?? 'major'
    const beats = item.beats ?? 8
    const numOctaves = beats > 12 ? 2 : 1
    const currentOctave = melodyStore.getCurrentOctave()
    const scale = buildMultiOctaveScale(keyName(), currentOctave, numOctaves, scaleType)

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

  if (item.type === 'melody' && item.melodyId) {
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
