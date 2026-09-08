// Refined voices preserve model pitches, independent timing and explicit fingering failures.
import { describe, expect, it } from 'vitest'
import type { PolyphonicNote } from '../transcription/basic-pitch-decoder'
import { createRefinedRecordingScore } from './recording-refinement-score'
import { recordingMidiProblem, recordingScoreProblem } from './recording-score'
import type { GuitarPracticeScore } from './recording-types'

const base: GuitarPracticeScore = {
  id: 'editable',
  recordingId: 'take',
  revision: 1,
  title: 'Idea',
  createdAt: 'before',
  updatedAt: 'before',
  bpm: 83,
  timeSignature: [4, 4],
  grid: 'display',
  instrument: 'guitar',
  tuning: [64, 59, 55, 50, 45, 40],
  capo: 0,
  notes: [],
  attachment: { backingId: 'song', firstSeconds: 2, lastSeconds: 4 },
}
const voice = (
  midi: number,
  startSeconds = 0.123,
  endSeconds = 1.234,
): PolyphonicNote => ({ midi, startSeconds, endSeconds, confidence: 0.82 })

describe('polyphonic recording score projection', () => {
  it('places a six-string chord without collapsing attacks or independent release times', () => {
    const candidate = [40, 47, 52, 56, 59, 64].map((midi, index) =>
      voice(midi, 0.123, 1 + index / 10),
    )
    const original = structuredClone(candidate)
    const result = createRefinedRecordingScore(base, candidate, 'candidate')
    expect(result.unassignedNoteIds).toEqual([])
    expect(result.score.notes.map((note) => note.string).sort()).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    for (const [index, note] of result.score.notes.entries()) {
      expect(note.midi).toBe(candidate[index].midi)
      expect((note.startBeat * 60) / base.bpm).toBeCloseTo(
        candidate[index].startSeconds,
        12,
      )
      expect((note.endBeat * 60) / base.bpm).toBeCloseTo(
        candidate[index].endSeconds,
        12,
      )
      expect(result.confidenceByNoteId[note.id]).toBe(0.82)
      expect(note.evidenceId).toBe(note.id)
    }
    expect(recordingScoreProblem(result.score)).toBeNull()
    expect(result.score.attachment).toBeNull()
    expect(result.score.id).toBe(base.id)
    expect(base.notes).toEqual([])
    expect(candidate).toEqual(original)
    expect(createRefinedRecordingScore(base, candidate, 'candidate')).toEqual(
      result,
    )
  })
  it('retains unsupported pitches and held-string conflicts for review, then reuses a released string', () => {
    const candidate = [
      voice(40, 0, 2),
      voice(41, 1, 1.8),
      voice(41, 2, 3),
      voice(20, 3, 4),
    ]
    const result = createRefinedRecordingScore(base, candidate, 'candidate')
    expect(result.score.notes).toHaveLength(4)
    expect(
      result.score.notes.map((note) => [note.midi, note.string, note.fret]),
    ).toEqual([
      [40, 6, 0],
      [41, null, null],
      [41, 6, 1],
      [20, null, null],
    ])
    expect(result.unassignedNoteIds).toEqual([
      'candidate:note:1',
      'candidate:note:3',
    ])
    expect(recordingMidiProblem(result.score)).toBeNull()
    expect(recordingScoreProblem(result.score)).toContain('tuning')
  })
  it('uses a maximum attack-group matching instead of leaving a playable voice unassigned', () => {
    const restricted = { ...base, tuning: [64, 59, 55, 40] }
    const result = createRefinedRecordingScore(
      restricted,
      [voice(64), voice(63), voice(62), voice(40)],
      'matching',
    )
    expect(result.unassignedNoteIds).toEqual([])
    expect(new Set(result.score.notes.map((note) => note.string)).size).toBe(4)
    expect(recordingScoreProblem(result.score)).toBeNull()
  })
  it('pins capo and alternate eight-string tuning rather than using the room default', () => {
    const alternate = {
      ...base,
      tuning: [62, 57, 53, 48, 43, 38, 33, 28],
      capo: 2,
    }
    const result = createRefinedRecordingScore(
      alternate,
      alternate.tuning.map((midi) => voice(midi + 2)),
      'eight',
    )
    expect(result.unassignedNoteIds).toEqual([])
    expect(result.score.notes.every((note) => note.fret === 0)).toBe(true)
    expect(recordingScoreProblem(result.score)).toBeNull()
  })
  it('keeps over-dense chord voices instead of dropping or octave-folding them', () => {
    const result = createRefinedRecordingScore(
      base,
      [40, 45, 50, 55, 59, 64, 67].map((midi) => voice(midi)),
      'dense',
    )
    expect(result.score.notes.map((note) => note.midi)).toEqual([
      40, 45, 50, 55, 59, 64, 67,
    ])
    expect(result.unassignedNoteIds).toHaveLength(1)
  })
  it.each([
    { midi: 128 },
    { midi: 40.5 },
    { startSeconds: -1 },
    { startSeconds: NaN },
    { endSeconds: 0 },
    { endSeconds: Infinity },
    { endSeconds: 300.001 },
    { confidence: NaN },
    { confidence: 1.01 },
    { confidence: -0.1 },
  ])(
    'rejects damaged model output without partially dropping it: %j',
    (patch) => {
      expect(() =>
        createRefinedRecordingScore(
          base,
          [voice(40), { ...voice(50), ...patch }],
          'bad',
        ),
      ).toThrow('invalid')
    },
  )
  it('bounds candidate size, tempo and tuning before allocating notes', () => {
    expect(() => createRefinedRecordingScore(base, [], 'empty')).toThrow('one')
    expect(() =>
      createRefinedRecordingScore(
        base,
        Array.from({ length: 10001 }, () => voice(40)),
        'large',
      ),
    ).toThrow('10,000')
    expect(() =>
      createRefinedRecordingScore({ ...base, bpm: NaN }, [voice(40)], 'bad'),
    ).toThrow('tempo')
    expect(() =>
      createRefinedRecordingScore({ ...base, capo: 13 }, [voice(40)], 'bad'),
    ).toThrow('tuning')
    expect(() => createRefinedRecordingScore(base, [voice(40)], '')).toThrow(
      'tuning',
    )
  })
})
