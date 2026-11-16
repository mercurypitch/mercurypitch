// Studio song as a MIDI file tests — read back from the written bytes: a clip plays the notes starting inside its window, as its lane's preview draws them, each cut at the window's end; a move or a trim moves them with the clip in the song; a sequence laid on another tempo keeps its notes' times in seconds; the clips of a lane make one track named after it, the lanes in their order; a drum lane plays on channel 10 and a piano lane on channel 1 after the acoustic grand; velocities are MIDI's; a pitch sounds once at a time; a clip alone stays where the song has it; and an empty song has no track of notes.
import { describe, expect, it } from 'vitest'
import type { StudioMidiRead } from '@/tests/utils/studio-midi-file.fixture'
import { readStudioMidiFile } from '@/tests/utils/studio-midi-file.fixture'
import type { StudioCommand } from '../model/commands'
import { applyStudioCommand } from '../model/commands'
import { createStudioProject, createStudioTrack } from '../model/defaults'
import { studioFixture, studioMidiFixture, TEST_NOW, } from '../model/model.test-fixtures'
import type { StudioClip, StudioNote, StudioProject, StudioSequence, StudioTrack, } from '../model/types'
import { writeStudioMidiFile } from './midi-file'
import { studioNotePreview } from './preview'
import { studioClipMidiFile, studioMidiLanes, studioMidiReleaseVelocity, studioMidiVelocity, studioSongMidiFile, } from './song-midi-file'
import { studioClipTickWindow } from './time'

/** 48 kHz frames in `seconds`. */
const frames = (seconds: number) => Math.round(seconds * 48_000)

/** The song as a file, read back from its bytes. */
const songFile = (project: StudioProject): StudioMidiRead =>
  readStudioMidiFile(writeStudioMidiFile(studioSongMidiFile(project)))

/** A lane's notes as the file plays them: pitch, start and end ticks. */
const timed = (read: StudioMidiRead, track = 1) =>
  read.tracks[track].notes.map((note) => [
    note.pitch,
    note.startTick,
    note.endTick,
  ])

const note = (
  id: number,
  pitch: number,
  startTick: number,
  lengthTicks: number,
  extra: Partial<StudioNote> = {},
): StudioNote => ({
  id,
  pitch,
  startTick,
  lengthTicks,
  velocity: 0.8,
  ...extra,
})

const sequence = (
  id: string,
  notes: StudioNote[],
  tempoBpm = 120,
): StudioSequence => ({
  id,
  ppq: 960,
  tempoBpm,
  lengthTicks: 4 * 7680,
  nextNoteId: notes.length + 1,
  notes,
})

/** A MIDI clip on lane `trackId` from song second `at`, playing seconds `from` to `to` of sequence `sequenceId`. */
const midiClip = (
  id: string,
  trackId: string,
  sequenceId: string,
  place: { at: number; from: number; to: number },
): StudioClip => ({
  id,
  trackId,
  assetId: `asset-${id}`,
  startFrame: frames(place.at),
  sourceInFrame: frames(place.from),
  sourceOutFrame: frames(place.to),
  gainDb: 0,
  fades: { curve: 'linear-amplitude' },
  midi: { sequenceId, renderKey: '0123456789abcdef' },
})

const lane = (
  id: string,
  name: string,
  order: number,
  role: StudioTrack['role'],
) => createStudioTrack({ id, name, order, role })

/** A song at `tempoBpm` of the given lanes, clips and sequences. */
function song(
  parts: {
    tracks: StudioTrack[]
    clips: StudioClip[]
    sequences: StudioSequence[]
  },
  tempoBpm = 120,
): StudioProject {
  return {
    ...createStudioProject({ id: 'song', title: 'Night song', now: TEST_NOW }),
    tempoBpm,
    ...parts,
  }
}

/** studioMidiFixture's two notes and a third, G4 at tick 2880, half a beat long. */
const ADD_G4: StudioCommand = {
  type: 'set-sequence-notes',
  clipId: 'clip-midi',
  notes: [...studioMidiFixture().sequence.notes, note(3, 67, 2880, 480)],
  nextNoteId: 4,
  forkSequenceId: 'fork-1',
}

/** The fixture's clip, with G4, split at 1.75 s through E4, the right half moved to 4 s. */
const SPLIT: StudioCommand[] = [
  ADD_G4,
  {
    type: 'split-clip',
    clipId: 'clip-midi',
    atFrame: frames(1.75),
    newClipId: 'right',
  },
  {
    type: 'move-clip',
    clipId: 'right',
    trackId: 'track-keys',
    startFrame: frames(4),
  },
]

