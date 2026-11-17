// Studio MIDI file reader tests — real bytes through the app's strict parser: a file it refuses is refused with its reason, an empty one and one past its ceiling too; a format 0 file's channels become lanes through its tempo map; and the Studio's own export comes back as the lanes, names, tempo and notes it was written from.
import { describe, expect, it } from 'vitest'
import { writeStudioMidiFile } from '@/lib/studio/midi/midi-file'
import { studioSongMidiFile } from '@/lib/studio/midi/song-midi-file'
import { createStudioProject, createStudioTrack, } from '@/lib/studio/model/defaults'
import { TEST_NOW } from '@/lib/studio/model/model.test-fixtures'
import type { StudioNote, StudioProject } from '@/lib/studio/model/types'
import { studioMidiFileImport, studioMidiFileSizeRefusal, } from './midi-file-import'

const EMPTY = createStudioProject({ id: 'song', now: TEST_NOW })

function varLen(value: number): number[] {
  const bytes = [value & 0x7f]
  for (let rest = value >>> 7; rest > 0; rest >>>= 7)
    bytes.unshift((rest & 0x7f) | 0x80)
  return bytes
}

/** A Standard MIDI File by hand: each track a list of [delta, ...event bytes], End of Track added. */
function smf(format: 0 | 1, ppq: number, tracks: number[][][]): Uint8Array {
  const chunks = tracks.map((events) => {
    const data = [
      ...events.flatMap(([delta, ...bytes]) => [...varLen(delta), ...bytes]),
      0,
      0xff,
      0x2f,
      0,
    ]
    const length = [24, 16, 8, 0].map((shift) => (data.length >>> shift) & 0xff)
    return [0x4d, 0x54, 0x72, 0x6b, ...length, ...data]
  })
  return Uint8Array.from([
    0x4d,
    0x54,
    0x68,
    0x64,
    0,
    0,
    0,
    6,
    0,
    format,
    0,
    tracks.length,
    ppq >> 8,
    ppq & 0xff,
    ...chunks.flat(),
  ])
}

const tempo = (bpm: number) => {
  const microseconds = Math.round(60_000_000 / bpm)
  return [
    0xff,
    0x51,
    3,
    microseconds >> 16,
    (microseconds >> 8) & 0xff,
    microseconds & 0xff,
  ]
}

describe('a MIDI file the parser refuses', () => {
  it('is refused with the parser’s reason', () => {
    expect(() =>
      studioMidiFileImport(new TextEncoder().encode('RIFF....WAVE'), EMPTY),
    ).toThrow(
      'This MIDI file could not be read: MIDI file must begin with an MThd header.',
    )
    const smpte = smf(1, 480, [[]])
    smpte.set([0xe7, 0x28], 12)
    expect(() => studioMidiFileImport(smpte, EMPTY)).toThrow(
      'This MIDI file could not be read: SMPTE time division is not supported; import a PPQ MIDI file.',
    )
    expect(() =>
      studioMidiFileImport(
        smf(1, 480, [[[0, 0x90, 60, 100]]]).slice(0, 20),
        EMPTY,
      ),
    ).toThrow(/^This MIDI file could not be read: Truncated MIDI data/)
  })

  it('is refused when it is empty, or past the parser’s ceiling, before a byte is read', () => {
    expect(() => studioMidiFileImport(new Uint8Array(0), EMPTY)).toThrow(
      'This MIDI file is empty.',
    )
    expect(studioMidiFileSizeRefusal(20 * 1024 * 1024 + 1)).toBe(
      'This MIDI file could not be read: MIDI files may contain at most 20,971,520 bytes.',
    )
    expect(studioMidiFileSizeRefusal(20 * 1024 * 1024)).toBeNull()
  })
})

