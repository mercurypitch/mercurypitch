// ============================================================
// Measured reference export — a transcribed line as MIDI and Guitar Pro
// ============================================================
//
// The line goes through the recorder's own score type and writers, and is
// read back with the importers a reopened file goes through.

import { describe, expect, it } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import { exportRecordingGuitarPro, exportRecordingMidi, } from '@/lib/guitar/recording-export'
import { isPitchedMidiSongTrack, parseMidiSong } from '@/lib/midi-song'
import { parseGuitarProFile } from '@/lib/tab/gp-import'
import type { TranscribedNote } from '@/lib/transcription/stem-transcription'
import { practiceScoreFromMeasuredReference } from './measured-reference-export'
import type { GuitarNightReference } from './reference-port'
import { measuredReferenceFromTranscription } from './reference-port'

const NOW = new Date('2026-11-03T12:00:00.000Z')

function note(
  midi: number,
  startSeconds: number,
  durationSeconds: number,
): TranscribedNote {
  return {
    midi,
    noteName: '',
    startSeconds,
    durationSeconds,
    confidence: 0.9,
  }
}

function bassLine(notes: TranscribedNote[]): GuitarNightReference {
  return measuredReferenceFromTranscription({
    sessionId: 'song',
    stemKind: 'bass',
    stemLabel: 'Bass',
    transcription: { notes, coverage: 0.8, analysedSeconds: 4 },
  })
}

/** What a reopened Guitar Pro file holds, through the room's own importer. */
async function reopenGuitarPro(bytes: Uint8Array) {
  // jsdom's File has no arrayBuffer(); the importer only asks for that.
  const file = {
    name: 'line.gp',
    arrayBuffer: async () => bytes.slice().buffer,
  } as unknown as File
  const { song } = await parseGuitarProFile(file)
  return song.tracks.find(isPitchedMidiSongTrack)?.notes ?? []
}

describe('practiceScoreFromMeasuredReference', () => {
  it('maps the placed notes onto a practice score, field by field', () => {
    const reference = bassLine([note(28, 0.25, 0.5), note(33, 1, 0.25)])

    expect(
      practiceScoreFromMeasuredReference(reference, 'Nothing in the Dark', NOW),
    ).toEqual({
      id: 'measured:song:bass',
      recordingId: 'measured:song:bass',
      revision: 1,
      title: 'Nothing in the Dark Bass line',
      createdAt: '2026-11-03T12:00:00.000Z',
      updatedAt: '2026-11-03T12:00:00.000Z',
      // Four beats a second: Guitar Pro's thirty-second grid is 31 ms.
      bpm: 240,
      timeSignature: [4, 4],
      grid: 'display',
      instrument: 'bass',
      tuning: [43, 38, 33, 28],
      capo: 0,
      attachment: null,
      // Held to the score limit, not to a take's five minutes.
      origin: 'measured-line',
      notes: [
        {
          id: reference.notes[0].id,
          evidenceId: reference.notes[0].id,
          midi: 28,
          startBeat: 1,
          endBeat: 3,
          string: 4,
          fret: 0,
        },
        {
          id: reference.notes[1].id,
          evidenceId: reference.notes[1].id,
          midi: 33,
          startBeat: 4,
          endBeat: 5,
          string: 3,
          fret: 0,
        },
      ],
    })
  })

  it('writes the neck the line was placed on, as the stage draws it', () => {
    const onGuitar = measuredReferenceFromTranscription(
      {
        sessionId: 'song',
        stemKind: 'guitar',
        stemLabel: 'Guitar',
        transcription: {
          notes: [note(64, 0, 0.5)],
          coverage: 1,
          analysedSeconds: 1,
        },
      },
      DEFAULT_GUITAR_TUNING,
    )

    const score = practiceScoreFromMeasuredReference(onGuitar, 'Song', NOW)

    expect(score?.instrument).toBe('guitar')
    expect(score?.tuning).toEqual([...DEFAULT_GUITAR_TUNING.openMidi])
    expect(score?.notes[0]).toMatchObject({ midi: 64, string: 1, fret: 0 })
  })

  it('leaves out notes the neck cannot reach, and still exports', async () => {
    // E6 is past the 24th fret of a bass's G string.
    const reference = bassLine([note(28, 0, 0.5), note(88, 1, 0.5)])
    expect(reference.outOfRangeNotes).toBe(1)

    const score = practiceScoreFromMeasuredReference(reference, 'Song', NOW)

    expect(score?.notes.map((each) => each.midi)).toEqual([28])
    await expect(exportRecordingMidi(score!)).resolves.toBeInstanceOf(
      Uint8Array,
    )
  })

  it('gives no score for a line with no placed notes', () => {
    expect(
      practiceScoreFromMeasuredReference(bassLine([note(88, 0, 0.5)]), 'Song'),
    ).toBeNull()
  })

  it('gives no score for an authored reference', () => {
    const authored: GuitarNightReference = {
      ...bassLine([note(28, 0, 0.5)]),
      kind: 'authored',
    }

    expect(practiceScoreFromMeasuredReference(authored, 'Song')).toBeNull()
  })
})

