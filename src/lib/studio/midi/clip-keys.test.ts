// Studio MIDI clip key tests — a clip whose audio was recorded from its notes is not stale; an edit of its notes, or a move to a lane that plays the drum kit, makes it stale with the key of what it should be rendered from; and each sequence's content is hashed once, however often the song is read and however many commands clone it.
import { describe, expect, it, vi } from 'vitest'
import { applyStudioCommand } from '../model/commands'
import { createStudioTrack } from '../model/defaults'
import { studioMidiFixture, TEST_NOW } from '../model/model.test-fixtures'
import type { StudioProject } from '../model/types'
import { createStudioMidiKeys } from './clip-keys'
import { studioMidiRenderKey } from './render-key'

const { assets } = studioMidiFixture()
const OPTIONS = { assets, now: TEST_NOW }

/** The fixture's song with a drum lane beside its Keys lane. */
function withDrums(): StudioProject {
  const { project } = studioMidiFixture()
  return applyStudioCommand(
    project,
    {
      type: 'add-track',
      track: createStudioTrack({
        id: 'track-drums',
        name: 'Drums',
        order: 2,
        role: 'drums',
      }),
    },
    OPTIONS,
  )
}

/** `project` with its MIDI clip's last note a semitone higher. */
function edited(project: StudioProject): StudioProject {
  const sequence = project.sequences![0]
  return applyStudioCommand(
    project,
    {
      type: 'set-sequence-notes',
      clipId: 'clip-midi',
      notes: sequence.notes.map((note, index) =>
        index === 1 ? { ...note, pitch: note.pitch + 1 } : note,
      ),
      nextNoteId: sequence.nextNoteId,
      forkSequenceId: 'fork-1',
    },
    OPTIONS,
  )
}

describe('a MIDI clip going stale', () => {
  it('is not stale while its audio is the one recorded from its notes', () => {
    // Arrange
    const { project, clip, sequence } = studioMidiFixture()
    const keys = createStudioMidiKeys()

    // Act
    const stale = keys.staleClips(project)

    // Assert
    expect(stale).toEqual([])
    expect(keys.clipKey(project, clip)).toBe(
      studioMidiRenderKey(sequence, 'piano'),
    )
  })

  it('is stale once its notes change, with the key of its new notes', () => {
    // Arrange
    const keys = createStudioMidiKeys()
    const song = edited(studioMidiFixture().project)

    // Act
    const stale = keys.staleClips(song)

    // Assert
    const sequence = song.sequences![0]
    expect(stale).toHaveLength(1)
    expect(stale[0].clip.id).toBe('clip-midi')
    expect(stale[0].sound).toBe('piano')
    expect(stale[0].key).toBe(studioMidiRenderKey(sequence, 'piano'))
    expect(stale[0].key).not.toBe(stale[0].clip.midi?.renderKey)
  })

  it('is stale on a lane that plays the drum kit, and not once it is back on its own', () => {
    // Arrange
    const keys = createStudioMidiKeys()
    const song = withDrums()
    const move = (project: StudioProject, trackId: string) =>
      applyStudioCommand(
        project,
        {
          type: 'move-clip',
          clipId: 'clip-midi',
          trackId,
          startFrame: 48_000,
        },
        OPTIONS,
      )

    // Act
    const onDrums = move(song, 'track-drums')
    const back = move(onDrums, 'track-keys')

    // Assert
    const [stale] = keys.staleClips(onDrums)
    expect(stale.sound).toBe('drums')
    expect(stale.key).toBe(studioMidiRenderKey(stale.sequence, 'drums'))
    expect(keys.staleClips(back)).toEqual([])
  })

  it('has no key as audio, or once its lane is gone', () => {
    // Arrange
    const { project } = studioMidiFixture()
    const keys = createStudioMidiKeys()
    const audio = project.clips.find((clip) => clip.midi === undefined)!
    const orphan = { ...project.clips[1], trackId: 'track-gone' }

    // Act, Assert
    expect(keys.clipKey(project, audio)).toBeNull()
    expect(keys.clipKey(project, orphan)).toBeNull()
  })
})

describe('hashing a sequence', () => {
  it('hashes a sequence object once, however often the song is read', () => {
    // Arrange
    const hash = vi.fn(studioMidiRenderKey)
    const keys = createStudioMidiKeys(hash)
    const song = edited(studioMidiFixture().project)

    // Act
    for (let read = 0; read < 5; read++) keys.staleClips(song)

    // Assert
    expect(hash).toHaveBeenCalledOnce()
  })

  it('hashes nothing again when a command elsewhere in the song clones every sequence', () => {
    // Arrange
    const hash = vi.fn(studioMidiRenderKey)
    const keys = createStudioMidiKeys(hash)
    const song = edited(studioMidiFixture().project)
    keys.staleClips(song)

    // Act
    const renamed = applyStudioCommand(
      song,
      { type: 'rename-project', title: 'Second song' },
      OPTIONS,
    )
    const stale = keys.staleClips(renamed)

    // Assert
    expect(renamed.sequences![0]).not.toBe(song.sequences![0])
    expect(hash).toHaveBeenCalledOnce()
    expect(stale[0].key).toBe(keys.staleClips(song)[0].key)
  })

  it('hashes once more when the notes change', () => {
    // Arrange
    const hash = vi.fn(studioMidiRenderKey)
    const keys = createStudioMidiKeys(hash)
    const { project } = studioMidiFixture()
    keys.staleClips(edited(project))

    // Act
    const again = edited(edited(project))
    keys.staleClips(again)

    // Assert
    expect(hash).toHaveBeenCalledTimes(2)
  })
})