describe('a format 0 file', () => {
  it('becomes a lane for each channel, its notes in seconds through its tempo map', () => {
    // Arrange: one MTrk, 480 ticks a quarter, 120 then 60 bpm from beat 2;
    // a piano on channel 1, an organ on channel 2 and a kick on channel 10.
    const bytes = smf(0, 480, [
      [
        [0, 0xff, 0x03, 7, ...new TextEncoder().encode('My Song')],
        [0, ...tempo(120)],
        [0, 0xc0, 0],
        [0, 0xc1, 16],
        [0, 0x90, 60, 100],
        [0, 0x91, 67, 90],
        [0, 0x99, 36, 127],
        [240, 0x89, 36, 0],
        [240, 0x80, 60, 0],
        [0, 0x81, 67, 0],
        [0, ...tempo(60)],
        [0, 0x90, 64, 80],
        [480, 0x90, 64, 0],
      ],
    ])

    // Act: into a song with no clips, which takes the file's first tempo.
    const read = studioMidiFileImport(bytes, EMPTY)

    // Assert: beat 2 is at 0.5 s, and lasts a second at 60 bpm.
    expect(read.songTempoBpm).toBeUndefined()
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Acoustic Grand Piano', role: 'keys' },
      { name: 'Drawbar Organ', role: 'keys' },
      { name: 'Drums', role: 'drums' },
    ])
    expect(
      read.clips.map((clip) =>
        clip.notes!.map((note) => [
          note.pitch,
          note.startTick,
          note.lengthTicks,
        ]),
      ),
    ).toEqual([
      [
        [60, 0, 960],
        [64, 960, 1920],
      ],
      [[67, 0, 960]],
      [[36, 0, 480]],
    ])
  })
})

describe('the Studio’s own MIDI file read back', () => {
  /** A song at 97 bpm: a piano lane with a UTF-8 name, and a drum lane. */
  function song(): StudioProject {
    const keysNotes: StudioNote[] = [
      { id: 1, pitch: 60, startTick: 0, lengthTicks: 960, velocity: 0.5984 },
      {
        id: 2,
        pitch: 64,
        startTick: 960,
        lengthTicks: 480,
        velocity: 1,
        releaseVelocity: 0.2992,
      },
      { id: 3, pitch: 67, startTick: 1440, lengthTicks: 1, velocity: 0.0079 },
    ]
    const drumNotes: StudioNote[] = [
      { id: 1, pitch: 36, startTick: 0, lengthTicks: 120, velocity: 0.7874 },
      { id: 2, pitch: 38, startTick: 960, lengthTicks: 120, velocity: 0.4961 },
    ]
    const clip = (id: string, trackId: string) => ({
      id,
      trackId,
      assetId: 'asset',
      startFrame: 0,
      sourceInFrame: 0,
      sourceOutFrame: 96_000,
      gainDb: 0,
      fades: { curve: 'linear-amplitude' as const },
      midi: { sequenceId: `${id}-seq`, renderKey: '0123456789abcdef' },
    })
    const sequence = (id: string, notes: StudioNote[]) => ({
      id,
      ppq: 960 as const,
      tempoBpm: 97,
      lengthTicks: 3880,
      nextNoteId: notes.length + 1,
      notes,
    })
    return {
      ...createStudioProject({ id: 'song', title: 'Noć', now: TEST_NOW }),
      tempoBpm: 97,
      tracks: [
        createStudioTrack({
          id: 'keys',
          name: 'Klavír · lijeva ruka',
          order: 0,
          role: 'keys',
        }),
        createStudioTrack({
          id: 'drums',
          name: 'Drums',
          order: 1,
          role: 'drums',
        }),
      ],
      clips: [clip('a', 'keys'), clip('b', 'drums')],
      sequences: [sequence('a-seq', keysNotes), sequence('b-seq', drumNotes)],
    }
  }

  it('comes back as its lanes, their names, the song’s tempo and every note', () => {
    // Arrange
    const original = song()
    const bytes = writeStudioMidiFile(studioSongMidiFile(original))

    // Act: into a song with no clips, at 120 bpm.
    const read = studioMidiFileImport(bytes, EMPTY)

    // Assert: 97 bpm is 618,557 microseconds a quarter, read back to 4 decimals.
    expect(read.songTempoBpm).toBe(97)
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Klavír · lijeva ruka', role: 'keys' },
      { name: 'Drums', role: 'drums' },
    ])
    const without = (notes: readonly StudioNote[]) =>
      notes.map(({ id: _id, ...rest }) => rest)
    expect(read.clips[0].notes).toEqual(without(original.sequences![0].notes))
    expect(read.clips[1].notes).toEqual(
      without(original.sequences![1].notes).map((note) => ({
        ...note,
        channel: 9,
      })),
    )
    expect(read.leftOut).toEqual([])
  })
})
