// Studio note editor state tests — the editor opens on a MIDI clip and never on an audio one; it closes by itself when its clip is deleted, stops playing MIDI or another song opens, and expanded goes with it; and a drawer height is kept on this device until it is set back to automatic.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { createStudioNoteEditorState, STUDIO_NOTE_EDITOR_HEIGHT_KEY, } from './note-editor-state'

const disposers: (() => void)[] = []

afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose()
  window.localStorage.removeItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY)
})

/** The state over a song held in a signal, so a test can change the song. */
function stateOver(start: StudioProject) {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const [project, setProject] = createSignal<StudioProject | null>(start)
    return { state: createStudioNoteEditorState({ project }), setProject }
  })
}

describe('opening', () => {
  it('opens on a MIDI clip and gives that clip', () => {
    // Arrange
    const { project, clip } = studioMidiFixture()
    const { state } = stateOver(project)

    // Act
    const opened = state.open(clip.id)

    // Assert
    expect(opened).toBe(true)
    expect(state.clipId()).toBe('clip-midi')
    expect(state.clip()).toBe(clip)
  })

  it('refuses an audio clip, and a clip the song does not hold', () => {
    const { project } = studioMidiFixture()
    const { state } = stateOver(project)

    expect(state.open('clip-1')).toBe(false)
    expect(state.open('no-such-clip')).toBe(false)
    expect(state.clipId()).toBeNull()
  })
})

describe('closing by itself', () => {
  it('closes when its clip is deleted, and forgets that it filled the arrangement', () => {
    // Arrange
    const { project, clip } = studioMidiFixture()
    const { state, setProject } = stateOver(project)
    state.open(clip.id)
    state.setExpanded(true)

    // Act
    setProject({
      ...project,
      revision: project.revision + 1,
      clips: project.clips.filter((each) => each.id !== clip.id),
    })

    // Assert
    expect(state.clipId()).toBeNull()
    expect(state.expanded()).toBe(false)
  })

  it('closes when its clip no longer plays MIDI', () => {
    const { project, clip } = studioMidiFixture()
    const { state, setProject } = stateOver(project)
    state.open(clip.id)

    setProject({
      ...project,
      clips: project.clips.map((each) =>
        each.id === clip.id ? { ...each, midi: undefined } : each,
      ),
    })

    expect(state.clipId()).toBeNull()
  })

  it('closes when another song opens, even one with a clip of the same id', () => {
    const { project, clip } = studioMidiFixture()
    const { state, setProject } = stateOver(project)
    state.open(clip.id)

    setProject({ ...project, id: 'project-2' })

    expect(state.clipId()).toBeNull()
  })

  it('stays open through an edit that keeps its clip', () => {
    const { project, clip } = studioMidiFixture()
    const { state, setProject } = stateOver(project)
    state.open(clip.id)

    setProject({
      ...project,
      revision: project.revision + 1,
      clips: project.clips.map((each) =>
        each.id === clip.id ? { ...each, startFrame: 96_000 } : each,
      ),
    })

    expect(state.clipId()).toBe(clip.id)
    expect(state.clip()?.startFrame).toBe(96_000)
  })
})

describe('the drawer height', () => {
  it('keeps a chosen height on this device, and forgets it when set back to automatic', () => {
    // Arrange
    const { project } = studioMidiFixture()
    const first = stateOver(project).state

    // Act
    first.setHeight(412.4)
    const later = stateOver(project).state

    // Assert
    expect(later.height()).toBe(412)
    expect(window.localStorage.getItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY)).toBe(
      '412',
    )
    later.setHeight(null)
    expect(stateOver(project).state.height()).toBeNull()
  })
})
