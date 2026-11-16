// Studio note editor tests for a clip's end and a clip just made — the End handle stands on the roll's ruler, and moving it is one trim of the clip to the frame its new end tick ends on, with an id for the clip's own copy, said in words; and a clip opened in Draw opens with Draw pressed.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { createStudioNoteEditorState } from './note-editor-state'
import { StudioNoteEditorHost } from './StudioNoteEditorHost'

beforeAll(async () => {
  await import('./StudioNoteEditor')
})

beforeEach(() => {
  // jsdom draws nothing, and lays nothing out: the roll gets a size here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 900, 420),
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The fixture's keys clip open in the editor, in `tool` when one is given. */
function renderEditor(tool?: 'draw') {
  const fixture = studioMidiFixture()
  const [project] = createSignal<StudioProject>(fixture.project)
  const commands: StudioCommand[] = []
  let state!: ReturnType<typeof createStudioNoteEditorState>
  render(() => {
    state = createStudioNoteEditorState({ project })
    return (
      <StudioNoteEditorHost
        state={state}
        project={project()}
        assets={fixture.assets}
        phone={false}
        tablet={false}
        transport={{
          playing: () => false,
          playheadFrame: () => 0,
          frameNow: () => 0,
        }}
        dispatch={(command) => {
          commands.push(command)
          return true
        }}
        writable
      />
    )
  })
  state.open(fixture.clip.id, tool)
  return { fixture, commands }
}

describe('the editor’s End handle', () => {
  it('trims the clip once to where its new end tick ends, naming a copy of its own, and says where it ends', async () => {
    // Arrange: the clip's window ends on tick 3840, the song's bar 2, beat
    // 2: the sequence's tick 0 falls on the song's second beat.
    const { fixture, commands } = renderEditor()
    const end = await screen.findByRole('slider', { name: 'Clip end' })

    // Act: a sixteenth later, 240 ticks, at 25 frames a tick.
    fireEvent.keyDown(end, { key: 'ArrowRight' })

    // Assert
    expect(commands).toEqual([
      {
        type: 'trim-tail',
        clipId: fixture.clip.id,
        sourceOutFrame: 102_000,
        forkSequenceId: expect.any(String),
      },
    ])
    await waitFor(() =>
      expect(
        document.querySelector('[data-studio-note-status]'),
      ).toHaveTextContent('The clip ends at bar 2, after beat 2.'),
    )
  })
})

describe('a clip opened in Draw', () => {
  it('opens with Draw pressed', async () => {
    // Act
    renderEditor('draw')

    // Assert
    expect(await screen.findByRole('button', { name: 'Draw' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
