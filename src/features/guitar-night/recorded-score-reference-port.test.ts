// Accepted refined chords reuse the authored score path without flattening voices or changing timing.
import { describe, expect, it } from 'vitest'
import { createRefinedRecordingScore } from '@/lib/guitar/recording-refinement-score'
import { acceptRecordingScoreRevision, recordingScoreTuning, } from '@/lib/guitar/recording-score'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import { recordedScoreSource } from './recorded-score-reference-port'
import { openGuitarNightReference } from './reference-port'

describe('accepted refined chord reference', () => {
  it('keeps every voice identity, pitch, fingering and independent release in the shared practice path', () => {
    const base: GuitarPracticeScore = {
      id: 'draft',
      recordingId: 'take',
      revision: 1,
      title: 'Chord idea',
      createdAt: '',
      updatedAt: '',
      bpm: 83,
      timeSignature: [4, 4],
      grid: 'display',
      instrument: 'guitar',
      tuning: [64, 59, 55, 50, 45, 40],
      capo: 2,
      notes: [],
      attachment: null,
    }
    const candidate = [42, 49, 54, 58, 61, 66].map((midi, index) => ({
      midi,
      startSeconds: 0.173,
      endSeconds: 1 + index / 10,
      confidence: 0.85,
    }))
    const refined = createRefinedRecordingScore(base, candidate, 'model')
    const accepted = acceptRecordingScoreRevision(refined.score, 2)
    const source = recordedScoreSource(accepted)
    const opened = openGuitarNightReference(
      source,
      'melody',
      recordingScoreTuning(accepted),
    )
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.reference.kind).toBe('authored')
    expect(opened.reference.outOfRangeNotes).toBe(0)
    expect(opened.reference.notes).toHaveLength(6)
    expect(opened.reference.tuning.capo).toBe(2)
    expect(opened.reference.tempoBpm).toBe(83)
    for (const [index, note] of opened.reference.notes.entries()) {
      const original = accepted.notes[index]
      expect(note).toMatchObject({
        id: original.id,
        midi: original.midi,
        stringIndex: original.string! - 1,
        fret: original.fret,
        startBeat: original.startBeat,
        duration: original.endBeat - original.startBeat,
      })
      expect((note.startBeat * 60) / base.bpm).toBeCloseTo(
        candidate[index].startSeconds,
        12,
      )
      expect(((note.startBeat + note.duration) * 60) / base.bpm).toBeCloseTo(
        candidate[index].endSeconds,
        12,
      )
    }
  })
})
