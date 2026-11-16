// Studio MIDI render command tests — a kept render becomes the audio of every stale clip whose notes have its key now, in one amendment with no undo step; a clip whose notes changed since, or whose audio already matches, keeps its audio; a render shorter than a clip's window is kept, the window silent past it, and one too short for a loop take's passes refused; and undo takes the notes and the audio that matched them back together.
import { describe, expect, it } from 'vitest'
import { studioMidiRenderKey } from '../midi/render-key'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { amendStudioPresent, createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from './history'
import { studioMidiFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioProject } from './types'

const fixture = studioMidiFixture()

/** A render of the edited notes: 3.5 s, its tail past the take's two seconds. */
const RENDER: StudioAsset = {
  ...fixture.assets[1],
  id: 'asset-render',
  normalizedFrameCount: 168_000,
  canonicalPcmId: 'pcm-render',
  canonicalPcmByteLength: 672_032,
}
const OPTIONS = { assets: [...fixture.assets, RENDER], now: TEST_NOW }

const apply = (project: StudioProject, command: StudioCommand) =>
  applyStudioCommand(project, command, OPTIONS)

/** The MIDI clip's notes, its last note a semitone higher. */
const EDIT: StudioCommand = {
  type: 'set-sequence-notes',
  clipId: 'clip-midi',
  notes: fixture.sequence.notes.map((note, index) =>
    index === 1 ? { ...note, pitch: note.pitch + 1 } : note,
  ),
  nextNoteId: fixture.sequence.nextNoteId,
  forkSequenceId: 'fork-1',
}

const editedKey = (project: StudioProject) =>
  studioMidiRenderKey(project.sequences![0], 'piano')

const swap = (renderKey: string, assetId = RENDER.id): StudioCommand => ({
  type: 'set-midi-render',
  assetId,
  renderKey,
})

describe('keeping a MIDI render', () => {
  it('gives every stale clip whose notes have its key the render, split halves both', () => {
    // Arrange
    const edited = apply(apply(fixture.project, EDIT), {
      type: 'split-clip',
      clipId: 'clip-midi',
      atFrame: 72_000,
      newClipId: 'clip-half',
    })
    const key = editedKey(edited)

    // Act
    const kept = apply(edited, swap(key))

    // Assert
    const midi = kept.clips.filter((clip) => clip.midi !== undefined)
    expect(midi.map((clip) => clip.id)).toEqual(['clip-midi', 'clip-half'])
    for (const clip of midi) {
      expect(clip.assetId).toBe(RENDER.id)
      expect(clip.midi?.renderKey).toBe(key)
    }
  })

  it('leaves a clip whose notes changed since the render began, and changes nothing', () => {
    // Arrange
    const edited = apply(fixture.project, EDIT)
    const key = editedKey(edited)
    const undone = apply(edited, {
      ...EDIT,
      notes: fixture.sequence.notes,
    } as StudioCommand)

    // Act
    const kept = apply(undone, swap(key))

    // Assert
    expect(kept).toBe(undone)
  })

  it('leaves a stale clip whose notes changed again since the render began', () => {
    // Arrange
    const edited = apply(fixture.project, EDIT)
    const key = editedKey(edited)
    const again = apply(edited, {
      ...EDIT,
      notes: fixture.sequence.notes.map((note) => ({
        ...note,
        pitch: note.pitch + 2,
      })),
    } as StudioCommand)

    // Act
    const kept = apply(again, swap(key))

    // Assert
    expect(kept).toBe(again)
  })

  it('leaves a clip whose audio already matches its notes, such as a recorded take', () => {
    // Arrange
    const { project, clip } = fixture

    // Act
    const kept = apply(project, swap(clip.midi!.renderKey))

    // Assert
    expect(kept).toBe(project)
  })

  it("keeps a render shorter than a clip's window, the window silent past it", () => {
    // Arrange: the window runs to 96,000 frames.
    const edited = apply(fixture.project, EDIT)
    const short = { ...RENDER, id: 'asset-short', normalizedFrameCount: 90_000 }
    const options = { ...OPTIONS, assets: [...OPTIONS.assets, short] }

    // Act
    const kept = applyStudioCommand(
      edited,
      swap(editedKey(edited), short.id),
      options,
    )

    // Assert
    expect(kept.clips.find((clip) => clip.id === 'clip-midi')?.assetId).toBe(
      short.id,
    )
  })

  it("refuses a render too short for a loop take's passes", () => {
    // Arrange: two passes of 48,000 frames, the clip on the second.
    const looped = {
      ...fixture.project,
      clips: fixture.project.clips.map((clip) =>
        clip.id === 'clip-midi'
          ? {
              ...clip,
              sourceInFrame: 48_000,
              sourceOutFrame: 96_000,
              passes: { firstFrame: 0, frames: 48_000, count: 2 },
            }
          : clip,
      ),
    }
    const edited = apply(looped, EDIT)
    const short = { ...RENDER, id: 'asset-short', normalizedFrameCount: 90_000 }
    const options = { ...OPTIONS, assets: [...OPTIONS.assets, short] }

    // Act, Assert
    expect(() =>
      applyStudioCommand(edited, swap(editedKey(edited), short.id), options),
    ).toThrow(/Passes exceed owned audio/)
  })

  it('takes no undo step, and undo and redo bring the notes back with the audio that matched them', () => {
    // Arrange
    const history = executeStudioCommand(
      createStudioHistory(fixture.project),
      EDIT,
      OPTIONS,
    )
    const key = editedKey(history.present)

    // Act
    const kept = amendStudioPresent(history, swap(key), OPTIONS)
    const undone = undoStudioCommand(kept, OPTIONS)
    const redone = redoStudioCommand(undone, OPTIONS)

    // Assert
    const midiClip = (project: StudioProject) =>
      project.clips.find((clip) => clip.id === 'clip-midi')!
    expect(kept.past).toEqual(history.past)
    expect(midiClip(undone.present).assetId).toBe(fixture.clip.assetId)
    expect(undone.present.sequences).toEqual(fixture.project.sequences)
    expect(midiClip(redone.present).assetId).toBe(RENDER.id)
    expect(midiClip(redone.present).midi?.renderKey).toBe(
      editedKey(redone.present),
    )
  })
})
