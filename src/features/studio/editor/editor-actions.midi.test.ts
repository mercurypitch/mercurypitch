// Studio MIDI clipboard tests — a copied MIDI clip pastes onto the notes it was copied with: sharing its sequence while the song holds it as copied, and bringing a copy of its own when the clip was deleted first (its sequence dropped with it) or its notes were edited since; undo takes the copy away with the clip.
import { describe, expect, it, vi } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from '@/lib/studio/model/history'
import { studioMidiFixture, TEST_NOW, } from '@/lib/studio/model/model.test-fixtures'
import { createEditorActions } from './editor-actions'

/** Where the pasted clip lands on the Keys lane: past the end of the clip copied. */
const PLAYHEAD = 240_000

function midiClipboard() {
  const fixture = studioMidiFixture()
  const options = { assets: fixture.assets, now: TEST_NOW }
  let history = createStudioHistory(fixture.project)
  let ids = 0
  const actions = createEditorActions({
    project: () => history.present,
    writable: () => true,
    playheadFrame: () => PLAYHEAD,
    pixelsPerSecond: () => 100,
    dispatch: (command: StudioCommand) => {
      history = executeStudioCommand(history, command, options)
      return true
    },
    selectClip: vi.fn(),
    previewClip: vi.fn(),
    announce: vi.fn(),
    createId: () => `generated-${++ids}`,
  })
  return {
    ...fixture,
    actions,
    song: () => history.present,
    edit: (command: StudioCommand) => {
      history = executeStudioCommand(history, command, options)
    },
    undo: () => {
      history = undoStudioCommand(history, options)
    },
  }
}

describe('the Studio clipboard with a MIDI clip', () => {
  it('pastes a copied MIDI clip onto the sequence it shares, while the song holds it as it was copied', () => {
    // Arrange
    const f = midiClipboard()
    f.actions.copy(f.clip.id)

    // Act
    f.actions.paste('track-keys')

    // Assert
    const pasted = f.song().clips.find((each) => each.startFrame === PLAYHEAD)
    expect(pasted?.midi).toEqual(f.clip.midi)
    expect(f.song().sequences).toEqual([f.sequence])
  })

  it('pastes a MIDI clip copied and then deleted with a copy of its notes, which undo takes away with it', () => {
    // Arrange: deleting the clip drops its sequence with it.
    const f = midiClipboard()
    f.actions.copy(f.clip.id)
    f.actions.remove(f.clip.id)
    const deleted = f.song()

    // Act
    f.actions.paste('track-keys')

    // Assert
    const pasted = f.song().clips.find((each) => each.startFrame === PLAYHEAD)!
    expect(deleted).not.toHaveProperty('sequences')
    expect(pasted.midi).toEqual({
      sequenceId: 'generated-2',
      renderKey: f.clip.midi!.renderKey,
    })
    expect(f.song().sequences).toEqual([{ ...f.sequence, id: 'generated-2' }])
    f.undo()
    expect(f.song()).toEqual({ ...deleted, revision: deleted.revision + 2 })
  })

  it('pastes the notes as they were copied, not as they were edited since', () => {
    // Arrange: the clip copied, then its first note deleted.
    const f = midiClipboard()
    f.actions.copy(f.clip.id)
    f.edit({
      type: 'set-sequence-notes',
      clipId: f.clip.id,
      notes: f.sequence.notes.slice(1),
      nextNoteId: f.sequence.nextNoteId,
      forkSequenceId: 'unused',
    })

    // Act
    f.actions.paste('track-keys')

    // Assert
    const pasted = f.song().clips.find((each) => each.startFrame === PLAYHEAD)!
    const notesOf = (id: string) =>
      f.song().sequences?.find((each) => each.id === id)?.notes
    expect(notesOf(pasted.midi!.sequenceId)).toEqual(f.sequence.notes)
    expect(notesOf(f.sequence.id)).toEqual(f.sequence.notes.slice(1))
  })
})