describe('a measured line, written and opened again', () => {
  const line = () =>
    practiceScoreFromMeasuredReference(
      bassLine([
        note(28, 0, 0.5),
        note(33, 0.5, 0.5),
        note(35, 1.25, 0.25),
        note(40, 2, 1),
        // Across a bar line (bar 4 starts at 4 s): two tied notes, read as one.
        note(43, 3.5, 1),
      ]),
      'Song',
      NOW,
    )!

  it('comes back from Guitar Pro with the same notes', async () => {
    const reopened = await reopenGuitarPro(
      await exportRecordingGuitarPro(line()),
    )

    expect(reopened.map((each) => each.midi)).toEqual([28, 33, 35, 40, 43])
    expect(reopened.map((each) => each.startBeat)).toEqual([0, 2, 5, 8, 14])
    expect(reopened[4].duration).toBeCloseTo(4)
  })

  it('comes back from MIDI with the same notes', async () => {
    const song = parseMidiSong(await exportRecordingMidi(line()))
    const notes = song?.tracks.find(isPitchedMidiSongTrack)?.notes ?? []

    expect(notes.map((each) => each.midi)).toEqual([28, 33, 35, 40, 43])
  })
})

describe('a measured line the recorder could not have held', () => {
  it('writes attacks 50 ms apart on one string as Guitar Pro', async () => {
    // A bass's E string takes MIDI 28 and 29 alone. At 60 BPM the grid is
    // 125 ms and these four attacks fell into two cells; at 240 it is 31 ms.
    const dense = practiceScoreFromMeasuredReference(
      bassLine([
        note(28, 0, 0.05),
        note(29, 0.05, 0.05),
        note(28, 0.1, 0.05),
        note(29, 0.15, 0.05),
      ]),
      'Song',
      NOW,
    )!
    expect(dense.notes.map((each) => each.string)).toEqual([4, 4, 4, 4])

    const reopened = await reopenGuitarPro(
      await exportRecordingGuitarPro(dense),
    )

    expect(reopened.map((each) => each.midi)).toEqual([28, 29, 28, 29])
  })

  it('exports a line longer than the five-minute take, in both formats', async () => {
    const long = practiceScoreFromMeasuredReference(
      bassLine([note(28, 0, 0.5), note(33, 515, 0.5)]),
      'Song',
      NOW,
    )!

    const reopened = await reopenGuitarPro(await exportRecordingGuitarPro(long))
    const song = parseMidiSong(await exportRecordingMidi(long))

    expect(reopened.map((each) => each.startBeat)).toEqual([0, 2060])
    expect(
      song?.tracks.find(isPitchedMidiSongTrack)?.notes.map((each) => each.midi),
    ).toEqual([28, 33])
  })

  it('stops at twenty minutes, and says so', async () => {
    const tooLong = practiceScoreFromMeasuredReference(
      bassLine([note(28, 0, 0.5), note(33, 1300, 0.5)]),
      'Song',
      NOW,
    )!

    await expect(exportRecordingMidi(tooLong)).rejects.toThrow(
      'This melody runs longer than 20 minutes, the most a score can hold.',
    )
  })
})
