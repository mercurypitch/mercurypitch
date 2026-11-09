// Studio sequence command tests — a sequence comes in the batch that adds its clip and goes with one undo; a clip's notes are set in place, or on a copy of its own when other clips share them, never reusing an id; a sequence no clip names goes with the command that leaves it so and comes back on undo; split, duplicate, paste, move, passes and punch carry a clip's midi as it is; and an amendment changes the present without an undo step.
import { describe, expect, it } from 'vitest'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { amendStudioPresent, createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioMidiFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioClip, StudioNote, StudioProject } from './types'

const { assets } = studioMidiFixture()
const OPTIONS = { assets, now: TEST_NOW }

const apply = (project: StudioProject, command: StudioCommand) =>
  applyStudioCommand(project, command, OPTIONS)

const clipById = (project: StudioProject, id: string): StudioClip =>
  project.clips.find((clip) => clip.id === id)!

/** A third note for the fixture's sequence, with the id it hands out next. */
const NEW_NOTE: StudioNote = {
  id: 3,
  pitch: 67,
  startTick: 2880,
  lengthTicks: 240,
  velocity: 0.6,
}

describe('adding a sequence', () => {
  it('adds a sequence in the batch that adds its clip, and one undo takes both away', () => {
    // Arrange
    const { project, clip, sequence } = studioMidiFixture()
    const { sequences: _none, ...audio } = project
    const before = {
      ...audio,
      clips: project.clips.filter((each) => each.id !== clip.id),
    }
    const history = createStudioHistory(before)

    // Act
    const added = executeStudioCommand(
      history,
      {
        type: 'batch',
        commands: [
          { type: 'add-sequence', sequence },
          { type: 'add-clip', clip },
        ],
      },
      OPTIONS,
    )
    const undone = undoStudioCommand(added, OPTIONS)

    // Assert
    expect(added.past).toHaveLength(1)
    expect(added.present.sequences).toEqual([sequence])
    expect(clipById(added.present, clip.id).midi).toEqual(clip.midi)
    expect(undone.present).not.toHaveProperty('sequences')
    expect(undone.present.clips).toEqual(history.present.clips)
  })

  it('drops a sequence added with no clip to name it, so the song is unchanged', () => {
    // Arrange
    const { project, sequence } = studioMidiFixture()

    // Act, Assert
    expect(
      apply(project, {
        type: 'add-sequence',
        sequence: { ...sequence, id: 'alone' },
      }),
    ).toBe(project)
  })

  it('refuses a sequence by an id the song holds', () => {
    // Arrange
    const { project, sequence } = studioMidiFixture()

    // Act, Assert
    expect(() => apply(project, { type: 'add-sequence', sequence })).toThrow(
      /Sequence already exists/,
    )
  })
})

