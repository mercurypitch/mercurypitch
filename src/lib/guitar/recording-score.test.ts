// Recording projection preserves evidence clocks, neck identity and explicit revision boundaries.
import { describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from './instrument-tuning'
import { acceptRecordingScoreRevision, changeRecordingNote, changeRecordingScoreTempo, createRecordingScore, quantizeRecordingScore, recordingScoreProblem, } from './recording-score'
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
})
