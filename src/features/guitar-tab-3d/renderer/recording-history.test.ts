// Recording history projects captured notes behind a real NOW, never as future targets.
import { describe, expect, it } from 'vitest'
import { buildTabScene } from './build-tab-scene'
import { nextTabEvent, visibleTabNotes } from './compile-tab-notes'
import { RECORDING_NOW_DEPTH, recordingNoteDepth } from './recording-history'

describe('recording history', () => {
  it('places new evidence at NOW and carries it toward the player without changing timestamps', () => {
    expect(recordingNoteDepth(20, 20, 6)).toBe(RECORDING_NOW_DEPTH)
    expect(recordingNoteDepth(20, 23, 6)).toBeCloseTo(RECORDING_NOW_DEPTH / 2)
    expect(recordingNoteDepth(20, 26, 6)).toBe(0)
    expect(recordingNoteDepth(0, 0, 6)).toBe(RECORDING_NOW_DEPTH)
  })

  it('includes recent history and excludes future targets, including across long sustains', () => {
    const notes = [
      { id: 'expired', startBeat: 0, duration: 1 },
      { id: 'sustain', startBeat: 1, duration: 8 },
      { id: 'recent', startBeat: 8, duration: 1 },
      { id: 'now', startBeat: 10, duration: 0.1 },
      { id: 'future', startBeat: 11, duration: 1 },
    ].map((note) => ({
      ...note,
      midi: 64,
      stringIndex: 0,
      fret: 0,
      noteName: 'E4',
      targetFreq: 329.63,
    }))
    const scene = buildTabScene({
      notes,
      playheadBeat: 10,
      visibleBeatWindow: 6,
      showNoteLabels: true,
      showFretboard: true,
      recordingHistory: true,
    })
    expect(visibleTabNotes(scene).map((note) => note.id)).toEqual([
      'sustain',
      'recent',
      'now',
    ])
    expect(nextTabEvent(scene)).toBeNull()
    expect(scene.playheadBeat).toBe(10)
    expect(scene.notes[2].startBeat).toBe(8)
    const practice = buildTabScene({
      notes,
      playheadBeat: 10,
      visibleBeatWindow: 6,
      showNoteLabels: true,
      showFretboard: true,
    })
    expect(visibleTabNotes(practice).map((note) => note.id)).toEqual([
      'now',
      'future',
    ])
    expect(nextTabEvent(practice)?.notes[0].id).toBe('now')
  })
})
