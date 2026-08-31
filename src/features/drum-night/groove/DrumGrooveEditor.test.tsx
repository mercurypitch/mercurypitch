// ============================================================
// Drum Groove Editor tests — exact rows, pointer commits, and keyboard editing
// ============================================================

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DrumGrooveDraftChange } from './drum-groove-draft-controller'
import { createDrumGrooveDraftController } from './drum-groove-draft-controller'
import { DrumGrooveEditor } from './DrumGrooveEditor'

afterEach(() => cleanup())

function renderEditor(options?: {
  readonly onChange?: (change: DrumGrooveDraftChange) => void
  readonly visibleStepCount?: 4 | 8 | 16
}) {
  const controller = createDrumGrooveDraftController({
    onChange: options?.onChange,
  })
  const mounted = render(() => (
    <DrumGrooveEditor
      controller={controller}
      visibleStepCount={options?.visibleStepCount ?? 4}
    />
  ))
  return { ...mounted, controller }
}

function cell(gmKey: number, stepIndex: number): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(
    `[data-gm-key="${gmKey}"][data-step-index="${stepIndex}"]`,
  )!
}

function rowRail(gmKey: number): HTMLElement {
  return document.querySelector<HTMLElement>(
    `[data-gm-row="${gmKey}"] [data-cell-rail]`,
  )!
}

function dispatchPointer(
  element: HTMLElement,
  type: 'pointercancel' | 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  clientX: number,
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    cancelable: true,
    clientX,
  })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'mouse' },
  })
  element.dispatchEvent(event)
}

