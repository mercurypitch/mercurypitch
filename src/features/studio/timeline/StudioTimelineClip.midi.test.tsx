// Studio MIDI clip tests — a MIDI clip says what it plays (its chip, its note count, E for its notes), and Rendering… while its notes have no audio; a double-click with a mouse opens its notes and an audio clip's still opens its details; two taps with a finger open the notes once, whatever dblclick the browser adds, and a tap after a drag does not count; the selected clip shows how to open its notes; and the clip the editor shows is marked.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studioMidiFixture } from '@/lib/studio/model/model.test-fixtures'
import type { StudioClip } from '@/lib/studio/model/types'
import type { StudioClipNotes } from './clip-notes'
import { StudioTimelineClip } from './StudioTimelineClip'
import type { StudioPointerEditor } from './useStudioPointer'
import { createStudioWaveformResource } from './waveform-resource'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function pointer(suppress = false) {
  return {
    draft: () => null,
    offsetY: () => 0,
    active: () => false,
    message: () => '',
    start: vi.fn(),
    cancel: vi.fn(),
    suppressClick: () => suppress,
  } as unknown as StudioPointerEditor
}

/** The fixture's MIDI clip under its own id, so one test's taps never meet another's. */
function renderClip(
  options: {
    id?: string
    midi?: boolean
    selected?: boolean
    tablet?: boolean
    editing?: boolean
    rendering?: boolean
    suppress?: boolean
  } = {},
) {
  const { assets, clip, sequence } = studioMidiFixture()
  const shown: StudioClip = { ...clip, id: options.id ?? clip.id }
  const notes: StudioClipNotes = { sequence, sound: 'piano' }
  const onDetails = vi.fn()
  const onOpenNotes = vi.fn()
  const onSelect = vi.fn()
  const resource = createStudioWaveformResource(() => new Promise(() => {}))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  render(() => (
    <StudioTimelineClip
      clip={shown}
      asset={assets[1]}
      trackName="Keys"
      selected={options.selected === true}
      writable
      phone={false}
      tablet={options.tablet === true}
      scale={100}
      scroll={0}
      contentWidth={1200}
      resource={resource}
      pointer={pointer(options.suppress)}
      notes={options.midi === false ? undefined : notes}
      editing={options.editing}
      rendering={options.rendering}
      onSelect={onSelect}
      onDetails={onDetails}
      onOpenNotes={onOpenNotes}
    />
  ))
  const button = screen.getByRole('button', { name: /^Keys, / })
  return { button, onDetails, onOpenNotes, onSelect, resource }
}

/** A press and its click, as a hand or a mouse makes them. */
function tap(
  button: HTMLElement,
  pointerType: 'touch' | 'mouse' | 'pen',
  at: { x: number; y: number } = { x: 100, y: 30 },
) {
  const down = new Event('pointerdown', { bubbles: true, cancelable: true })
  Object.assign(down, { pointerType, button: 0, isPrimary: true })
  button.dispatchEvent(down)
  fireEvent.click(button, { detail: 1, clientX: at.x, clientY: at.y })
}

describe('a MIDI clip says what it plays', () => {
  it('shows its chip and how many notes its window plays, and names E for its notes', () => {
    const { button } = renderClip()

    expect(button).toHaveTextContent('MIDI · PIANO')
    expect(button).toHaveTextContent('2 notes')
    expect(button).toHaveAccessibleName(/^Keys, .*, MIDI, 2 notes, /)
    expect(button).toHaveAttribute('aria-keyshortcuts', 'E')
  })

  it('marks the clip the note editor shows', () => {
    const { button } = renderClip({ editing: true })

    expect(button).toHaveAttribute('data-editing')
    expect(button).toHaveTextContent('Editing')
    // The tags share one line, so a short clip drops one whole rather than
    // cutting it (StudioMidiClip.module.css, .tags): Editing first.
    const tags = button.querySelector('[data-studio-clip-tags]')!
    expect([...tags.children].map((tag) => tag.textContent)).toEqual([
      'MIDI · PIANO',
      '2 notes',
      'Editing',
    ])
  })

  it('says Rendering… while its notes have no audio, after its count and before Editing, and says it to assistive tech', () => {
    const { button } = renderClip({ rendering: true, editing: true })

    const tags = button.querySelector('[data-studio-clip-tags]')!
    expect([...tags.children].map((tag) => tag.textContent)).toEqual([
      'MIDI · PIANO',
      '2 notes',
      'Rendering…',
      'Editing',
    ])
    expect(button).toHaveAccessibleName(/^Keys, .*, MIDI, 2 notes, rendering, /)
  })

  it('says nothing of rendering once its notes have their audio', () => {
    const { button } = renderClip({ rendering: false })

    expect(button).not.toHaveTextContent('Rendering')
    expect(button).not.toHaveAccessibleName(/rendering/)
  })
})

