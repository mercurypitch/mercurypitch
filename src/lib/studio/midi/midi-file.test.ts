// Studio MIDI file writer tests — read back through the app's strict parser, a file is format 1 at 960 PPQ with the song's one tempo and 4/4 on its first track, then a named track per lane holding every note on its channel, ticks and velocities; a pitch's note ends before its next starts on one tick; a track ends at its end tick; names are UTF-8; and a value the format cannot hold is refused.
import { describe, expect, it } from 'vitest'
import { readStudioMidiFile } from '@/tests/utils/studio-midi-file.fixture'
import type { StudioMidiFile, StudioMidiFileTrack } from './midi-file'
import { writeStudioMidiFile } from './midi-file'

const KEYS: StudioMidiFileTrack = {
  name: 'Keys',
  channel: 0,
  program: 0,
  endTick: 7680,
  notes: [
    {
      pitch: 60,
      startTick: 0,
      endTick: 1920,
      velocity: 76,
      releaseVelocity: 64,
    },
    {
      pitch: 64,
      startTick: 0,
      endTick: 1920,
      velocity: 89,
      releaseVelocity: 64,
    },
    {
      pitch: 72,
      startTick: 1920,
      endTick: 2880,
      velocity: 127,
      releaseVelocity: 0,
    },
    {
      pitch: 71,
      startTick: 2880,
      endTick: 3840,
      velocity: 1,
      releaseVelocity: 127,
    },
  ],
}

const DRUMS: StudioMidiFileTrack = {
  name: 'Drums',
  channel: 9,
  endTick: 3840,
  notes: [
    {
      pitch: 36,
      startTick: 0,
      endTick: 120,
      velocity: 127,
      releaseVelocity: 64,
    },
    {
      pitch: 42,
      startTick: 0,
      endTick: 120,
      velocity: 76,
      releaseVelocity: 64,
    },
    {
      pitch: 38,
      startTick: 1920,
      endTick: 2040,
      velocity: 114,
      releaseVelocity: 64,
    },
  ],
}

const SONG: StudioMidiFile = {
  name: 'Night song',
  tempoBpm: 120,
  tracks: [KEYS, DRUMS],
}

/** The notes a track was given, as the reader returns them: by start, then pitch, on the track's channel. */
function expected(track: StudioMidiFileTrack) {
  return [...track.notes]
    .sort((a, b) => a.startTick - b.startTick || a.pitch - b.pitch)
    .map((note) => ({ ...note, channel: track.channel }))
}