/** studioMidiFixture's song after `commands`, each applied as the Studio applies it. */
function edited(...commands: StudioCommand[]): StudioProject {
  const { project, assets } = studioMidiFixture()
  return commands.reduce(
    (next, command) =>
      applyStudioCommand(next, command, { assets, now: TEST_NOW }),
    project,
  )
}

describe('a MIDI clip in the file', () => {
  it('plays the notes starting inside its window, as its lane’s preview draws them, each cut at the window’s end', () => {
    // Arrange: a window from tick 960 to 3840, the clip at 4 s (tick 7680).
    // One note before the window, one on its first tick, one inside, one
    // across its end and one on it.
    const notes = [
      note(1, 60, 0, 960),
      note(2, 62, 960, 960),
      note(3, 67, 1920, 480),
      note(4, 64, 2880, 1920),
      note(5, 65, 3840, 480),
    ]
    const clip = midiClip('clip', 'keys', 'seq', { at: 4, from: 0.5, to: 2 })
    const project = song({
      tracks: [lane('keys', 'Keys', 0, 'keys')],
      clips: [clip],
      sequences: [sequence('seq', notes)],
    })

    // Act
    const read = songFile(project)

    // Assert: each note 7680 - 960 ticks on, the last cut at the clip's end.
    expect(timed(read)).toEqual([
      [62, 7680, 8640],
      [67, 8640, 9120],
      [64, 9600, 10_560],
    ])
    const window = studioClipTickWindow(clip, project.sequences![0])
    const drawn = studioNotePreview(project.sequences![0], window, 'piano')
    expect(read.tracks[1].notes.map((each) => each.startTick - 6720)).toEqual(
      drawn.notes.map((each) => each.start),
    )
  })

  it('moves its notes with it when it moves', () => {
    // Act: from 1 s to 3 s, 3840 ticks later.
    const before = songFile(edited())
    const after = songFile(
      edited({
        type: 'move-clip',
        clipId: 'clip-midi',
        trackId: 'track-keys',
        startFrame: frames(3),
      }),
    )

    // Assert
    expect(timed(before)).toEqual([
      [60, 1920, 2400],
      [64, 2880, 3840],
    ])
    expect(timed(after)).toEqual([
      [60, 5760, 6240],
      [64, 6720, 7680],
    ])
  })

  it('keeps the notes a trimmed head still plays where the song played them, and drops the rest', () => {
    // Act: the window starts at tick 1920, the second note's, 1.5 s later in the song.
    const read = songFile(
      edited({
        type: 'trim-head',
        clipId: 'clip-midi',
        sourceInFrame: frames(1),
      }),
    )

    // Assert
    expect(timed(read)).toEqual([[64, 2880, 3840]])
  })

  it('cuts a note at a trimmed tail, and ends the lane’s track there', () => {
    // Act: the window ends at tick 2400, half way through the second note.
    const read = songFile(
      edited({
        type: 'trim-tail',
        clipId: 'clip-midi',
        sourceOutFrame: frames(1.25),
      }),
    )

    // Assert
    expect(timed(read)).toEqual([
      [60, 1920, 2400],
      [64, 2880, 3360],
    ])
    expect(read.tracks[1].endTick).toBe(3360)
  })

  it('lays a sequence at another tempo by its seconds, on the song’s tempo', () => {
    // Arrange: a sequence laid at 90 bpm in a song at 120. Its beat 2 is
    // 2/3 s in, which is the song's tick 1280.
    const project = song({
      tracks: [lane('keys', 'Keys', 0, 'keys')],
      clips: [midiClip('clip', 'keys', 'seq', { at: 0, from: 0, to: 4 })],
      sequences: [
        sequence('seq', [note(1, 60, 960, 960), note(2, 64, 1920, 480)], 90),
      ],
    })

    // Act
    const read = songFile(project)

    // Assert
    expect(read.tempos).toEqual([{ tick: 0, microsecondsPerQuarter: 500_000 }])
    expect(timed(read)).toEqual([
      [60, 1280, 2560],
      [64, 2560, 3200],
    ])
  })

  it('keeps a sequence’s ticks, shifted by where its clip starts, when it was laid at the song’s tempo', () => {
    // Arrange: 97 bpm, the clip on the song's beat 2 (frame 29,691, a
    // fraction of a tick past it), playing its sequence from the start.
    const beat = 60 / 97
    const project = song(
      {
        tracks: [lane('keys', 'Keys', 0, 'keys')],
        clips: [
          midiClip('clip', 'keys', 'seq', { at: beat, from: 0, to: 9 * beat }),
        ],
        sequences: [
          sequence('seq', [note(1, 60, 960, 960), note(2, 62, 4321, 7)], 97),
        ],
      },
      97,
    )

    // Act
    const read = songFile(project)

    // Assert
    expect(read.tempos).toEqual([
      { tick: 0, microsecondsPerQuarter: Math.round(60_000_000 / 97) },
    ])
    expect(timed(read)).toEqual([
      [60, 1920, 2880],
      [62, 5281, 5288],
    ])
  })

  it('makes one track of a lane’s two clips, each playing its own window', () => {
    // Act
    const read = songFile(edited(...SPLIT))

    // Assert: the left half cuts E4 at the split; the right half starts
    // after E4 began, so plays only G4, from sequence tick 2400 at 4 s.
    expect(read.tracks.map((track) => track.name)).toEqual([
      'First song',
      'Keys',
    ])
    expect(timed(read)).toEqual([
      [60, 1920, 2400],
      [64, 2880, 3360],
      [67, 8160, 8640],
    ])
    expect(read.tracks[1].endTick).toBe(frames(4.75) / 25)
  })

  it('plays a sequence two clips share once for each, through its own window', () => {
    // Arrange: two clips on one sequence, the second playing only its second note.
    const project = song({
      tracks: [lane('keys', 'Keys', 0, 'keys')],
      clips: [
        midiClip('a', 'keys', 'seq', { at: 0, from: 0, to: 2 }),
        midiClip('b', 'keys', 'seq', { at: 3, from: 1, to: 2 }),
      ],
      sequences: [
        sequence('seq', [note(1, 60, 0, 960), note(2, 64, 1920, 960)]),
      ],
    })

    // Act
    const read = songFile(project)

    // Assert
    expect(timed(read)).toEqual([
      [60, 0, 960],
      [64, 1920, 2880],
      [64, 5760, 6720],
    ])
  })
})

