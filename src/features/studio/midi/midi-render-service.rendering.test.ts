// Studio MIDI render service tests, rendering clips — a clip whose committed notes have no audio yet is listed as rendering from the edit until its render is ready, so its lane says Rendering…; a failed render ends that, and a draft the note editor renders is the editor's to say, never the lane's.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { editNotes, renderServiceFixture, up } from './midi-render.fixture'

const cleanups: (() => void)[] = []
beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.useRealTimers()
})

function mount() {
  const ui = renderServiceFixture()
  cleanups.push(ui.dispose)
  return ui
}

const listed = (ui: ReturnType<typeof mount>) => [
  ...ui.service.renderingClips(),
]

describe('the clips a render service lists as rendering', () => {
  it('hold a clip from the edit of its notes until a render of them is ready', async () => {
    // Arrange
    const ui = mount()
    const before = listed(ui)

    // Act
    ui.setProject(editNotes(ui.fixture.project, up))
    const edited = listed(ui)
    await vi.advanceTimersByTimeAsync(250)
    const running = listed(ui)
    ui.renderer.calls[0].resolve()
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(before).toEqual([])
    expect(edited).toEqual(['clip-midi'])
    expect(running).toEqual(['clip-midi'])
    expect(listed(ui)).toEqual([])
  })

  it('let a clip go when its render fails: its lane says that instead', async () => {
    // Arrange
    const ui = mount()
    ui.setProject(editNotes(ui.fixture.project, up))
    await vi.advanceTimersByTimeAsync(250)

    // Act
    ui.renderer.calls[0].reject(new Error('No kit'))
    await vi.advanceTimersByTimeAsync(50)

    // Assert
    expect(ui.service.renderState('clip-midi')).toBe('failed')
    expect(listed(ui)).toEqual([])
  })

  it('leave out a draft the note editor renders: the editor says that one', async () => {
    // Arrange
    const ui = mount()
    const sequence = ui.fixture.sequence

    // Act
    ui.service.preview('clip-midi', {
      nextNoteId: sequence.nextNoteId,
      notes: sequence.notes.map((note) => ({ ...note, pitch: 70 })),
    })
    await vi.advanceTimersByTimeAsync(250)

    // Assert
    expect(ui.service.renderState('clip-midi')).toBe('rendering')
    expect(listed(ui)).toEqual([])
  })
})
