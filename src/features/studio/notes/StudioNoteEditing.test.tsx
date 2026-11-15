// Studio note editing tests — the open editor carries its tools, each named, the selection's edits off with a word until notes are selected; B switches to Draw and back; a key's edit is one set-sequence-notes with its own fork id; the toolbar's velocity reads the selection 1 to 127 and moves it by 8; Escape clears the selection and then closes; a refused edit says so; notes copied in one opening paste in the next; a song that cannot be edited now edits nothing; and the render service hears a draft until its commit, is told when the editor closes, and its render's state shows in the header.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { StudioNoteSet } from '@/lib/studio/midi/notes'
import type { StudioCommand } from '@/lib/studio/model/commands'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import type { StudioMidiEditorApi, StudioMidiRenderState, } from '../midi/midi-render-editor'
import { StudioMidiEditorContext } from '../midi/midi-render-editor'
import { createStudioNoteEditorState } from './note-editor-state'
import { NOTE_RENDER_FAILED } from './StudioNoteEditor'
import { StudioNoteEditorHost } from './StudioNoteEditorHost'

beforeAll(async () => {
  await import('./StudioNoteEditor')
})

beforeEach(() => {
  // jsdom draws nothing, and lays nothing out: the roll gets a size here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 900,
    height: 420,
    right: 900,
    bottom: 420,
    toJSON: () => ({}),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const transport = {
  playing: () => false,
  playheadFrame: () => 0,
  frameNow: () => 0,
}

/** The fixture's song with its MIDI clip on a Keys lane: middle C (id 1, 0.8) and the E above (id 2, 0.5) in its window. */
function renderEditor(
  options: {
    writable?: boolean
    refuse?: boolean
    renders?: StudioMidiEditorApi
    /** What happened, in order: each command's type. */
    log?: string[]
  } = {},
) {
  const fixture = studioMidiFixture()
  const [project] = createSignal<StudioProject>(fixture.project)
  const commands: StudioCommand[] = []
  const dispatch = vi.fn((command: StudioCommand) => {
    commands.push(command)
    options.log?.push(command.type)
    return options.refuse !== true
  })
  let state!: ReturnType<typeof createStudioNoteEditorState>
  render(() => {
    state = createStudioNoteEditorState({ project })
    return (
      <StudioMidiEditorContext.Provider value={options.renders}>
        <button type="button" data-studio-clip={fixture.clip.id}>
          Keys
        </button>
        <StudioNoteEditorHost
          state={state}
          project={project()}
          assets={fixture.assets}
          phone={false}
          tablet={false}
          transport={transport}
          dispatch={dispatch}
          writable={options.writable !== false}
        />
      </StudioMidiEditorContext.Provider>
    )
  })
  state.open(fixture.clip.id)
  return { state, fixture, commands, dispatch }
}

const editor = () => screen.findByRole('region', { name: /^Note editor: Keys/ })

/** The editor open, its roll laid out and its view made. */
async function opened() {
  const region = await editor()
  await waitFor(() =>
    expect(region.querySelector('[data-studio-note-roll]')).toHaveAttribute(
      'data-studio-note-roll',
    ),
  )
  return region
}

/** The notes a set-sequence-notes command sets. */
const notesOf = (command: StudioCommand | undefined) =>
  command?.type === 'set-sequence-notes' ? command.notes : []

/** The render service's editor API, faked: it logs each preview, and its render's state is a signal. */
function fakeRenders(
  log: string[] = [],
  start: StudioMidiRenderState = 'idle',
) {
  const [render, setRender] = createSignal<StudioMidiRenderState>(start)
  const previews: (StudioNoteSet | null)[] = []
  const editorClosed = vi.fn(() => Promise.resolve())
  const renders: StudioMidiEditorApi = {
    preview(_clipId, draft) {
      previews.push(draft)
      log.push(draft === null ? 'draft ended' : 'draft')
    },
    editorClosed,
    renderState: () => render,
  }
  return { renders, previews, editorClosed, setRender }
}

const press = (target: Element, key: string, extra = {}) => {
  fireEvent.keyDown(target, { key, ...extra })
  fireEvent.keyUp(target, { key, ...extra })
}

describe('the tools', () => {
  it("name every control, Select pressed, and the selection's edits off until notes are selected", async () => {
    // Arrange
    renderEditor()
    await opened()

    // Assert
    const tools = screen.getByRole('group', { name: 'Tool' })
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(tools).toContainElement(screen.getByRole('button', { name: 'Draw' }))
    expect(screen.getByRole('combobox', { name: 'Snap' })).toHaveValue('1/16')
    expect(screen.getByRole('button', { name: 'Quantize' })).toBeEnabled()
    const duplicate = screen.getByRole('button', { name: 'Duplicate' })
    expect(duplicate).toBeDisabled()
    expect(duplicate).toHaveAttribute('title', 'Select notes first')
  })

  it('switch to Draw with B, and back', async () => {
    const region = await (renderEditor(), opened())
    const draw = screen.getByRole('button', { name: 'Draw' })

    press(region, 'b')
    const pressed = draw.getAttribute('aria-pressed')
    press(region, 'b')

    expect(pressed).toBe('true')
    expect(draw).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('an edit', () => {
  it('is one set-sequence-notes with an id of its own for the clip’s copy', async () => {
    // Arrange
    const { commands, fixture } = renderEditor()
    const region = await opened()

    // Act: select every note, then delete them.
    press(region, 'a', { ctrlKey: true })
    press(region, 'Delete')

    // Assert
    expect(commands).toHaveLength(1)
    expect(commands[0]).toMatchObject({
      type: 'set-sequence-notes',
      clipId: fixture.clip.id,
      notes: [],
      nextNoteId: 3,
    })
    expect(commands[0]).toHaveProperty('forkSequenceId', expect.any(String))
  })

  it("reads the selection's velocity 1 to 127, and moves it by 8 from the toolbar", async () => {
    const { commands } = renderEditor()
    const region = await opened()

    press(region, 'a', { ctrlKey: true })
    const shown = screen.getByRole('status', {
      name: 'Velocity of the selection',
    })
    const before = shown.textContent
    fireEvent.click(screen.getByRole('button', { name: 'Louder' }))

    expect(before).toBe('83')
    const notes = notesOf(commands[0])
    expect(notes.map((note) => Math.round(note.velocity * 127))).toEqual([
      110, 72,
    ])
  })

  it('says so when the Studio refuses it', async () => {
    renderEditor({ refuse: true })
    const region = await opened()

    press(region, 'a', { ctrlKey: true })
    press(region, 'Delete')

    await waitFor(() =>
      expect(
        region.querySelector('[data-studio-note-status]'),
      ).toHaveTextContent(
        'This edit could not be applied. The notes are unchanged.',
      ),
    )
  })
})

describe('Escape', () => {
  it('clears the selection first, and only then closes the editor', async () => {
    const region = await (renderEditor(), opened())

    press(region, 'a', { ctrlKey: true })
    press(region, 'Escape')
    const stillOpen = screen.queryByRole('region', { name: /^Note editor/ })
    press(region, 'Escape')

    expect(stillOpen).not.toBeNull()
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /^Note editor/ })).toBeNull(),
    )
  })
})

describe('the clipboard', () => {
  it('keeps notes copied in one opening for the next', async () => {
    // Arrange: copy both notes, close, and open again.
    const { state, fixture, commands } = renderEditor()
    const first = await opened()
    press(first, 'a', { ctrlKey: true })
    press(first, 'c', { ctrlKey: true })
    state.close()
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: /^Note editor/ })).toBeNull(),
    )
    state.open(fixture.clip.id)
    const second = await opened()

    // Act
    press(second, 'v', { ctrlKey: true })

    // Assert: the two notes again, as new notes.
    const pasted = notesOf(commands[0])
    expect(pasted.map((note) => note.id)).toEqual([1, 2, 3, 4])
  })
})