describe('the lanes in the file', () => {
  /** Drums on top, a guitar lane of audio, then Keys: kept in the song in another order. */
  function band(): StudioProject {
    const { project } = studioFixture()
    return {
      ...project,
      tracks: [
        lane('keys', 'Keys', 2, 'keys'),
        { ...project.tracks[0], order: 1 },
        lane('drums', 'Drums', 0, 'drums'),
      ],
      clips: [
        ...project.clips,
        midiClip('keys-clip', 'keys', 'keys-seq', { at: 0, from: 0, to: 2 }),
        midiClip('drum-clip', 'drums', 'drum-seq', { at: 0, from: 0, to: 2 }),
      ],
      sequences: [
        sequence('keys-seq', [note(1, 60, 0, 960, { channel: 3 })]),
        sequence('drum-seq', [
          note(1, 36, 0, 120),
          note(2, 38, 960, 120, { channel: 3 }),
        ]),
      ],
    }
  }

  it('is a track for each lane holding a MIDI clip, named after it, in the lanes’ order', () => {
    // Act
    const read = songFile(band())

    // Assert
    expect(read.tracks.map((track) => track.name)).toEqual([
      'First song',
      'Drums',
      'Keys',
    ])
  })

  it('puts a drum lane on channel 10 with no program, and a piano lane on channel 1 after the acoustic grand, whatever channel a note keeps', () => {
    // Act
    const [, drums, keys] = songFile(band()).tracks

    // Assert
    expect(drums.programs).toEqual([])
    expect(drums.notes.map((each) => [each.channel, each.pitch])).toEqual([
      [9, 36],
      [9, 38],
    ])
    expect(keys.programs).toEqual([{ tick: 0, channel: 0, program: 0 }])
    expect(keys.notes.map((each) => [each.channel, each.pitch])).toEqual([
      [0, 60],
    ])
  })

  it('plays a lane as the kit by its instrument, not only by its role', () => {
    // Arrange: a lane named Keys whose instrument is a drum kit.
    const project = band()
    const kit = {
      ...project,
      tracks: project.tracks.map((track) =>
        track.id === 'keys' ? { ...track, instrument: 'drums' } : track,
      ),
    }

    // Act
    const read = songFile(kit)

    // Assert
    expect(read.tracks[2].name).toBe('Keys')
    expect(read.tracks[2].notes[0].channel).toBe(9)
    expect(read.tracks[2].programs).toEqual([])
  })
})

