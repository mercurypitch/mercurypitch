// Studio note editor tests — nothing shows until a clip's notes open; the editor then names the lane and the clip, says what the clip plays in words for its canvas and its status, and takes the focus; Escape inside it and Done close it and give the focus back to the clip; Expand fills the arrangement; the top edge's keys set a height kept on this device; a phone's editor fills the screen with no edge to drag; and the editor closes by itself when its clip is deleted.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { createStudioNoteEditorState, STUDIO_NOTE_EDITOR_HEIGHT_KEY, } from './note-editor-state'
import { StudioNoteEditorHost } from './StudioNoteEditorHost'

// The editor loads with import() on its first open; vitest transforms its
// module graph on that first import, a second or more under load. Load it
// once here, so each test waits on the editor and not on the transform.
beforeAll(async () => {
  await import('./StudioNoteEditor')
})

beforeEach(() => {
  // jsdom draws nothing: the roll's canvases have no context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.localStorage.removeItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY)
})

const transport = {
  playing: () => false,
  playheadFrame: () => 0,
  frameNow: () => 0,
}

/** The fixture's song in a signal, its MIDI clip's button, and the host. */
function renderHost(options: { phone?: boolean } = {}) {
  const base = studioMidiFixture()
  // A recorded take is kept under its name, which the editor shows.
  const fixture = {
    ...base,
    assets: base.assets.map((asset) =>
      asset.id === base.clip.assetId
        ? { ...asset, originalName: 'Take 3.wav' }
        : asset,
    ),
  }
  const [project, setProject] = createSignal<StudioProject>(fixture.project)
  let state!: ReturnType<typeof createStudioNoteEditorState>
  render(() => {
    state = createStudioNoteEditorState({ project })
    return (
      <div>
        <button type="button" data-studio-clip={fixture.clip.id}>
          Keys, Take
        </button>
        <StudioNoteEditorHost
          state={state}
          project={project()}
          assets={fixture.assets}
          phone={options.phone === true}
          tablet={false}
          transport={transport}
          dispatch={() => true}
          writable
        />
      </div>
    )
  })
  return { state, fixture, setProject }
}

const editor = () =>
  screen.findByRole('region', { name: /^Note editor: Keys, / })

describe('opening', () => {
  it('shows nothing until a clip’s notes open, then names the lane and the clip and takes the focus', async () => {
    // Arrange
    const { state, fixture } = renderHost()
    expect(screen.queryByRole('region')).toBeNull()

    // Act
    state.open(fixture.clip.id)

    // Assert
    const region = await editor()
    expect(region).toHaveAccessibleName('Note editor: Keys, Take 3')
    expect(region).toHaveTextContent('MIDI · PIANO')
    await waitFor(() => expect(region).toHaveFocus())
  })

  it('says what the clip plays, for the canvas and in its status', async () => {
    const { state, fixture } = renderHost()

    state.open(fixture.clip.id)
    await editor()

    // The clip's window plays two notes, middle C and the E above, from the
    // song's first bar into its second.
    expect(screen.getByRole('img', { name: /^2 notes/ })).toHaveAttribute(
      'aria-label',
      '2 notes from C4 to E4, bars 1 to 2',
    )
    expect(
      document.querySelector('[data-studio-note-status]'),
    ).toHaveTextContent('2 notes \u00b7 Bars 1\u20132')
  })
})

describe('closing', () => {
  it('closes on Escape inside it, and gives the focus back to the clip', async () => {
    // Arrange
    const { state, fixture } = renderHost()
    state.open(fixture.clip.id)
    const region = await editor()
    await waitFor(() => expect(region).toHaveFocus())

    // Act
    fireEvent.keyDown(region, { key: 'Escape' })

    // Assert
    expect(state.clipId()).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
    await waitFor(() =>
      expect(
        document.querySelector(`[data-studio-clip="${fixture.clip.id}"]`),
      ).toHaveFocus(),
    )
  })

  it('closes on Done', async () => {
    const { state, fixture } = renderHost()
    state.open(fixture.clip.id)
    await editor()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    expect(state.clipId()).toBeNull()
  })

  it('closes by itself when its clip is deleted', async () => {
    const { state, fixture, setProject } = renderHost()
    state.open(fixture.clip.id)
    await editor()

    setProject({
      ...fixture.project,
      clips: fixture.project.clips.filter(
        (each) => each.id !== fixture.clip.id,
      ),
    })

    expect(screen.queryByRole('region')).toBeNull()
  })
})

describe('the drawer', () => {
  it('fills the arrangement on Expand, and gives the lanes back on a second press', async () => {
    const { state, fixture } = renderHost()
    state.open(fixture.clip.id)
    await editor()
    const expand = screen.getByRole('button', { name: 'Fill the arrangement' })

    fireEvent.click(expand)
    expect(expand).toHaveAttribute('aria-pressed', 'true')
    expect(state.expanded()).toBe(true)
    fireEvent.click(expand)

    expect(state.expanded()).toBe(false)
  })

  it('takes a height from its top edge’s keys, kept on this device, and the automatic one on a double-click', async () => {
    // Arrange: jsdom lays nothing out, so the arrangement says it is 800 px.
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800)
    const { state, fixture } = renderHost()
    state.open(fixture.clip.id)
    await editor()
    const edge = screen.getByRole('separator', { name: 'Note editor height' })

    // Act
    fireEvent.keyDown(edge, { key: 'Home' })
    const least = state.height()
    fireEvent.keyDown(edge, { key: 'ArrowUp' })

    // Assert
    expect(least).toBe(220)
    expect(state.height()).toBe(236)
    expect(window.localStorage.getItem(STUDIO_NOTE_EDITOR_HEIGHT_KEY)).toBe(
      '236',
    )
    fireEvent.dblClick(edge)
    expect(state.height()).toBeNull()
  })

  it('fills a phone’s screen with no edge to drag and no Expand', async () => {
    const { state, fixture } = renderHost({ phone: true })

    state.open(fixture.clip.id)
    await editor()

    expect(screen.queryByRole('separator')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Fill the arrangement' }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })
})
