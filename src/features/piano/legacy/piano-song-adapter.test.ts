// ============================================================
// Piano song adapter tests — preserve notes and beat truth across view shapes
// ============================================================

import { describe, expect, it } from 'vitest'
import type { FallingNote } from '@/stores/falling-notes-store'
import type { MelodyItem } from '@/types'
import { fallingNotesToMelodyItems, melodyItemsToFallingNotes, midiSongNotesToFallingNotes, } from './piano-song-adapter'

describe('piano song adapters', () => {
  it('converts melody items without changing beat timing or pitch data', () => {
    const melody: MelodyItem[] = [
      {
        id: 42,
        note: { midi: 63, name: 'D#', octave: 4, freq: 311.13 },
        startBeat: 3.25,
        duration: 1.5,
      },
    ]

    expect(melodyItemsToFallingNotes(melody)).toEqual([
      {
        id: 42,
        midi: 63,
        name: 'D#',
        startBeat: 3.25,
        duration: 1.5,
        targetFreq: 311.13,
      },
    ])
  })

  it('derives display names and frequencies for imported MIDI notes', () => {
    expect(
      midiSongNotesToFallingNotes([
        { midi: 69, startBeat: 7.875, duration: 0.625 },
      ]),
    ).toEqual([
      {
        id: 0,
        midi: 69,
        name: 'A',
        startBeat: 7.875,
        duration: 0.625,
        targetFreq: 440,
      },
    ])
  })

  it('omits backing notes while preserving playable score timing', () => {
    const notes: FallingNote[] = [
      {
        id: 8,
        midi: 60,
        name: 'C',
        startBeat: 1.5,
        duration: 2.25,
        targetFreq: 261.63,
      },
      {
        id: 9,
        midi: 48,
        name: 'C',
        startBeat: 0,
        duration: 4,
        targetFreq: 130.81,
        isBacking: true,
        trackId: 'left-hand',
      },
    ]

    expect(fallingNotesToMelodyItems(notes)).toEqual([
      {
        id: 8,
        note: {
          midi: 60,
          name: 'C',
          octave: 4,
          freq: 261.63,
        },
        startBeat: 1.5,
        duration: 2.25,
      },
    ])
  })
})
