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
    expect(scene.presentation).toBe('fret-axis')
  })

  it('changes only presentation when the host selects the string highway', () => {
    const options = {
      notes: [note(), note({ id: 'next', stringIndex: 2, fret: 7 })],
      playheadBeat: 1,
      visibleBeatWindow: 8,
      showNoteLabels: true,
      showFretboard: true,
      now: 1_000,
      feedback: {
        detectedMidi: 64,
        detectedClarity: 0.82,
        showUserNotes: true,
        hitResults: [],
      },
    } as const
    const grid = buildTabScene(options)
    const highway = buildTabScene({
      ...options,
      presentation: 'string-highway',
    })

    expect(highway.presentation).toBe('string-highway')
    expect({ ...highway, presentation: grid.presentation }).toEqual(grid)
  })

  it('draws a four-string bass as four strings when the host declares it', () => {
    // Inference alone floors at six and fills the two extra rows from guitar
    // defaults, which puts phantom strings above a bass's own G string.
    const scene = buildTabScene({
      notes: [note({ id: 'low-e', midi: 28, stringIndex: 3, fret: 0 })],
      playheadBeat: 0,
      visibleBeatWindow: 8,
      showNoteLabels: true,
      showFretboard: true,
      tuning: { stringCount: 4, openMidi: [43, 38, 33, 28] },
    })

    expect(scene.stringCount).toBe(4)
    expect(scene.openMidi).toEqual([43, 38, 33, 28])
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

  it('uses sounding-open pitches for source tuning with a capo', () => {
    const notation = {
      chordLabel: 'E5',
      techniques: [{ kind: 'palm-mute' as const }],
    }
    const source = [
      note({
        id: 'capo-low-e',
        midi: 42,
        stringIndex: 5,
        fret: 0,
        startBeat: 0,
        notation,
      }),
    ]
    const scene = buildTabScene({
      notes: source,
      playheadBeat: 0,
      visibleBeatWindow: 8,
      showNoteLabels: true,
      showFretboard: true,
      tuning: {
        stringCount: 6,
        openMidi: [64, 59, 55, 50, 45, 40],
        capo: 2,
      },
      now: 1_000,
      feedback: {
        detectedMidi: 42,
        detectedClarity: 1,
        showUserNotes: true,
        hitResults: [
          {
            itemIndex: 'capo-low-e',
            midiNote: 42,
            noteName: 'F#2',
            stringIndex: 5,
            timing: 'perfect',
            score: 100,
            timestamp: 800,
          },
        ],
      },
    })

    expect(scene.openMidi).toEqual([66, 61, 57, 52, 47, 42])
    expect(scene.notes[0].notation).toBe(notation)
    expect(scene.events[0].chordLabel).toBe('E5')
    expect(scene.hits[0]).toMatchObject({ stringIndex: 5, fret: 0 })
    expect(scene.detected).toMatchObject({
      stringIndex: 5,
      fret: 0,
      matchesTarget: true,
    })
  })
})