describe('writeStudioMidiFile', () => {
  it('writes format 1 at 960 PPQ, the tempo and 4/4 on a first track named after the song, then a named track per lane', () => {
    // Act
    const bytes = writeStudioMidiFile(SONG)
    const file = readStudioMidiFile(bytes)

    // Assert
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd')
    expect([...bytes.slice(8, 14)]).toEqual([0, 1, 0, 3, 960 >> 8, 960 & 0xff])
    expect(file.format).toBe(1)
    expect(file.ppq).toBe(960)
    expect(file.tempos).toEqual([{ tick: 0, microsecondsPerQuarter: 500_000 }])
    expect(file.meters).toEqual([{ tick: 0, numerator: 4, denominator: 4 }])
    expect(file.tracks.map((track) => track.name)).toEqual([
      'Night song',
      'Keys',
      'Drums',
    ])
    expect(file.tracks[0].notes).toEqual([])
    expect(file.tracks[0].programs).toEqual([])
  })

  it('reads back every note on its track’s channel, at its ticks, with its velocities', () => {
    // Act
    const file = readStudioMidiFile(writeStudioMidiFile(SONG))

    // Assert
    expect(file.tracks[1].notes).toEqual(expected(KEYS))
    expect(file.tracks[2].notes).toEqual(expected(DRUMS))
  })

  it('changes the program at a track’s start only when the track has one', () => {
    // Act
    const file = readStudioMidiFile(writeStudioMidiFile(SONG))

    // Assert
    expect(file.tracks[1].programs).toEqual([
      { tick: 0, channel: 0, program: 0 },
    ])
    expect(file.tracks[2].programs).toEqual([])
  })

  it('ends a note before the next of its pitch starts on the same tick', () => {
    // Arrange: two Cs end to end, given in the reverse order.
    const track: StudioMidiFileTrack = {
      name: 'Keys',
      channel: 0,
      endTick: 1920,
      notes: [
        {
          pitch: 60,
          startTick: 960,
          endTick: 1920,
          velocity: 90,
          releaseVelocity: 64,
        },
        {
          pitch: 60,
          startTick: 0,
          endTick: 960,
          velocity: 80,
          releaseVelocity: 64,
        },
      ],
    }

    // Act: the reader refuses a pitch struck while it sounds.
    const file = readStudioMidiFile(
      writeStudioMidiFile({ name: 'Song', tempoBpm: 120, tracks: [track] }),
    )

    // Assert
    expect(file.tracks[1].notes).toEqual(expected(track))
  })

  it('ends each track at its end tick, past its last note, and the first track with the last of them', () => {
    // Act
    const file = readStudioMidiFile(writeStudioMidiFile(SONG))

    // Assert
    expect(file.tracks.map((track) => track.endTick)).toEqual([
      7680, 7680, 3840,
    ])
  })

  it('ends a track at its last note when that is later than its end tick', () => {
    // Arrange
    const track: StudioMidiFileTrack = {
      name: 'Keys',
      channel: 0,
      endTick: 100,
      notes: [
        {
          pitch: 60,
          startTick: 0,
          endTick: 961,
          velocity: 90,
          releaseVelocity: 64,
        },
      ],
    }

    // Act
    const file = readStudioMidiFile(
      writeStudioMidiFile({ name: 'Song', tempoBpm: 120, tracks: [track] }),
    )

    // Assert
    expect(file.tracks.map((each) => each.endTick)).toEqual([961, 961])
  })

  it('writes a track with no notes as its name, its program and its end', () => {
    // Arrange
    const track: StudioMidiFileTrack = {
      name: 'Empty',
      channel: 0,
      program: 0,
      endTick: 3840,
      notes: [],
    }

    // Act
    const file = readStudioMidiFile(
      writeStudioMidiFile({ name: 'Song', tempoBpm: 96, tracks: [track] }),
    )

    // Assert
    expect(file.tracks[1]).toEqual({
      name: 'Empty',
      endTick: 3840,
      programs: [{ tick: 0, channel: 0, program: 0 }],
      notes: [],
    })
  })

  it('writes a song with no tracks as the first track alone', () => {
    // Act
    const bytes = writeStudioMidiFile({
      name: 'Song',
      tempoBpm: 120,
      tracks: [],
    })
    const file = readStudioMidiFile(bytes)

    // Assert
    expect([...bytes.slice(10, 12)]).toEqual([0, 1])
    expect(file.tracks).toEqual([
      { name: 'Song', endTick: 0, programs: [], notes: [] },
    ])
  })

  it('names tracks in UTF-8', () => {
    // Arrange
    const file: StudioMidiFile = {
      name: 'Pjesma noći',
      tempoBpm: 120,
      tracks: [{ ...KEYS, name: 'Klavír · lijeva ruka' }],
    }

    // Act
    const read = readStudioMidiFile(writeStudioMidiFile(file))

    // Assert
    expect(read.tracks.map((track) => track.name)).toEqual([
      'Pjesma noći',
      'Klavír · lijeva ruka',
    ])
  })

  it('writes the tempo to the nearest microsecond a quarter note', () => {
    // Act: 60,000,000 / 123.4 is 486,223.66 microseconds.
    const file = readStudioMidiFile(
      writeStudioMidiFile({ ...SONG, tempoBpm: 123.4 }),
    )

    // Assert
    expect(file.tempos).toEqual([{ tick: 0, microsecondsPerQuarter: 486_224 }])
  })

  it('reads back ticks that need every byte of a delta time', () => {
    // Arrange: gaps of 1, 2, 3 and 4 bytes, ending on the last tick a
    // first track's one gap reaches.
    const ticks = [100, 100 + 16_000, 100 + 16_000 + 2_000_000]
    const last = 0x0fffffff
    const track: StudioMidiFileTrack = {
      name: 'Far',
      channel: 3,
      endTick: last,
      notes: ticks.map((startTick, index) => ({
        pitch: 60 + index,
        startTick,
        endTick: startTick + 1,
        velocity: 64,
        releaseVelocity: 64,
      })),
    }

    // Act
    const file = readStudioMidiFile(
      writeStudioMidiFile({ name: 'Song', tempoBpm: 120, tracks: [track] }),
    )

    // Assert
    expect(file.tracks[1].notes.map((note) => note.startTick)).toEqual(ticks)
    expect(file.tracks[1].endTick).toBe(last)
  })

  it.each([
    ['a pitch above 127', { pitch: 128 }],
    ['a velocity of 0', { velocity: 0 }],
    ['a velocity above 127', { velocity: 128 }],
    ['a release velocity above 127', { releaseVelocity: 128 }],
    ['a note ending where it starts', { endTick: 960 }],
    ['a fractional tick', { startTick: 960.5 }],
    ['a negative tick', { startTick: -1 }],
  ])('refuses %s', (_, change) => {
    // Arrange
    const note = {
      pitch: 60,
      startTick: 960,
      endTick: 1920,
      velocity: 90,
      releaseVelocity: 64,
      ...change,
    }
    const track: StudioMidiFileTrack = { ...KEYS, notes: [note] }

    // Act
    const write = () =>
      writeStudioMidiFile({ name: 'Song', tempoBpm: 120, tracks: [track] })

    // Assert
    expect(write).toThrow(RangeError)
  })

  it.each([
    ['channel 16', { channel: 16 }],
    ['program 128', { program: 128 }],
    ['a gap past four bytes of delta time', { endTick: 3840 + 0x10000000 }],
  ])('refuses a track with %s', (_, change) => {
    // Act
    const write = () =>
      writeStudioMidiFile({
        name: 'Song',
        tempoBpm: 120,
        tracks: [{ ...KEYS, ...change }],
      })

    // Assert
    expect(write).toThrow(RangeError)
  })

  it('refuses a tempo that is not a number above zero', () => {
    expect(() => writeStudioMidiFile({ ...SONG, tempoBpm: 0 })).toThrow(
      RangeError,
    )
    expect(() =>
      writeStudioMidiFile({ ...SONG, tempoBpm: Number.NaN }),
    ).toThrow(RangeError)
  })
})
