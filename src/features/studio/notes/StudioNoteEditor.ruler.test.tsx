// Studio note editor ruler tests — a click on the roll's ruler moves the song's position to the frame under it, through the clip, when let go, playing or stopped; a click in the dimmed room past the clip's end is a song time like any other; a drag along the ruler scrubs a stopped song; and a press on the End handle's target is the handle's, not a seek.
import { cleanup, fireEvent, render, screen, waitFor, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioProject } from '@/lib/studio/model/types'
import { createStudioNoteEditorState } from './note-editor-state'
import { StudioNoteEditorHost } from './StudioNoteEditorHost'

// jsdom has no PointerEvent; without one the events lose button and clientX.
if (typeof window.PointerEvent === 'undefined')
  window.PointerEvent = class extends MouseEvent {
    readonly pointerId: number
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.pointerType = init.pointerType ?? 'mouse'
    }
  } as unknown as typeof PointerEvent

beforeAll(async () => {
  await import('./StudioNoteEditor')
})

beforeEach(() => {
  // jsdom draws nothing, lays nothing out and captures no pointer.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 900, 420),
  )
  const captured = new Set<number>()
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: (id: number) => captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => captured.delete(id),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** The fixture's keys clip open in the editor, its song at `frame` and playing or not. */
function renderEditor(options: { playing?: boolean } = {}) {
  const fixture = studioMidiFixture()
  const [project] = createSignal<StudioProject>(fixture.project)
  const [frame, setFrame] = createSignal(0)
  const seek = vi.fn((to: number) => {
    if (options.playing !== true) setFrame(to)
  })
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
          playing: () => options.playing === true,
          playheadFrame: frame,
          frameNow: frame,
        }}
        seek={seek}
        dispatch={() => true}
        writable
      />
    )
  })
  state.open(fixture.clip.id)
  return { seek }
}

/**
 * The roll laid out at 900 by 420: its grid 828 px across from x 72, under
 * a ruler 26 px tall; its view's ticks from the roll's attribute.
 */
async function rollView() {
  const roll = await waitFor(() => {
    const found = document.querySelector('[data-studio-note-roll]')
    expect(found).toHaveAttribute('data-studio-note-editing')
    return found!
  })
  const [start, end] = roll
    .getAttribute('data-studio-note-roll')!
    .split(':')
    .map(Number)
  const canvas = roll.querySelector('canvas[role="img"]')!
  return {
    canvas,
    /** Where tick `tick` stands across the page. */
    x: (tick: number) => 72 + ((tick - start) / (end - start)) * 828,
  }
}

/** The song frame the fixture's clip sounds tick `tick` on: 120 bpm, its tick 0 at frame 24000. */
const songFrame = (tick: number) => 24_000 + tick * 25

const at = (clientX: number, extra: PointerEventInit = {}) => ({
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
  clientX,
  clientY: 12,
  ...extra,
})

describe('the roll’s ruler', () => {
  it.each([[false], [true]])(
    'moves the song to the frame under a click, through the clip, once it is let go (playing: %s)',
    async (playing) => {
      // Arrange
      const { seek } = renderEditor({ playing })
      const roll = await rollView()

      // Act: the song's bar 2's first beat is the sequence's tick 1920.
      fireEvent.pointerDown(roll.canvas, at(roll.x(1920)))
      const pressed = seek.mock.calls.length
      fireEvent.pointerUp(roll.canvas, at(roll.x(1920)))

      // Assert
      expect(pressed).toBe(0)
      expect(seek).toHaveBeenCalledOnce()
      expect(seek.mock.calls[0][0]).toBeCloseTo(songFrame(1920), -2)
    },
  )

  it('moves the song to the time under a click in the dimmed room past the clip’s end', async () => {
    const { seek } = renderEditor()
    const roll = await rollView()

    // A bar past the clip’s end, which is on tick 3840.
    fireEvent.pointerDown(roll.canvas, at(roll.x(7680)))
    fireEvent.pointerUp(roll.canvas, at(roll.x(7680)))

    expect(seek.mock.calls[0][0]).toBeCloseTo(songFrame(7680), -2)
  })

  it('scrubs a stopped song along a drag, from the pointer', async () => {
    const { seek } = renderEditor()
    const roll = await rollView()

    fireEvent.pointerDown(roll.canvas, at(roll.x(1200)))
    fireEvent.pointerMove(roll.canvas, at(roll.x(1200) + 30))
    const followed = seek.mock.calls.length
    fireEvent.pointerMove(roll.canvas, at(roll.x(2400)))
    fireEvent.pointerUp(roll.canvas, at(roll.x(2400)))

    expect(followed).toBe(1)
    expect(seek.mock.calls.at(-1)![0]).toBeCloseTo(songFrame(2400), -2)
  })

  it('leaves a press on the End handle’s target to the handle, and seeks nothing', async () => {
    // Arrange: the clip ends on tick 3840.
    const { seek } = renderEditor()
    const roll = await rollView()
    const end = screen.getByRole('slider', { name: 'Clip end' })

    // Act: on the canvas within the handle's 44 px, and on the handle.
    fireEvent.pointerDown(roll.canvas, at(roll.x(3840) + 15))
    fireEvent.pointerUp(roll.canvas, at(roll.x(3840) + 15))
    fireEvent.pointerDown(end, at(roll.x(3840)))
    fireEvent.pointerUp(end, at(roll.x(3840)))

    // Assert
    expect(seek).not.toHaveBeenCalled()
  })
})
