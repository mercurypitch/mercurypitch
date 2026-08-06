// Scene-builder tests protect fingering, feedback, and host-specific display data.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { buildTabScene } from './build-tab-scene'
import { VELVET_DISPLAY } from './TabRenderer'

function note(overrides: Partial<GuitarNote> = {}): GuitarNote {
  return {
    id: 'note-1',
    midi: 64,
    noteName: 'E4',
    stringIndex: 0,
    fret: 0,
    startBeat: 2,
    duration: 1,
    targetFreq: 329.63,
    ...overrides,
  }
}

describe('buildTabScene', () => {
  it('preserves authored fingering and widens the standard tuning for extended guitars', () => {
    const scene = buildTabScene({
      notes: [note(), note({ id: 'low-b', midi: 35, stringIndex: 6, fret: 0 })],
      playheadBeat: 1,
      visibleBeatWindow: 0,
      showNoteLabels: true,
      showFretboard: true,
      display: VELVET_DISPLAY,
    })

    expect(scene.stringCount).toBe(7)
    expect(scene.openMidi).toEqual([64, 59, 55, 50, 45, 40, 35])
    expect(scene.notes[1]).toMatchObject({ stringIndex: 6, fret: 0 })
    expect(scene.visibleBeatWindow).toBe(1)
    expect(scene.display).toBe(VELVET_DISPLAY)
  })

  it('keeps backing notes unscored and maps recent input feedback onto the neck', () => {
    const scene = buildTabScene({
      notes: [note(), note({ id: 'backing', isBacking: true, startBeat: 4 })],
      playheadBeat: 2.1,
      visibleBeatWindow: 8,
      showNoteLabels: false,
      showFretboard: true,
      now: 1_000,
      feedback: {
        detectedMidi: 76,
        detectedClarity: 0.82,
        showUserNotes: true,
        hitResults: [
          {
            itemIndex: 'note-1',
            midiNote: 64,
            noteName: 'E4',
            stringIndex: 0,
            timing: 'perfect',
            score: 100,
            timestamp: 700,
          },
          {
            itemIndex: 'miss',
            midiNote: 64,
            noteName: 'E4',
            stringIndex: 0,
            timing: 'miss',
            score: 0,
            timestamp: 900,
          },
        ],
      },
    })

    expect(scene.notes[1]?.isBacking).toBe(true)
    expect(scene.hits).toHaveLength(1)
    expect(scene.hits[0]).toMatchObject({ stringIndex: 0, fret: 0 })
    expect(scene.detected).toEqual({
      stringIndex: 0,
      fret: 0,
      matchesTarget: true,
      clarity: 0.82,
    })
  })
})