describe('DrumGrooveEditor', () => {
  it('renders host-owned project controls without crossing persistence itself', () => {
    const drafts = createDrumGrooveDraftController()
    render(() => (
      <DrumGrooveEditor
        controller={drafts}
        projectControls={<button type="button">Save project</button>}
      />
    ))

    expect(screen.getByRole('button', { name: 'Save project' })).toBeVisible()
  })

  it('shows exact source and essential GM rows and adds into an empty one', () => {
    const { controller } = renderEditor()

    expect(screen.getByText('Closed Hi-Hat')).toBeInTheDocument()
    expect(screen.getByText('Open Hi-Hat')).toBeInTheDocument()
    expect(screen.getByText('Hi-Mid Tom')).toBeInTheDocument()
    expect(screen.getByText('Ride Cymbal 1')).toBeInTheDocument()
    const tomRow = document.querySelector<HTMLElement>('[data-gm-row="48"]')!
    expect(within(tomRow).getByText(/Toms · GM 48/i)).toBeInTheDocument()
    expect(within(tomRow).getAllByRole('gridcell')).toHaveLength(4)
    expect(within(tomRow).getAllByRole('button')).toHaveLength(4)
    expect(controller.state().hits.some((hit) => hit.gmKey === 48)).toBe(false)

    fireEvent.click(cell(48, 1))

    expect(controller.state().hits).toContainEqual(
      expect.objectContaining({ gmKey: 48, stepIndex: 1 }),
    )
    expect(controller.selectedHit()).toMatchObject({
      gmKey: 48,
      stepIndex: 1,
    })
    expect(screen.getByText(/bar 1, beat 1 e · velocity/i)).toBeInTheDocument()
  })

  it('commits one horizontal drag and consumes its post-pointer click', () => {
    const onChange = vi.fn()
    const { controller } = renderEditor({ onChange })
    const origin = cell(36, 0)
    const rail = rowRail(36)
    const setPointerCapture = vi.fn()
    const releasePointerCapture = vi.fn()
    Object.defineProperties(origin, {
      setPointerCapture: { configurable: true, value: setPointerCapture },
      releasePointerCapture: {
        configurable: true,
        value: releasePointerCapture,
      },
    })
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({
      bottom: 44,
      height: 44,
      left: 0,
      right: 176,
      top: 0,
      width: 176,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const kickId = controller
      .state()
      .hits.find((hit) => hit.gmKey === 36 && hit.stepIndex === 0)!.id

    dispatchPointer(origin, 'pointerdown', 7, 12)
    dispatchPointer(origin, 'pointermove', 7, 110)
    expect(controller.movePreview()).toMatchObject({
      hitId: kickId,
      stepIndex: 2,
    })
    expect(controller.state().revision).toBe(0)

    dispatchPointer(origin, 'pointerup', 7, 110)
    fireEvent.click(origin)

    expect(setPointerCapture).toHaveBeenCalledWith(7)
    expect(releasePointerCapture).toHaveBeenCalledWith(7)
    expect(controller.state().revision).toBe(1)
    expect(onChange).toHaveBeenCalledOnce()
    expect(controller.state().hits).toContainEqual(
      expect.objectContaining({ id: kickId, gmKey: 36, stepIndex: 2 }),
    )
    expect(
      controller
        .state()
        .hits.some((hit) => hit.gmKey === 36 && hit.stepIndex === 0),
    ).toBe(false)
  })

  it('cancels a pointer preview with Escape without changing the draft', () => {
    const onChange = vi.fn()
    const { controller } = renderEditor({ onChange })
    const origin = cell(36, 0)
    const rail = rowRail(36)
    Object.defineProperties(origin, {
      setPointerCapture: { configurable: true, value: vi.fn() },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    })
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue({
      bottom: 44,
      height: 44,
      left: 0,
      right: 176,
      top: 0,
      width: 176,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    dispatchPointer(origin, 'pointerdown', 3, 12)
    dispatchPointer(origin, 'pointermove', 3, 110)
    fireEvent.keyDown(origin, { key: 'Escape' })

    expect(controller.movePreview()).toBeNull()
    expect(controller.state().revision).toBe(0)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('supports roving arrows, Space, Enter, Delete, and command-Z', () => {
    const { controller } = renderEditor()
    const firstTomCell = cell(48, 1)
    firstTomCell.focus()

    fireEvent.keyDown(firstTomCell, { key: ' ' })
    expect(controller.state().hits).toContainEqual(
      expect.objectContaining({ gmKey: 48, stepIndex: 1 }),
    )

    fireEvent.keyDown(firstTomCell, { key: 'ArrowRight' })
    const secondTomCell = cell(48, 2)
    expect(document.activeElement).toBe(secondTomCell)
    fireEvent.keyDown(secondTomCell, { key: 'Enter' })
    expect(controller.state().hits).toContainEqual(
      expect.objectContaining({ gmKey: 48, stepIndex: 2 }),
    )

    fireEvent.keyDown(secondTomCell, { key: 'Delete' })
    expect(
      controller
        .state()
        .hits.some((hit) => hit.gmKey === 48 && hit.stepIndex === 2),
    ).toBe(false)
    fireEvent.keyDown(secondTomCell, { ctrlKey: true, key: 'z' })
    expect(controller.state().hits).toContainEqual(
      expect.objectContaining({ gmKey: 48, stepIndex: 2 }),
    )
  })

  it('offers labelled keyboard-operable controls to move a selected hit', async () => {
    const { controller } = renderEditor()
    fireEvent.click(cell(48, 1))
    const selectedId = controller.selectedHit()!.id
    const later = screen.getByRole('button', { name: 'Later' })
    const earlier = screen.getByRole('button', { name: 'Earlier' })

    expect(earlier).toBeEnabled()
    expect(later).toBeEnabled()
    later.focus()
    fireEvent.click(later)
    await Promise.resolve()

    expect(controller.selectedHit()).toMatchObject({
      id: selectedId,
      gmKey: 48,
      stepIndex: 2,
    })
    expect(document.activeElement).toBe(cell(48, 2))

    fireEvent.click(earlier)
    await Promise.resolve()
    expect(controller.selectedHit()).toMatchObject({
      id: selectedId,
      stepIndex: 1,
    })
  })

  it('pages a bounded number of steps and exposes reversible transforms', () => {
    const { controller } = renderEditor({ visibleStepCount: 4 })
    const editor = screen.getByTestId('drum-groove-editor')
    expect(editor).toHaveAttribute('data-visible-step-count', '4')
    expect(cell(36, 0)).toBeInTheDocument()
    expect(cell(36, 4)).not.toBeInTheDocument()

    fireEvent.click(
      within(editor).getByRole('button', { name: 'Next groove page' }),
    )
    expect(cell(36, 0)).not.toBeInTheDocument()
    expect(cell(36, 4)).toBeInTheDocument()

    fireEvent.click(within(editor).getByRole('button', { name: 'Soft' }))
    fireEvent.click(within(editor).getByRole('button', { name: 'Essential' }))
    expect(controller.state()).toMatchObject({ swing: 0.5, density: 0.55 })
    expect(screen.getByText(/nothing is deleted/i)).toBeInTheDocument()

    fireEvent.click(within(editor).getByRole('button', { name: /Undo/ }))
    expect(controller.state()).toMatchObject({ swing: 0.5, density: 1 })
    fireEvent.click(within(editor).getByRole('button', { name: 'Reset' }))
    expect(controller.state()).toMatchObject({ swing: 0, density: 1 })
  })

  it('constructs without activating audio or worker infrastructure', () => {
    const createAudioContext = vi.fn()
    const createWorker = vi.fn()
    vi.stubGlobal('AudioContext', createAudioContext)
    vi.stubGlobal('Worker', createWorker)

    renderEditor()

    expect(createAudioContext).not.toHaveBeenCalled()
    expect(createWorker).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
