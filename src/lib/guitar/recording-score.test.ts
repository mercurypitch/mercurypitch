// Recording projection preserves evidence clocks, neck identity and explicit revision boundaries.
import { describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from './instrument-tuning'
import { acceptRecordingScoreRevision, changeRecordingNote, changeRecordingScoreTempo, createRecordingScore, mergeRecordingNote, quantizeRecordingScore, recordingMergeTarget, recordingMidiProblem, recordingScoreProblem, splitRecordingNote, } from './recording-score'
import type { GuitarRecordedNote, GuitarRecording } from './recording-types'

const recording: GuitarRecording = {
  id: 'idea',
  version: 1,
  detectorVersion: 'test',
  title: 'Idea',
  createdAt: '',
  updatedAt: '',
  state: 'draft',
  sampleRate: 48000,
  inputChannel: 0,
  inputKind: 'interface',
  frames: 96000,
  chunks: 12,
  audioStartFrame: 500000,
  clockAnomalies: 0,
  interruption: null,
  amp: null,
  backing: { id: 'song', title: 'Song', startSeconds: 12, rate: 0.75 },
  takeId: null,
  scoreId: null,
}
const notes: GuitarRecordedNote[] = [
  {
    id: 'a',
    midi: 64,
    startFrame: 4800,
    endFrame: 20000,
    clarity: 0.9,
    onset: 'attack',
  },
  {
    id: 'b',
    midi: 67,
    startFrame: 30000,
    endFrame: 80000,
    clarity: 0.8,
    onset: 'pitch-change',
  },
]
const score = () =>
  createRecordingScore(recording, notes, DEFAULT_GUITAR_TUNING)

describe('recorded practice score', () => {
  it('projects sample-relative notes, not wall clock or output-latency compensation', () => {
    const result = score()
    expect(result.notes[0].startBeat).toBe(0.2)
    expect(result.attachment).toEqual({
      backingId: 'song',
      firstSeconds: 12.075,
      lastSeconds: 12.46875,
    })
    expect(result.grid).toBe('display')
    expect(recordingScoreProblem(result)).toBeNull()
  })
  it('pins the recorded tuning and capo instead of reinterpreting the current room', () => {
    const pinned = {
      ...DEFAULT_GUITAR_TUNING,
      openMidi: [62, 57, 53, 48, 43, 38],
      capo: 2,
    }
    const result = createRecordingScore(
      { ...recording, tuning: pinned },
      notes,
      DEFAULT_GUITAR_TUNING,
    )
    expect(result.tuning).toEqual(pinned.openMidi)
    expect(result.capo).toBe(2)
    expect(result.notes[0]).toMatchObject({ midi: 64, string: 1, fret: 0 })
  })
  it('never folds an out-of-range note onto a guitar neck', () => {
    const result = createRecordingScore(
      recording,
      [{ ...notes[0], midi: 20 }],
      DEFAULT_GUITAR_TUNING,
    )
    expect(result.notes[0]).toMatchObject({
      midi: 20,
      string: null,
      fret: null,
    })
    expect(recordingScoreProblem(result)).toContain('tuning')
  })
  it('changes tempo without stretching time or losing captured song placement', () => {
    const initial = score()
    const changed = changeRecordingScoreTempo(initial, 73)
    expect((changed.notes[1].startBeat * 60) / changed.bpm).toBeCloseTo(
      notes[1].startFrame / 48000,
    )
    expect(changed.attachment).toEqual(initial.attachment)
    expect(changeRecordingScoreTempo(initial, NaN)).toBe(initial)
  })
  it('keeps source evidence immutable, recalculates fingering and drops stale timing anchors', () => {
    const initial = score()
    const pitch = changeRecordingNote(initial, 'a', {
      midi: 65,
      evidenceId: 'wrong',
    })
    expect(pitch.notes[0]).toMatchObject({ midi: 65, fret: 1, evidenceId: 'a' })
    expect(pitch.attachment).toEqual(initial.attachment)
    expect(
      changeRecordingNote(pitch, 'a', { startBeat: 0 }).attachment,
    ).toBeNull()
    expect(initial.notes[0].midi).toBe(64)
    expect(notes[0].startFrame).toBe(4800)
  })
  it('quantizes only on request and accepts fresh immutable identities', () => {
    const initial = score()
    const chosen = quantizeRecordingScore(initial, 4)
    expect(chosen.notes[0].startBeat).toBe(0.25)
    expect(chosen.attachment).toBeNull()
    expect(recordingScoreProblem(chosen)).toBeNull()
    expect(initial.notes[0].startBeat).toBe(0.2)
    const first = acceptRecordingScoreRevision(initial, 1)
    const second = acceptRecordingScoreRevision(chosen, 2)
    expect(first.id).not.toBe(second.id)
    expect(second.revision).toBe(2)
    expect(first.notes[0].startBeat).toBe(0.2)
  })
  it('blocks overlaps, impossible fingering and overlong or malformed targets', () => {
    const initial = score()
    expect(
      recordingScoreProblem(
        changeRecordingNote(initial, 'b', { startBeat: 0.4 }),
      ),
    ).toContain('overlap')
    expect(
      recordingScoreProblem(changeRecordingNote(initial, 'a', { fret: 25 })),
    ).toContain('tuning')
    expect(
      recordingScoreProblem(
        changeRecordingNote(initial, 'b', { endBeat: 605 }),
      ),
    ).toContain('five-minute')
    expect(() =>
      acceptRecordingScoreRevision({ ...initial, notes: [] }, 1),
    ).toThrow('No stable')
  })
  it('allows independent chord voices, but not same-pitch or same-string collisions', () => {
    const initial = score()
    const chord = {
      ...initial,
      notes: [
        { ...initial.notes[0], startBeat: 0, endBeat: 2 },
        {
          ...initial.notes[1],
          midi: 59,
          string: 2,
          fret: 0,
          startBeat: 0,
          endBeat: 1,
        },
      ],
    }
    expect(recordingScoreProblem(chord)).toBeNull()
    const conflicting = changeRecordingNote(chord, 'b', { midi: 65 })
    expect(recordingMidiProblem(conflicting)).toBeNull()
    expect(recordingScoreProblem(conflicting)).toContain('same string')
    const duplicatePitch = {
      ...chord,
      notes: [chord.notes[0], { ...chord.notes[1], midi: 64, fret: 5 }],
    }
    expect(recordingMidiProblem(duplicatePitch)).toContain('same pitch')
    expect(() => acceptRecordingScoreRevision(duplicatePitch, 2)).toThrow(
      'same pitch',
    )
  })
  it('snaps simultaneous voices independently and exposes new conflicts instead of arpeggiating', () => {
    const initial = score()
    const chord = {
      ...initial,
      notes: [
        { ...initial.notes[0], startBeat: 0.13, endBeat: 1.12 },
        {
          ...initial.notes[1],
          midi: 59,
          string: 2,
          fret: 0,
          startBeat: 0.13,
          endBeat: 0.52,
        },
      ],
    }
    const snapped = quantizeRecordingScore(chord, 4)
    expect(snapped.notes.map((note) => [note.startBeat, note.endBeat])).toEqual(
      [
        [0.25, 1],
        [0.25, 0.5],
      ],
    )
    expect(recordingScoreProblem(snapped)).toBeNull()
    const crowded = {
      ...initial,
      notes: [
        { ...initial.notes[0], startBeat: 0, endBeat: 0.01 },
        { ...initial.notes[1], startBeat: 0.01, endBeat: 0.03 },
      ],
    }
    const conflict = quantizeRecordingScore(crowded, 4)
    expect(conflict.notes.map((note) => note.startBeat)).toEqual([0, 0])
    expect(recordingScoreProblem(conflict)).toContain('same string')
  })
  it('splits and merges one chord voice without deleting or extending neighbouring voices', () => {
    const initial = score()
    const chord = {
      ...initial,
      notes: [
        { ...initial.notes[0], startBeat: 0, endBeat: 2 },
        {
          ...initial.notes[1],
          midi: 59,
          string: 2,
          fret: 0,
          startBeat: 0,
          endBeat: 3,
        },
      ],
    }
    expect(recordingMergeTarget(chord, 'a')).toBeNull()
    expect(mergeRecordingNote(chord, 'a')).toBe(chord)
    const split = splitRecordingNote(chord, 'a', 'split')
    expect(split.notes.find((note) => note.id === 'b')).toEqual(chord.notes[1])
    expect(split.notes.find((note) => note.id === 'split')).toMatchObject({
      startBeat: 1,
      endBeat: 2,
      evidenceId: 'a',
    })
    expect(recordingScoreProblem(split)).toBeNull()
    expect(recordingMergeTarget(split, 'a')?.id).toBe('split')
    const merged = mergeRecordingNote(split, 'a')
    expect(merged.notes).toEqual(chord.notes)
    expect(merged.attachment).toBeNull()
    expect(splitRecordingNote(chord, 'a', 'b')).toBe(chord)
    const different = changeRecordingNote(split, 'split', { midi: 65 })
    expect(recordingMergeTarget(different, 'a')).toBeNull()
  })
  it('preserves model confidence by source evidence through split, delete, merge and acceptance', () => {
    const initial = score()
    initial.refinement = {
      version: 1,
      model: 'basic-pitch',
      modelSha256: 'a'.repeat(64),
      decoderVersion: 'test-decoder',
      createdAt: '2026-09-08T12:00:00.000Z',
      source: 'recorded-audio',
      confidenceByNoteId: { a: 0.82, b: 0.61 },
    }
    const original = structuredClone(initial)
    const split = splitRecordingNote(initial, 'a', 'child')
    const child = split.notes.find((note) => note.id === 'child')!
    expect(child.evidenceId).toBe('a')
    expect(split.refinement?.confidenceByNoteId[child.evidenceId]).toBe(0.82)
    expect(split.refinement?.confidenceByNoteId.child).toBeUndefined()
    const deleted = {
      ...split,
      notes: split.notes.filter((note) => note.id !== 'b'),
    }
    const merged = mergeRecordingNote(deleted, 'a')
    const accepted = acceptRecordingScoreRevision(merged, 2)
    expect(accepted.notes).toHaveLength(1)
    expect(accepted.notes[0].evidenceId).toBe('a')
    expect(accepted.refinement).toEqual(original.refinement)
    expect(
      accepted.refinement?.confidenceByNoteId[accepted.notes[0].evidenceId],
    ).toBe(0.82)
    expect(accepted.refinement?.confidenceByNoteId.b).toBe(0.61)
    expect(initial).toEqual(original)
  })
})
