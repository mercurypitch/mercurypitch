// Studio MIDI file clips tests — a file's tracks become new lanes: one a track and channel with notes, a format 0 file's channels apart; channel 10 a Drums lane, the rest Piano lanes named after their track or their program; notes keep their seconds through a tempo map that changes, laid at the song's tempo, which a song with no clips takes from the file; one clip a lane from the song's start, a bar-rounded length and five minutes at most; velocities to 4 decimals, MIDI's "no release velocity" left out, channels kept; overlaps paired first in, first out; a lane over 10,000 notes left out; and an empty file making nothing.
import { describe, expect, it } from 'vitest'
import { createStudioProject } from '../model/defaults'
import { studioMidiFixture, TEST_NOW } from '../model/model.test-fixtures'
import type { StudioMidiFileRead, StudioMidiFileReadTrack, } from './midi-file-clips'
import { studioMidiFileClips, studioMidiTrackName } from './midi-file-clips'

type FileEvent = StudioMidiFileReadTrack['events'][number]

const on = (tick: number, note: number, velocity = 100): FileEvent => ({
  type: 'note-on',
  tick,
  note,
  velocity,
})
const off = (tick: number, note: number, velocity = 0): FileEvent => ({
  type: 'note-off',
  tick,
  note,
  velocity,
})
const program = (tick: number, number: number): FileEvent => ({
  type: 'program-change',
  tick,
  program: number,
})

/** A name as the parser keeps it: each UTF-8 byte a character. */
const asRead = (name: string) =>
  String.fromCharCode(...new TextEncoder().encode(name))

const track = (
  channel: number,
  name: string | null,
  events: FileEvent[],
  sourceTrackIndex = 1,
): StudioMidiFileReadTrack => ({
  sourceTrackIndex,
  channel,
  name: name === null ? null : asRead(name),
  events,
})

/** A file of `tracks` at `ppq`, 120 bpm unless `tempos` say otherwise, ending at its last event. */
function file(
  tracks: StudioMidiFileReadTrack[],
  options: {
    ppq?: number
    tempos?: { tick: number; bpm: number }[]
  } = {},
): StudioMidiFileRead {
  return {
    source: { ticksPerQuarter: options.ppq ?? 960 },
    tempoMap: (options.tempos ?? [{ tick: 0, bpm: 120 }]).map((tempo) => ({
      tick: tempo.tick,
      microsecondsPerQuarter: Math.round(60_000_000 / tempo.bpm),
    })),
    durationTicks: Math.max(
      0,
      ...tracks.flatMap((each) => each.events.map((event) => event.tick)),
    ),
    tracks,
  }
}

const EMPTY_SONG = createStudioProject({ id: 'song', now: TEST_NOW })
const SONG_WITH_CLIPS = studioMidiFixture().project

/** The notes of clip `index` as pitch, start and length. */
const timed = (read: ReturnType<typeof studioMidiFileClips>, index = 0) =>
  (read.clips[index].notes ?? []).map((note) => [
    note.pitch,
    note.startTick,
    note.lengthTicks,
  ])