describe('a song that cannot be edited now', () => {
  it('edits nothing, and its tools say why', async () => {
    const { dispatch } = renderEditor({ writable: false })
    const region = await opened()

    press(region, 'a', { ctrlKey: true })
    press(region, 'Delete')

    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Quantize' })).toHaveAttribute(
      'title',
      'The song is busy for a moment',
    )
  })
})

describe('the render service', () => {
  it("hears a held arrow's draft, then its end once the commit is dispatched", async () => {
    // Arrange: both notes selected.
    const log: string[] = []
    const { renders, previews } = fakeRenders(log)
    const { commands } = renderEditor({ renders, log })
    const region = await opened()
    press(region, 'a', { ctrlKey: true })

    // Act: Up held, then let go.
    fireEvent.keyDown(region, { key: 'ArrowUp' })
    fireEvent.keyUp(region, { key: 'ArrowUp' })

    // Assert: middle C and the E above, a semitone up, drafted then kept.
    expect(log).toEqual(['draft', 'set-sequence-notes', 'draft ended'])
    expect(previews[0]?.notes.map((note) => note.pitch)).toEqual([61, 65])
    expect(notesOf(commands[0])).toEqual(previews[0]?.notes)
  })

  it('is told when the editor closes', async () => {
    const { renders, editorClosed } = fakeRenders()
    renderEditor({ renders })
    await opened()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(editorClosed).toHaveBeenCalledTimes(1))
  })

  it("has the header say while the clip's render runs, and when it failed", async () => {
    // Arrange
    const { renders, setRender } = fakeRenders([], 'rendering')
    renderEditor({ renders })
    const region = await opened()
    const shown = () => region.querySelector('[data-studio-note-render]')
    const running = shown()?.textContent

    // Act
    setRender('failed')

    // Assert: the failure said once in the status line, and marked.
    expect(running).toBe(' \u00b7 Rendering\u2026')
    expect(shown()).toHaveTextContent("Couldn't render")
    expect(region.querySelector('[data-studio-note-status]')).toHaveTextContent(
      NOTE_RENDER_FAILED,
    )
    setRender('idle')
    expect(shown()).toBeNull()
  })
})
