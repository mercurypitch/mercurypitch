// Real import/export round trips protect guitar pitch, timing, fingering, tempo and metre.
import { describe, expect, it } from 'vitest'
import { parseMidiSong } from '../midi-song'
import { scoreToMidiSong } from '../tab/gp-to-midi-song'
import { exportRecordingGuitarPro, exportRecordingMidi, guitarRecordingFilename, } from './recording-export'
import type { GuitarPracticeScore } from './recording-types'

const score: GuitarPracticeScore = {
  id: 'accepted',
  recordingId: 'recording',
  revision: 2,
  title: 'My melody',
  createdAt: '',
  updatedAt: '',
  bpm: 96,
  timeSignature: [3, 4],
  grid: 'chosen',
  tuning: [64, 59, 55, 50, 45, 40],
  capo: 2,
  attachment: null,
  notes: [
    {
      id: 'a',
      evidenceId: 'a',
      midi: 42,
      startBeat: 0.5,
      endBeat: 1,
      string: 6,
      fret: 0,
    },
    {
      id: 'b',
      evidenceId: 'b',
      midi: 42,
      startBeat: 1,
      endBeat: 1.75,
      string: 6,
      fret: 0,
    },
    {
      id: 'c',
      evidenceId: 'c',
      midi: 57,
      startBeat: 2.5,
      endBeat: 4.5,
      string: 3,
      fret: 0,
    },
  ],
}

describe('guitar recording exports', () => {
  it('exports valid MIDI pitches outside the neck without inventing guitar fingering', async () => {
    const mixed = {
      ...score,
      notes: score.notes.map((note, index) =>
        index === 1 ? { ...note, midi: 28, string: null, fret: null } : note,
      ),
    }
    const imported = parseMidiSong(await exportRecordingMidi(mixed))!
    expect(
      imported.tracks.flatMap((track) => track.notes).map((note) => note.midi),
    ).toEqual([42, 28, 57])
    await expect(exportRecordingGuitarPro(mixed)).rejects.toThrow('tuning')
    expect(mixed.notes[1]).toMatchObject({ midi: 28, string: null, fret: null })
  })
  it('round-trips MIDI notes, rests, repeated pitch, tempo and metre', async () => {
    const bytes = await exportRecordingMidi(score)
    const imported = parseMidiSong(bytes)!
    expect(imported.bpm).toBe(96)
    expect(imported.timeSignatures?.[0]).toEqual({
      beat: 0,
      numerator: 3,
      denominator: 4,
    })
    const track = imported.tracks.find(
      (candidate) => candidate.notes.length > 0,
    )!
    expect(track.name).toBe('My melody')
    expect(track.sourceProgram).toBe(27)
    expect(
      track.notes.map((note) => [note.midi, note.startBeat, note.duration]),
    ).toEqual([
      [42, 0.5, 0.5],
      [42, 1, 0.75],
      [57, 2.5, 2],
    ])
  })
  it('writes actual GP7 and round-trips capo, strings and sustain over a bar line', async () => {
    const bytes = await exportRecordingGuitarPro(score)
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    const { importer } = await import('@coderline/alphatab')
    const model = importer.ScoreLoader.loadScoreFromBytes(bytes)
    const imported = scoreToMidiSong(model)
    expect(imported.bpm).toBe(96)
    expect(imported.timeSignatures?.[0]).toEqual({
      beat: 0,
      numerator: 3,
      denominator: 4,
    })
    const track = imported.tracks.find(
      (candidate) => candidate.notes.length > 0,
    )!
    expect(track.sourceTuning).toEqual(score.tuning)
    expect(track.sourceCapo).toBe(2)
    expect(
      track.notes.map((note) => [
        note.midi,
        note.startBeat,
        note.duration,
        note.stringIndex,
        note.fret,
      ]),
    ).toEqual([
      [42, 0.5, 0.5, 5, 0],
      [42, 1, 0.75, 5, 0],
      [57, 2.5, 2, 2, 0],
    ])
  })
  it('retains free-timed boundaries at MIDI tick resolution in GP7', async () => {
    const free = {
      ...score,
      notes: [{ ...score.notes[0], startBeat: 0.123, endBeat: 0.763 }],
    }
    const bytes = await exportRecordingGuitarPro(free)
    const { importer } = await import('@coderline/alphatab')
    const imported = scoreToMidiSong(
      importer.ScoreLoader.loadScoreFromBytes(bytes),
    )
    const note = imported.tracks.flatMap((track) => track.notes)[0]
    expect(note.midi).toBe(42)
    expect(Math.abs(note.startBeat - 0.123)).toBeLessThan(1 / 480)
    expect(Math.abs(note.startBeat + note.duration - 0.763)).toBeLessThan(
      1 / 480,
    )
  })
  it('makes safe timestamped filenames', () => {
    expect(
      guitarRecordingFilename(
        '../My melody',
        'gp',
        new Date('2026-09-07T12:34:56.789Z'),
      ),
    ).toBe('My-melody-2026-09-07T12-34-56-789Z.gp')
  })
})