describe('opening the notes', () => {
  it('opens them on a double-click with a mouse, and not the details', () => {
    const { button, onOpenNotes, onDetails } = renderClip({ id: 'mouse' })

    tap(button, 'mouse')
    tap(button, 'mouse')
    fireEvent.dblClick(button)

    expect(onOpenNotes).toHaveBeenCalledTimes(1)
    expect(onDetails).not.toHaveBeenCalled()
  })

  it('still opens an audio clip’s details on a double-click', () => {
    const { button, onOpenNotes, onDetails } = renderClip({
      id: 'audio',
      midi: false,
    })

    fireEvent.dblClick(button)

    expect(onDetails).toHaveBeenCalledTimes(1)
    expect(onOpenNotes).not.toHaveBeenCalled()
  })

  it('opens them once on two taps with a finger, whatever dblclick the browser adds', () => {
    const { button, onOpenNotes, onDetails, onSelect } = renderClip({
      id: 'finger',
    })

    tap(button, 'touch')
    expect(onOpenNotes).not.toHaveBeenCalled()
    tap(button, 'touch', { x: 110, y: 36 })
    fireEvent.dblClick(button)

    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onOpenNotes).toHaveBeenCalledTimes(1)
    expect(onDetails).not.toHaveBeenCalled()
  })

  it('opens them on two taps with a pen', () => {
    const { button, onOpenNotes } = renderClip({ id: 'pen' })

    tap(button, 'pen')
    tap(button, 'pen')

    expect(onOpenNotes).toHaveBeenCalledTimes(1)
  })

  it('does not count taps far apart, nor a tap the browser sends after a drag', () => {
    const apart = renderClip({ id: 'apart' })
    tap(apart.button, 'touch', { x: 100, y: 30 })
    tap(apart.button, 'touch', { x: 160, y: 30 })
    expect(apart.onOpenNotes).not.toHaveBeenCalled()
    cleanup()

    const dragged = renderClip({ id: 'dragged', suppress: true })
    tap(dragged.button, 'touch')
    tap(dragged.button, 'touch')
    expect(dragged.onOpenNotes).not.toHaveBeenCalled()
    expect(dragged.onSelect).not.toHaveBeenCalled()
  })

  it('does not count Enter on the focused clip as a tap', () => {
    const { button, onOpenNotes } = renderClip({ id: 'keys' })

    // A keyboard's click comes at 0, 0: the tap before it lands there too.
    tap(button, 'touch', { x: 0, y: 0 })
    fireEvent.click(button, { detail: 0, clientX: 0, clientY: 0 })

    expect(onOpenNotes).not.toHaveBeenCalled()
  })
})

describe('the hint', () => {
  it('tells a mouse to double-click the selected clip, and a tablet to tap it twice', () => {
    renderClip({ selected: true })
    expect(screen.getByText(/to edit notes$/)).toHaveTextContent(
      'Double-click to edit notes',
    )
    cleanup()

    renderClip({ selected: true, tablet: true })
    expect(screen.getByText(/to edit notes$/)).toHaveTextContent(
      'Tap twice to edit notes',
    )
  })

  it('stays away while the clip is not selected, and while its notes are open', () => {
    renderClip()
    expect(screen.queryByText(/to edit notes$/)).toBeNull()
    cleanup()

    renderClip({ selected: true, editing: true })
    expect(screen.queryByText(/to edit notes$/)).toBeNull()
  })
})
