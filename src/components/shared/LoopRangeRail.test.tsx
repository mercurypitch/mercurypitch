// LoopRangeRail interaction tests keep seek and A/B editing independent.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LoopRangeRail } from './LoopRangeRail'

function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    top: 0,
    right: left + width,
    bottom: 44,
    left,
    width,
    height: 44,
    toJSON: () => ({}),
  } as DOMRect
}

function sendPointer(
  element: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
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
    pointerId: { value: 7 },
    pointerType: { value: 'mouse' },
  })
  element.dispatchEvent(event)
}

function installPointerCapture(element: HTMLElement): void {
  const captured = new Set<number>()
  element.setPointerCapture = (id: number) => void captured.add(id)
  element.hasPointerCapture = (id: number) => captured.has(id)
  element.releasePointerCapture = (id: number) => void captured.delete(id)
}

describe('LoopRangeRail', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => rect(100, 400),
    )
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  function mount(
    options: {
      a?: number | null
      b?: number | null
      onMoveA?: (value: number) => void
      onMoveB?: (value: number) => void
      onCommit?: (mark: 'A' | 'B') => void
      onScrubStart?: () => void
      onScrubEnd?: () => void
    } = {},
  ) {
    const [a, setA] = createSignal<number | null>(options.a ?? 0)
    const [b, setB] = createSignal<number | null>(options.b ?? 4)
    render(() => (
      <LoopRangeRail
        axisDomain={() => ({ start: 0, end: 120 })}
        axisValue={() => 90}
        markDomain={() => ({ start: 0, end: 16 })}
        markA={a}
        markB={b}
        toAxis={(beat) => beat * 3}
        fromAxis={(seconds) => seconds / 3}
        axisStep={() => 0.25}
        markStep={() => 0.6}
        minimumMarkGap={() => 1}
        formatAxisValue={(seconds) => `${seconds} seconds`}
        formatMarkValue={(beat) => `beat ${beat + 1}`}
        seekLabel="Score position"
        onSeek={vi.fn()}
        snapMarkValue={(beat) => Math.round(beat)}
        onMoveMarkA={
          options.onMoveA ??
          ((value) => {
            setA(value)
          })
        }
        onMoveMarkB={
          options.onMoveB ??
          ((value) => {
            setB(value)
          })
        }
        onCommitMark={options.onCommit}
        onScrubStart={options.onScrubStart}
        onScrubEnd={options.onScrubEnd}
        testIdPrefix="test"
      />
    ))
    return { a, b, setA, setB }
  }

  it('renders A at zero and maps authored beats onto the elapsed-time axis', () => {
    mount()
    expect(screen.getByLabelText('Loop start marker')).toHaveStyle('left: 0%')
    expect(screen.getByLabelText('Loop end marker')).toHaveStyle('left: 10%')
    expect(screen.getByLabelText('Score position')).toHaveAttribute(
      'aria-valuetext',
      '90 seconds',
    )
  })

  it('keeps endpoint marker hit targets inside the rail', () => {
    render(() => (
      <LoopRangeRail
        axisDomain={() => ({ start: 0, end: 16 })}
        axisValue={() => 0}
        markDomain={() => ({ start: 0, end: 16 })}
        markA={() => 0}
        markB={() => 16}
        toAxis={(value) => value}
        fromAxis={(value) => value}
        formatAxisValue={String}
        formatMarkValue={String}
        onSeek={vi.fn()}
        onMoveMarkA={vi.fn()}
        onMoveMarkB={vi.fn()}
        testIdPrefix="endpoints"
      />
    ))

    expect(screen.getByLabelText('Loop start marker')).toHaveStyle({
      '--loop-marker-anchor': '0%',
      '--loop-marker-shift': '0%',
      left: '0%',
    })
    expect(screen.getByLabelText('Loop end marker')).toHaveStyle({
      '--loop-marker-anchor': '100%',
      '--loop-marker-shift': '-100%',
      left: '100%',
    })
  })

  it('opens an explicit boundary-only lens without changing the seek domain', () => {
    mount()
    const seek = screen.getByLabelText('Score position')
    expect(seek).toHaveAttribute('min', '0')
    expect(seek).toHaveAttribute('max', '120')
    expect((seek as HTMLInputElement).value).toBe('90')

    fireEvent.click(screen.getByRole('button', { name: 'Focus the A B loop' }))
    expect(screen.getByTestId('test-loop-precision-lens')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Score position')).toHaveLength(1)
    expect(seek).toHaveAttribute('min', '0')
    expect(seek).toHaveAttribute('max', '120')
    expect((seek as HTMLInputElement).value).toBe('90')
  })

  it('keeps pointer previews local, rolls cancellation back, and commits once', () => {
    const onMoveA = vi.fn()
    const onCommit = vi.fn()
    mount({ a: 2, b: 8, onMoveA, onCommit })
    const marker = screen.getByLabelText('Loop start marker')
    installPointerCapture(marker)

    sendPointer(marker, 'pointerdown', 150)
    sendPointer(marker, 'pointermove', 300)
    sendPointer(marker, 'pointercancel', 300)
    expect(onMoveA).not.toHaveBeenCalled()
    expect(onCommit).not.toHaveBeenCalled()

    sendPointer(marker, 'pointerdown', 150)
    sendPointer(marker, 'pointermove', 160)
    sendPointer(marker, 'pointerup', 160)
    expect(onMoveA).toHaveBeenCalledTimes(1)
    expect(onMoveA).toHaveBeenLastCalledWith(3)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenLastCalledWith('A')
  })

  it('measures a marker rail once per pointer gesture', () => {
    mount({ a: 2, b: 8 })
    const marker = screen.getByLabelText('Loop start marker')
    installPointerCapture(marker)
    const rectSpy = vi.mocked(HTMLElement.prototype.getBoundingClientRect)
    rectSpy.mockClear()

    sendPointer(marker, 'pointerdown', 150)
    sendPointer(marker, 'pointermove', 160)
    sendPointer(marker, 'pointermove', 170)
    sendPointer(marker, 'pointermove', 180)
    sendPointer(marker, 'pointerup', 180)

    expect(rectSpy).toHaveBeenCalledTimes(1)
  })

  it('preserves the grab offset for an endpoint marker', () => {
    const onMoveA = vi.fn()
    mount({ a: 0, b: 4, onMoveA, onCommit: vi.fn() })
    const marker = screen.getByLabelText('Loop start marker')
    installPointerCapture(marker)

    // The start marker's 44px hitbox extends inward from x=100. Grabbing its
    // centre must not jump the authored boundary toward that pointer position.
    sendPointer(marker, 'pointerdown', 122)
    sendPointer(marker, 'pointermove', 123)
    sendPointer(marker, 'pointerup', 123)

    expect(onMoveA).toHaveBeenCalledOnce()
    expect(onMoveA).toHaveBeenCalledWith(0)
  })

  it('coalesces keyboard repeats and keeps native seek scrubbing open through keyup', () => {
    const onCommit = vi.fn()
    const onScrubStart = vi.fn()
    const onScrubEnd = vi.fn()
    mount({ a: 2, b: 8, onCommit, onScrubStart, onScrubEnd })

    const marker = screen.getByLabelText('Loop start marker')
    fireEvent.keyDown(marker, { key: 'ArrowRight', repeat: false })
    fireEvent.keyDown(marker, { key: 'ArrowRight', repeat: true })
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.keyUp(marker, { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith('A')

    const seek = screen.getByLabelText('Score position')
    fireEvent.keyDown(seek, { key: 'ArrowRight', repeat: false })
    fireEvent.input(seek, { target: { value: '91' } })
    fireEvent.change(seek, { target: { value: '91' } })
    fireEvent.keyDown(seek, { key: 'ArrowRight', repeat: true })
    expect(onScrubStart).toHaveBeenCalledTimes(1)
    expect(onScrubEnd).not.toHaveBeenCalled()
    fireEvent.keyUp(seek, { key: 'ArrowRight' })
    expect(onScrubEnd).toHaveBeenCalledOnce()
  })

  it('re-clamps after snapping and disables a boundary without a move owner', () => {
    const onMoveB = vi.fn()
    mount({ a: 2, b: 3, onMoveA: undefined, onMoveB, onCommit: vi.fn() })

    const end = screen.getByLabelText('Loop end marker')
    fireEvent.keyDown(end, { key: 'ArrowLeft' })
    expect(onMoveB).toHaveBeenCalledWith(3)

    cleanup()
    render(() => (
      <LoopRangeRail
        axisDomain={() => ({ start: 0, end: 10 })}
        axisValue={() => 0}
        markDomain={() => ({ start: 0, end: 10 })}
        markA={() => 0}
        markB={() => 4}
        toAxis={(value) => value}
        fromAxis={(value) => value}
        formatAxisValue={String}
        formatMarkValue={String}
        onSeek={vi.fn()}
        onMoveMarkB={vi.fn()}
        testIdPrefix="disabled"
      />
    ))
    expect(screen.getByLabelText('Loop start marker')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(screen.getByLabelText('Loop start marker')).toHaveAttribute(
      'tabindex',
      '-1',
    )
  })

  it('can lock A/B evidence while leaving the seek rail available', () => {
    render(() => (
      <LoopRangeRail
        axisDomain={() => ({ start: 0, end: 10 })}
        axisValue={() => 2}
        markDomain={() => ({ start: 0, end: 10 })}
        markA={() => 1}
        markB={() => 4}
        toAxis={(value) => value}
        fromAxis={(value) => value}
        marksDisabled={() => true}
        formatAxisValue={String}
        formatMarkValue={String}
        onSeek={vi.fn()}
        onMoveMarkA={vi.fn()}
        onMoveMarkB={vi.fn()}
        testIdPrefix="evidence"
      />
    ))

    expect(screen.getByLabelText('Timeline position')).toBeEnabled()
    expect(screen.getByLabelText('Loop start marker')).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})