describe("setting a clip's notes", () => {
  it('sets the notes in place when the clip alone plays its sequence, its render key left to say its audio is due', () => {
    // Arrange
    const { project, clip, sequence } = studioMidiFixture()

    // Act
    const edited = apply(project, {
      type: 'set-sequence-notes',
      clipId: clip.id,
      notes: [...sequence.notes, NEW_NOTE],
      nextNoteId: 4,
      forkSequenceId: 'unused',
    })

    // Assert
    expect(edited.sequences).toEqual([
      { ...sequence, notes: [...sequence.notes, NEW_NOTE], nextNoteId: 4 },
    ])
    expect(clipById(edited, clip.id).midi).toEqual(clip.midi)
    expect(edited.revision).toBe(project.revision + 1)
  })

  it('gives a clip that shares its sequence a copy of its own, leaving the other clip as it was, and undo shares it again', () => {
    // Arrange: a duplicate shares the clip's sequence.
    const { project, clip, sequence } = studioMidiFixture()
    const shared = executeStudioCommand(
      createStudioHistory(project),
      {
        type: 'duplicate-clip',
        clipId: clip.id,
        newClipId: 'clip-copy',
        newTrackId: 'unused-lane',
      },
      OPTIONS,
    )

    // Act
    const forked = executeStudioCommand(
      shared,
      {
        type: 'set-sequence-notes',
        clipId: 'clip-copy',
        notes: [NEW_NOTE],
        nextNoteId: 4,
        forkSequenceId: 'sequence-copy',
      },
      OPTIONS,
    )

    // Assert
    expect(clipById(shared.present, 'clip-copy').midi).toEqual(clip.midi)
    expect(forked.present.sequences).toEqual([
      sequence,
      { ...sequence, id: 'sequence-copy', notes: [NEW_NOTE], nextNoteId: 4 },
    ])
    expect(clipById(forked.present, 'clip-copy').midi).toEqual({
      ...clip.midi,
      sequenceId: 'sequence-copy',
    })
    expect(clipById(forked.present, clip.id).midi).toEqual(clip.midi)
    expect(undoStudioCommand(forked, OPTIONS).present.sequences).toEqual([
      sequence,
    ])
  })

  it('never hands out a note id twice', () => {
    // Arrange: note 2 deleted, so its id is spent.
    const { project, clip, sequence } = studioMidiFixture()
    const [first, second] = sequence.notes
    const set = (notes: readonly StudioNote[], nextNoteId: number) => () =>
      apply(project, {
        type: 'set-sequence-notes',
        clipId: clip.id,
        notes,
        nextNoteId,
        forkSequenceId: 'unused',
      })

    // Act, Assert
    expect(set([first], 3)).not.toThrow()
    expect(set([first, { ...second, pitch: 70 }], 3)).not.toThrow()
    expect(set([first, { ...NEW_NOTE, id: 2 }], 3)).not.toThrow()
    const spent = apply(project, {
      type: 'set-sequence-notes',
      clipId: clip.id,
      notes: [first],
      nextNoteId: 3,
      forkSequenceId: 'unused',
    })
    expect(() =>
      apply(spent, {
        type: 'set-sequence-notes',
        clipId: clip.id,
        notes: [first, { ...NEW_NOTE, id: 2 }],
        nextNoteId: 3,
        forkSequenceId: 'unused',
      }),
    ).toThrow(/Note ids are never reused/)
    expect(set(sequence.notes, 2)).toThrow(/Note ids are never reused/)
    expect(set([first, NEW_NOTE], 3)).toThrow(/below nextNoteId/)
  })

  it('changes nothing when the notes are as they were, and copies no shared sequence for it', () => {
    // Arrange: a duplicate shares the clip's sequence.
    const { project, clip, sequence } = studioMidiFixture()
    const shared = apply(project, {
      type: 'duplicate-clip',
      clipId: clip.id,
      newClipId: 'clip-copy',
      newTrackId: 'unused-lane',
    })

    // Act, Assert
    expect(
      apply(shared, {
        type: 'set-sequence-notes',
        clipId: 'clip-copy',
        notes: sequence.notes,
        nextNoteId: sequence.nextNoteId,
        forkSequenceId: 'sequence-copy',
      }),
    ).toBe(shared)
  })

  it('refuses notes for a clip that plays none', () => {
    // Arrange
    const { project, sequence } = studioMidiFixture()

    // Act, Assert
    expect(() =>
      apply(project, {
        type: 'set-sequence-notes',
        clipId: 'clip-1',
        notes: sequence.notes,
        nextNoteId: 3,
        forkSequenceId: 'unused',
      }),
    ).toThrow(/Clip plays no notes/)
  })
})

describe('sequences no clip names', () => {
  it.each<[string, StudioCommand]>([
    ['removing its clip', { type: 'remove-clip', clipId: 'clip-midi' }],
    ['removing its lane', { type: 'remove-track', trackId: 'track-keys' }],
    [
      'a punch over all of its clip',
      {
        type: 'punch-clip',
        clip: {
          id: 'take-clip',
          trackId: 'track-keys',
          assetId: 'asset-midi',
          startFrame: 40_000,
          sourceInFrame: 0,
          sourceOutFrame: 90_000,
          gainDb: 0,
          fades: { curve: 'linear-amplitude' },
        },
        afterClipId: 'clip-after',
        fadeFrames: 0,
      },
    ],
  ])('go with %s, and come back on undo', (_case, command) => {
    // Arrange
    const { project, sequence } = studioMidiFixture()
    const history = createStudioHistory(project)

    // Act
    const left = executeStudioCommand(history, command, OPTIONS)

    // Assert
    expect(left.present).not.toHaveProperty('sequences')
    expect(undoStudioCommand(left, OPTIONS).present.sequences).toEqual([
      sequence,
    ])
  })
})