describe('a MIDI file’s lanes', () => {
  it('are one a track and channel that hold notes, in the file’s order, each on a new lane from the song’s start', () => {
    // Arrange: a conductor's track of no notes, then Bass and Lead.
    const read = studioMidiFileClips(
      file([
        track(0, 'Song', [program(0, 3)], 0),
        track(1, 'Bass', [on(0, 36), off(960, 36)], 1),
        track(2, 'Lead', [on(960, 72), off(1920, 72)], 2),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Bass', role: 'keys' },
      { name: 'Lead', role: 'keys' },
    ])
    expect(read.clips.map((clip) => clip.startFrame)).toEqual([0, 0])
  })

  it('make channel 10 a Drums lane, which plays the kit, named after its track or Drums', () => {
    // Act
    const read = studioMidiFileClips(
      file([
        track(9, 'Groove', [on(0, 36), off(120, 36)], 1),
        track(9, null, [on(0, 38), off(120, 38)], 2),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Groove', role: 'drums' },
      { name: 'Drums', role: 'drums' },
    ])
    expect(read.clips[0].notes![0]).toMatchObject({ pitch: 36, channel: 9 })
  })

  it('name a track with no name after its General MIDI program, the grand without one', () => {
    // Act
    const read = studioMidiFileClips(
      file([
        track(0, null, [program(0, 33), on(0, 40), off(960, 40)], 1),
        track(1, null, [on(0, 60), off(960, 60)], 2),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Fingered Bass', role: 'keys' },
      { name: 'Acoustic Grand Piano', role: 'keys' },
    ])
  })

  it('split a format 0 file’s one track by channel, each lane named after its program', () => {
    // Arrange: one MTrk, named after the song, playing three channels.
    const read = studioMidiFileClips(
      file([
        track(0, 'My Song', [program(0, 0), on(0, 60), off(960, 60)], 0),
        track(1, 'My Song', [program(0, 0), on(0, 64), off(960, 64)], 0),
        track(9, 'My Song', [on(0, 36), off(120, 36)], 0),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert: two lanes of one program are told apart.
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Acoustic Grand Piano', role: 'keys' },
      { name: 'Acoustic Grand Piano 2', role: 'keys' },
      { name: 'Drums', role: 'drums' },
    ])
    expect(read.clips.map((clip) => clip.notes![0].channel)).toEqual([
      undefined,
      1,
      9,
    ])
  })
})

describe('a MIDI file’s names', () => {
  it('read as UTF-8, as the Studio writes them', () => {
    expect(studioMidiTrackName(asRead('Klavír · lijeva ruka'))).toBe(
      'Klavír · lijeva ruka',
    )
  })

  it('read a byte a character when they are not UTF-8', () => {
    // Latin-1's é, a byte that starts no UTF-8 character on its own.
    expect(studioMidiTrackName('Café')).toBe('Café')
  })

  it('lose their control characters and their length past 64, and are none when nothing is left', () => {
    expect(studioMidiTrackName('\u0000Strings\r\n 2\u0000')).toBe('Strings 2')
    expect(studioMidiTrackName('x'.repeat(100))).toBe('x'.repeat(64))
    expect(studioMidiTrackName('\u0000 \u0007')).toBeNull()
    expect(studioMidiTrackName(null)).toBeNull()
  })

  it('name the lanes, a blank one after its program', () => {
    // Act
    const read = studioMidiFileClips(
      file([track(0, ' \u0000', [on(0, 60), off(960, 60)])]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(read.clips[0].lane).toEqual({
      name: 'Acoustic Grand Piano',
      role: 'keys',
    })
  })
})

describe('a MIDI file’s time', () => {
  it('keeps each note’s seconds through a tempo map that changes, at the song’s tempo', () => {
    // Arrange: 480 ticks a quarter at 120 bpm, 60 from tick 960 and 240
    // from tick 1920: the notes start at 0, 1, 3 and 3.5 s.
    const tempoChanges = file(
      [
        track(0, 'Line', [
          on(0, 60),
          off(480, 60),
          on(960, 62),
          off(1440, 62),
          on(1920, 64),
          off(2400, 64),
          on(2880, 65),
          off(3360, 65),
        ]),
      ],
      {
        ppq: 480,
        tempos: [
          { tick: 0, bpm: 120 },
          { tick: 960, bpm: 60 },
          { tick: 1920, bpm: 240 },
        ],
      },
    )

    // Act: a song with clips keeps its 120 bpm: 1920 ticks a second.
    const read = studioMidiFileClips(tempoChanges, SONG_WITH_CLIPS)

    // Assert: 0.5, 1, 0.25 and 0.25 s long.
    expect(read.songTempoBpm).toBeUndefined()
    expect(timed(read)).toEqual([
      [60, 0, 960],
      [62, 1920, 1920],
      [64, 5760, 480],
      [65, 6720, 480],
    ])
  })

  it('takes the file’s first tempo for a song with no clips yet, so the file’s beats fall on its bars', () => {
    // Arrange: 96 bpm, a note on each of beats 1 and 5.
    const at96 = file(
      [
        track(0, 'Line', [
          on(0, 60),
          off(960, 60),
          on(3840, 62),
          off(4800, 62),
        ]),
      ],
      { tempos: [{ tick: 0, bpm: 96 }] },
    )

    // Act
    const empty = studioMidiFileClips(at96, EMPTY_SONG)
    const busy = studioMidiFileClips(at96, SONG_WITH_CLIPS)

    // Assert: in the empty song, the file's ticks; in the busy one, its seconds at 120.
    expect(empty.songTempoBpm).toBe(96)
    expect(empty.clips[0].tempoBpm).toBe(96)
    expect(timed(empty)).toEqual([
      [60, 0, 960],
      [62, 3840, 960],
    ])
    expect(busy.songTempoBpm).toBeUndefined()
    expect(busy.clips[0].tempoBpm).toBe(120)
    expect(timed(busy)).toEqual([
      [60, 0, 1200],
      [62, 4800, 1200],
    ])
  })

  it('keeps the song’s tempo when the file’s first is outside the song’s range, or the same', () => {
    const slow = file([track(0, 'Line', [on(0, 60), off(960, 60)])], {
      tempos: [{ tick: 0, bpm: 10 }],
    })
    const same = file([track(0, 'Line', [on(0, 60), off(960, 60)])])
    expect(studioMidiFileClips(slow, EMPTY_SONG).songTempoBpm).toBeUndefined()
    expect(studioMidiFileClips(same, EMPTY_SONG).songTempoBpm).toBeUndefined()
  })

  it('makes every lane’s clip as long as the file’s last note’s end, rounded up to a bar', () => {
    // Arrange: one lane ends in bar 1, the other at 2.1 bars, at 120 bpm.
    const read = studioMidiFileClips(
      file([
        track(0, 'Short', [on(0, 60), off(960, 60)], 1),
        track(1, 'Long', [on(0, 64), off(8064, 64)], 2),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert: three bars of two seconds.
    expect(read.clips.map((clip) => clip.frames)).toEqual([288_000, 288_000])
  })

  it('keeps a file longer than five minutes to its first five, and says from how long', () => {
    // Arrange: a note at 4:58 and one at 6:00, at 120 bpm.
    const long = file([
      track(0, 'Long', [
        on(1920 * 298, 60),
        off(1920 * 299, 60),
        on(1920 * 360, 62),
        off(1920 * 361, 62),
      ]),
    ])

    // Act
    const read = studioMidiFileClips(long, SONG_WITH_CLIPS)

    // Assert: 150 bars of two seconds, the 6:00 note left out.
    expect(read.clips[0].frames).toBe(300 * 48_000)
    expect(timed(read)).toEqual([[60, 1920 * 298, 1920]])
    expect(read.cutFrom).toBe(361)
  })
})

describe('a MIDI file’s notes', () => {
  it('take velocity v / 127 to 4 decimals, keep a release velocity but MIDI’s 0 and 64, and keep their channel', () => {
    // Act
    const read = studioMidiFileClips(
      file([
        track(3, 'Keys', [
          on(0, 60, 1),
          off(480, 60, 0),
          on(480, 62, 64),
          off(960, 62, 64),
          on(960, 64, 127),
          off(1440, 64, 100),
        ]),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(read.clips[0].notes).toEqual([
      {
        pitch: 60,
        startTick: 0,
        lengthTicks: 480,
        velocity: 0.0079,
        channel: 3,
      },
      {
        pitch: 62,
        startTick: 480,
        lengthTicks: 480,
        velocity: 0.5039,
        channel: 3,
      },
      {
        pitch: 64,
        startTick: 960,
        lengthTicks: 480,
        velocity: 1,
        releaseVelocity: 0.7874,
        channel: 3,
      },
    ])
  })

  it('pair two of one pitch that overlap first in, first out, as two keys held are recorded', () => {
    // Arrange: a C struck again while it sounds, and an E inside another E.
    const read = studioMidiFileClips(
      file([
        track(0, 'Keys', [
          on(0, 60),
          on(480, 60),
          off(960, 60),
          off(1440, 60),
          on(0, 64),
          on(240, 64),
          off(480, 64),
          off(1920, 64),
        ]),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(timed(read)).toEqual([
      [60, 0, 960],
      [64, 0, 480],
      [64, 240, 1680],
      [60, 480, 960],
    ])
  })

  it('make a note that ends where it starts a tick long, and end a note never ended at the file’s end', () => {
    // Act
    const read = studioMidiFileClips(
      file([
        track(0, 'Keys', [
          on(0, 60),
          off(0, 60),
          on(960, 62),
          on(1920, 64),
          off(2880, 64),
        ]),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert
    expect(timed(read)).toEqual([
      [60, 0, 1],
      [62, 960, 1920],
      [64, 1920, 960],
    ])
  })

  it('leave out a lane over 10,000 notes, by name, and keep the others', () => {
    // Arrange: 10,001 short notes on Busy, one on Calm.
    const busy = Array.from({ length: 10_001 }, (_, index) => [
      on(index * 10, 60 + (index % 12)),
      off(index * 10 + 5, 60 + (index % 12)),
    ]).flat()
    const read = studioMidiFileClips(
      file([
        track(0, 'Busy', busy, 1),
        track(1, 'Calm', [on(0, 60), off(960, 60)], 2),
      ]),
      SONG_WITH_CLIPS,
    )

    // Assert: Calm's clip is a bar long; Busy's notes ran 52 s.
    expect(read.leftOut).toEqual(['Busy'])
    expect(read.clips.map((clip) => clip.lane)).toEqual([
      { name: 'Calm', role: 'keys' },
    ])
    expect(read.clips[0].frames).toBe(96_000)
  })

  it('keep a lane of exactly 10,000 notes', () => {
    const notes = Array.from({ length: 10_000 }, (_, index) => [
      on(index * 10, 60),
      off(index * 10 + 5, 60),
    ]).flat()
    const read = studioMidiFileClips(
      file([track(0, 'Full', notes)]),
      SONG_WITH_CLIPS,
    )
    expect(read.leftOut).toEqual([])
    expect(read.clips[0].notes).toHaveLength(10_000)
  })
})

describe('a MIDI file with no notes', () => {
  it('makes no lane, and leaves nothing out', () => {
    // Act
    const read = studioMidiFileClips(
      file([
        track(0, 'Silent', [program(0, 0)]),
        track(1, 'Offs', [off(0, 60)]),
      ]),
      EMPTY_SONG,
    )

    // Assert
    expect(read.clips).toEqual([])
    expect(read.leftOut).toEqual([])
  })
})