describe('velocities in the file', () => {
  it('are round(velocity × 127), from 1 to 127, as the note editor reads them', () => {
    expect([0.0001, 0.004, 0.5, 0.8, 1].map(studioMidiVelocity)).toEqual([
      1, 1, 64, 102, 127,
    ])
  })

  it('release round(release × 127), and 64 for a note that keeps none', () => {
    expect([0, 0.25, 1, undefined].map(studioMidiReleaseVelocity)).toEqual([
      0, 32, 127, 64,
    ])
  })

  it('reach the file on each note-on and note-off', () => {
    // Arrange
    const project = song({
      tracks: [lane('keys', 'Keys', 0, 'keys')],
      clips: [midiClip('clip', 'keys', 'seq', { at: 0, from: 0, to: 2 })],
      sequences: [
        sequence('seq', [
          note(1, 60, 0, 480, { velocity: 0.0001 }),
          note(2, 62, 480, 480, { velocity: 0.8, releaseVelocity: 0.25 }),
          note(3, 64, 960, 480, { velocity: 1, releaseVelocity: 1 }),
        ]),
      ],
    })

    // Act
    const read = songFile(project)

    // Assert
    expect(
      read.tracks[1].notes.map((each) => [each.velocity, each.releaseVelocity]),
    ).toEqual([
      [1, 64],
      [102, 32],
      [127, 127],
    ])
  })
})

describe('a pitch in the file', () => {
  it('sounds once at a time: an overlapped note ends where the next of its pitch starts, and the longer of two starting together is kept', () => {
    // Arrange: a C held over another C, and two Es struck together.
    const project = song({
      tracks: [lane('keys', 'Keys', 0, 'keys')],
      clips: [midiClip('clip', 'keys', 'seq', { at: 0, from: 0, to: 2 })],
      sequences: [
        sequence('seq', [
          note(1, 60, 0, 1920),
          note(2, 60, 960, 480),
          note(3, 64, 0, 480, { velocity: 0.5 }),
          note(4, 64, 0, 960, { velocity: 1 }),
        ]),
      ],
    })

    // Act: the reader refuses a pitch struck while it sounds.
    const read = songFile(project)

    // Assert
    expect(
      read.tracks[1].notes.map((each) => [
        each.pitch,
        each.startTick,
        each.endTick,
        each.velocity,
      ]),
    ).toEqual([
      [60, 0, 960, 102],
      [64, 0, 960, 127],
      [60, 960, 1440, 102],
    ])
  })

  it('keeps a note shorter than one of the file’s ticks a tick long', () => {
    // Arrange: a sequence at 300 bpm, a tick of it 10 frames, in a song at
    // 20 bpm, whose tick is 150 frames.
    const project = song(
      {
        tracks: [lane('keys', 'Keys', 0, 'keys')],
        clips: [midiClip('clip', 'keys', 'seq', { at: 0, from: 0, to: 3 })],
        sequences: [sequence('seq', [note(1, 60, 9600, 1)], 300)],
      },
      20,
    )

    // Act
    const read = songFile(project)

    // Assert: tick 9600 at 300 bpm is 2 s, tick 640 at 20 bpm.
    expect(timed(read)).toEqual([[60, 640, 641]])
  })
})

describe('a clip alone in a file', () => {
  const clipFile = (project: StudioProject, clipId: string) =>
    readStudioMidiFile(
      writeStudioMidiFile(studioClipMidiFile(project, clipId)!),
    )

  it('holds that clip’s notes alone, on its lane’s track, where the song has them', () => {
    // Arrange
    const project = edited(...SPLIT)

    // Act
    const right = clipFile(project, 'right')
    const left = clipFile(project, 'clip-midi')

    // Assert
    expect(right.tracks.map((track) => track.name)).toEqual([
      'First song',
      'Keys',
    ])
    expect(timed(right)).toEqual([[67, 8160, 8640]])
    expect(right.tracks[1].endTick).toBe(frames(4.75) / 25)
    expect(timed(left)).toEqual([
      [60, 1920, 2400],
      [64, 2880, 3360],
    ])
    expect(left.tracks[1].endTick).toBe(3360)
  })

  it('is no file for an audio clip or a clip the song does not hold', () => {
    const project = edited(...SPLIT)
    expect(studioClipMidiFile(project, 'clip-1')).toBeNull()
    expect(studioClipMidiFile(project, 'gone')).toBeNull()
  })
})

describe('a song with no MIDI clip', () => {
  it('has no MIDI lane, and its file is the first track alone', () => {
    // Arrange
    const empty = createStudioProject({
      id: 'song',
      title: 'Empty',
      now: TEST_NOW,
    })
    const audio = studioFixture().project

    // Act
    const read = songFile(empty)

    // Assert
    expect(studioMidiLanes(empty)).toEqual([])
    expect(studioMidiLanes(audio)).toEqual([])
    expect(
      studioMidiLanes(studioMidiFixture().project).map((lane) => lane.name),
    ).toEqual(['Keys'])
    expect(studioSongMidiFile(audio).tracks).toEqual([])
    expect(read.tracks).toEqual([
      { name: 'Empty', endTick: 0, programs: [], notes: [] },
    ])
  })
})
