// Moving-Tab tests protect its local reading scale and stable keyed note nodes.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { GuitarNote } from '@/lib/guitar/guitar-synth'
import { standardTuning } from '@/lib/guitar/instrument-tuning'
import { GUITAR_NIGHT_TAB_ZOOM_KEY, GuitarNightMovingTab, } from './GuitarNightMovingTab'

function note(id: string, startBeat: number, stringIndex = 0): GuitarNote {
  return {
    id,
    midi: 64 - stringIndex * 5,
    noteName: 'E4',
    stringIndex,
    fret: 3,
    startBeat,
    duration: 1,
    targetFreq: 329.63,
  }
}

function pointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  clientX: number,
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY: 100,
  })
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: 'touch' },
  })
  return event
}

describe('GuitarNightMovingTab', () => {
  beforeEach(() => localStorage.removeItem(GUITAR_NIGHT_TAB_ZOOM_KEY))
  afterEach(() => {
    cleanup()
    localStorage.removeItem(GUITAR_NIGHT_TAB_ZOOM_KEY)
  })

  function mount(hasGuide = true) {
    const score = hasGuide ? [note('first', 4), note('second', 6, 1)] : []
    const [playheadBeat, setPlayheadBeat] = createSignal<number | null>(4)
    const result = render(() => (
      <GuitarNightMovingTab
        notes={() => score}
        tuning={() => standardTuning('guitar', 6)}
        tempoBpm={() => 169}
        playheadBeat={playheadBeat}
        summary={() => 'Moving six-string tablature'}
        hasGuide={() => hasGuide}
        loopStart={() => null}
        loopEnd={() => null}
        loopActive={() => false}
      />
    ))
    return { ...result, setPlayheadBeat }
  }

  it('exposes an honest persisted zoom range without borrowing camera controls', () => {
    mount()
    const slider = screen.getByRole('slider', { name: /Tab zoom/ })

    expect(slider).toHaveAttribute('min', '75')
    expect(slider).toHaveAttribute('max', '180')
    expect(slider).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/^100% zoom, \d(?:\.\d)? beats visible$/),
    )

    fireEvent.input(slider, { target: { value: '145' } })

    expect((slider as HTMLInputElement).value).toBe('145')
    expect(localStorage.getItem(GUITAR_NIGHT_TAB_ZOOM_KEY)).toBe('1.45')
  })

  it('does not offer an inert reading-scale control in free play', () => {
    mount(false)

    expect(screen.queryByRole('slider', { name: /Tab zoom/ })).toBeNull()
    expect(screen.getByText(/No tab attached/)).toBeVisible()
  })

  it('zooms with the wheel only while the pointer is over the Tab lanes', () => {
    mount()
    const lanes = screen.getByTestId('guitar-night-moving-tab')
    const slider = screen.getByRole('slider', { name: /Tab zoom/ })
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    })

    lanes.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThan(100)
  })

  it('accumulates high-resolution trackpad wheel deltas', () => {
    mount()
    const lanes = screen.getByTestId('guitar-night-moving-tab')
    const slider = screen.getByRole('slider', { name: /Tab zoom/ })

    for (let sample = 0; sample < 12; sample += 1) {
      lanes.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -1,
        }),
      )
    }

    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThan(100)
  })

  it('leaves browser magnification gestures untouched', () => {
    mount()
    const lanes = screen.getByTestId('guitar-night-moving-tab')
    const slider = screen.getByRole('slider', { name: /Tab zoom/ })
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      deltaY: -100,
    })

    lanes.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect((slider as HTMLInputElement).value).toBe('100')
  })

  it('uses two touch pointers for pinch while leaving one finger inert', () => {
    mount()
    const lanes = screen.getByTestId('guitar-night-moving-tab')
    const slider = screen.getByRole('slider', { name: /Tab zoom/ })

    lanes.dispatchEvent(pointer('pointerdown', 1, 100))
    lanes.dispatchEvent(pointer('pointermove', 1, 130))
    expect((slider as HTMLInputElement).value).toBe('100')

    lanes.dispatchEvent(pointer('pointerdown', 2, 200))
    lanes.dispatchEvent(pointer('pointermove', 2, 260))

    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThan(100)
    lanes.dispatchEvent(pointer('pointerup', 1, 130))
    lanes.dispatchEvent(pointer('pointerup', 2, 260))
  })

  it('preserves note elements across sub-frame playhead updates', async () => {
    const { setPlayheadBeat } = mount()
    const lanes = screen.getByTestId('guitar-night-moving-tab')
    const first = lanes.querySelector<HTMLElement>('[data-note-id="first"]')
    const observer = new MutationObserver(() => undefined)
    observer.observe(lanes, { childList: true, subtree: true })

    setPlayheadBeat(4.05)
    await Promise.resolve()

    const childChanges = observer
      .takeRecords()
      .filter((record) => record.type === 'childList')
    expect(lanes.querySelector('[data-note-id="first"]')).toBe(first)
    expect(childChanges).toHaveLength(0)
    observer.disconnect()
  })
})
