// ============================================================
// Piano song adapter — pure conversions at the legacy/runtime boundary
// ============================================================
//
// Keep file-import, falling-note and score-rendering shapes out of the page
// component. These functions preserve beat positions exactly and do not own
// playback state, clocks or browser capabilities.

import type { MidiSongNote } from '@/lib/midi-song'
import { midiToNoteName } from '@/lib/note-utils'
import { midiToFreq, midiToNote } from '@/lib/scale-data'
import type { FallingNote } from '@/stores/falling-notes-store'
import type { MelodyItem } from '@/types'

export function melodyItemsToFallingNotes(
  items: readonly MelodyItem[],
): FallingNote[] {
  return items.map((item, index) => ({
    id: item.id ?? index,
    midi: item.note.midi,
    name: item.note.name,
    startBeat: item.startBeat,
    duration: item.duration,
    targetFreq: item.note.freq,
  }))
}

export function midiSongNotesToFallingNotes(
  notes: readonly MidiSongNote[],
): FallingNote[] {
  return notes.map((note, index) => ({
    id: index,
    midi: note.midi,
    name: midiToNoteName(note.midi),
    startBeat: note.startBeat,
    duration: note.duration,
    targetFreq: midiToFreq(note.midi),
  }))
}

export function fallingNotesToMelodyItems(
  notes: readonly FallingNote[],
): MelodyItem[] {
  return notes
    .filter((note) => note.isBacking !== true)
    .map((note) => {
      const { name, octave } = midiToNote(note.midi)
      return {
        id: note.id,
        note: {
          midi: note.midi,
          name,
          octave,
          freq: note.targetFreq,
        },
        startBeat: note.startBeat,
        duration: note.duration,
      }
    })
}