describe("a clip's midi through placement edits", () => {
  it.each<[string, StudioCommand, string[]]>([
    [
      'a split, both halves',
      {
        type: 'split-clip',
        clipId: 'clip-midi',
        atFrame: 84_000,
        newClipId: 'clip-right',
      },
      ['clip-midi', 'clip-right'],
    ],
    [
      'a duplicate',
      {
        type: 'duplicate-clip',
        clipId: 'clip-midi',
        newClipId: 'clip-copy',
        newTrackId: 'unused-lane',
      },
      ['clip-midi', 'clip-copy'],
    ],
    [
      'a move',
      {
        type: 'move-clip',
        clipId: 'clip-midi',
        trackId: 'track-keys',
        startFrame: 200_000,
      },
      ['clip-midi'],
    ],
    [
      'a move to a new lane',
      {
        type: 'move-clip-to-new-track',
        clipId: 'clip-midi',
        startFrame: 200_000,
        newTrackId: 'track-new',
      },
      ['clip-midi'],
    ],
    [
      'a paste, which shares its sequence',
      {
        type: 'paste-clip',
        clip: studioMidiFixture().clip,
        trackId: 'track-keys',
        startFrame: 300_000,
        newClipId: 'clip-pasted',
        newTrackId: 'unused-lane',
      },
      ['clip-midi', 'clip-pasted'],
    ],
    [
      "a punch's parts on either side",
      {
        type: 'punch-clip',
        clip: {
          id: 'take-clip',
          trackId: 'track-keys',
          assetId: 'asset-1',
          startFrame: 60_000,
          sourceInFrame: 0,
          sourceOutFrame: 1000,
          gainDb: 0,
          fades: { curve: 'linear-amplitude' },
        },
        afterClipId: 'clip-after',
        fadeFrames: 0,
      },
      ['clip-midi', 'clip-after'],
    ],
  ])('carries it as it is through %s', (_case, command, playing) => {
    // Arrange
    const { project, clip, sequence } = studioMidiFixture()

    // Act
    const placed = apply(project, command)

    // Assert
    expect(
      placed.clips
        .filter((each) => each.midi !== undefined)
        .map((each) => each.id),
    ).toEqual(playing)
    for (const id of playing)
      expect(clipById(placed, id).midi).toEqual(clip.midi)
    expect(placed.sequences).toEqual([sequence])
  })

  it("carries it as it is when a loop take's clip moves to another pass", () => {
    // Arrange: two one-second passes, the clip on the second.
    const { project, clip } = studioMidiFixture()
    const loop: StudioClip = {
      ...clip,
      startFrame: 48_000,
      sourceInFrame: 48_000,
      sourceOutFrame: 96_000,
      passes: { firstFrame: 0, frames: 48_000, count: 2 },
    }
    const song = {
      ...project,
      clips: project.clips.map((each) => (each.id === clip.id ? loop : each)),
    }

    // Act
    const moved = apply(song, {
      type: 'choose-pass',
      clipId: clip.id,
      pass: 0,
    })

    // Assert
    expect(clipById(moved, clip.id)).toMatchObject({
      sourceInFrame: 0,
      midi: clip.midi,
    })
  })

  it('refuses a paste of a MIDI clip whose sequence the song no longer holds, without the copy of it', () => {
    // Arrange
    const { project, clip } = studioMidiFixture()
    const removed = apply(project, { type: 'remove-clip', clipId: clip.id })

    // Act, Assert
    expect(() =>
      apply(removed, {
        type: 'paste-clip',
        clip,
        trackId: 'track-keys',
        startFrame: 300_000,
        newClipId: 'clip-pasted',
        newTrackId: 'unused-lane',
      }),
    ).toThrow(/The copied notes are gone/)
  })
})

describe('amendStudioPresent', () => {
  it('changes the present without an undo step, keeping the past and the future, at a fresh revision', () => {
    // Arrange: two renames, the second undone, so there is a past and a future.
    const { project, clip } = studioMidiFixture()
    let history = createStudioHistory(project)
    for (const title of ['A', 'B'])
      history = executeStudioCommand(
        history,
        { type: 'rename-project', title },
        OPTIONS,
      )
    history = undoStudioCommand(history, OPTIONS)

    // Act
    const amended = amendStudioPresent(
      history,
      { type: 'set-clip-gain', clipId: clip.id, gainDb: -3 },
      OPTIONS,
    )

    // Assert
    expect(amended.past).toBe(history.past)
    expect(amended.future).toBe(history.future)
    expect(amended.present.revision).toBe(history.present.revision + 1)
    expect(clipById(amended.present, clip.id).gainDb).toBe(-3)
    expect(amended.present.title).toBe('A')
  })

  it('hands the history back as it is when the amendment changes nothing', () => {
    // Arrange
    const { project } = studioMidiFixture()
    const history = createStudioHistory(project)

    // Act, Assert
    expect(
      amendStudioPresent(
        history,
        { type: 'rename-project', title: project.title },
        OPTIONS,
      ),
    ).toBe(history)
  })
})
