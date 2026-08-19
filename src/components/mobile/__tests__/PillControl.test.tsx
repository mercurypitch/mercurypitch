// ============================================================
// PillControl — the capsule two surfaces now share
// ============================================================
//
// It started as the guide-vocal pill inside KaraokeMobileStage and was pulled
// out when the music level needed the same gesture: "just reuse the component
// we already have for our mic vocal stem volume control". Shared means its
// own tests, because a change made for one consumer now lands on both.
//
// The consumer-level behaviour is proved where it belongs —
// `KaraokeMobileStage.musicLevel.test.tsx` for the level, `GuideVocalMic` for
// the vocals. What is here is the parts of the capsule neither consumer's
// tests reach: the collapse timer, the keyboard-activation path, and what the
// optional halves do when they are left out.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PillControl } from '@/components/mobile/PillControl'
import { dragPill, tapPill } from '@/tests/helpers/pill-drag'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

interface Handlers {
  onTap: ReturnType<typeof vi.fn>
  onLevel: ReturnType<typeof vi.fn>
}

/** A toggle pill — no keyStep, no readout. The vocals pill's shape. */
function mountToggle(over: Record<string, unknown> = {}): Handlers {
  const onTap = vi.fn()
  const onLevel = vi.fn()
  render(() => (
    <PillControl
      level={0.5}
      off={false}
      onTap={onTap}
      onLevel={onLevel}
      ariaLabel="Guide vocal"
      testId="pill"
      {...over}
    >
      <span>icon</span>
    </PillControl>
  ))
  return { onLevel, onTap }
}

const pill = (): HTMLElement => screen.getByTestId('pill')

describe('the capsule', () => {
  it('puts itself away a beat after the finger lifts', () => {
    // Nothing closes this control, which is why it must close itself. Left
    // open it would sit over the lyrics for the rest of the song.
    vi.useFakeTimers()
    mountToggle()
    expect(pill().className).not.toMatch(/expanded/)

    tapPill(pill())
    expect(pill().className).toMatch(/expanded/)

    vi.advanceTimersByTime(1399)
    expect(pill().className).toMatch(/expanded/)
    vi.advanceTimersByTime(1)
    expect(pill().className).not.toMatch(/expanded/)
  })

  it('starts the wait again on a second touch', () => {
    // Adjusting twice in a row must not have the track vanish under the
    // second gesture because the first one's timer was still running.
    vi.useFakeTimers()
    mountToggle()
    tapPill(pill())
    vi.advanceTimersByTime(1300)
    tapPill(pill())
    vi.advanceTimersByTime(1300)
    expect(pill().className).toMatch(/expanded/)
  })

  it('drops its timer when it leaves the page', () => {
    // A song ends, the stage unmounts, and a stray timer would set state on a
    // disposed component.
    vi.useFakeTimers()
    mountToggle()
    tapPill(pill())
    cleanup()
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
  })
})

describe('activation', () => {
  it('answers a keyboard or screen-reader click', () => {
    // `detail === 0` is how a synthesised activation is told from a real
    // pointer's click. Without this branch the pill is unusable without a
    // pointer; with it applied to every click, a touch tap fires twice.
    const { onTap } = mountToggle()
    fireEvent.click(pill(), { detail: 0 })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('ignores the click a real tap trails behind it', () => {
    const { onTap } = mountToggle()
    tapPill(pill())
    expect(onTap).toHaveBeenCalledTimes(1)
    fireEvent.click(pill(), { detail: 1 })
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('is not a tap when the system takes the gesture away', () => {
    // An edge swipe, an incoming call, a rejected palm: the press ends, but
    // the singer never meant to press anything.
    const { onTap } = mountToggle()
    dragPill(pill(), 100, 100, { end: 'pointercancel' })
    expect(onTap).not.toHaveBeenCalled()
  })
})

describe('as a plain toggle', () => {
  it('says pressed rather than pretending to hold a value', () => {
    mountToggle({ off: true })
    expect(pill().getAttribute('aria-pressed')).toBe('true')
    expect(pill().getAttribute('role')).toBeNull()
    expect(pill().getAttribute('aria-valuenow')).toBeNull()
  })

  it('leaves the arrow keys to the page', () => {
    // Without a keyStep there is no value to move, and swallowing the arrows
    // would break scrolling for anyone on a keyboard.
    const { onLevel } = mountToggle()
    fireEvent.keyDown(pill(), { key: 'ArrowUp' })
    fireEvent.keyDown(pill(), { key: 'End' })
    expect(onLevel).not.toHaveBeenCalled()
  })

  it('shows no readout, whatever the level is', () => {
    mountToggle({ level: 0.42 })
    tapPill(pill())
    expect(pill().textContent).toBe('icon')
  })

  it('takes a shorter throw by default', () => {
    // 70px, tuned for a mute pill you flick rather than aim. A consumer with
    // a wide range passes its own.
    const { onLevel } = mountToggle({ level: 0 })
    dragPill(pill(), 200, 165)
    expect(onLevel).toHaveBeenLastCalledWith(0.5)
  })

  it('never reports a level off either end of the track', () => {
    // The finger keeps going after the track runs out — that is what a flick
    // is. A level outside 0..1 would fill the capsule past its own height and
    // hand the consumer a number it has to defend against.
    const { onLevel } = mountToggle({ level: 0.5 })
    dragPill(pill(), 200, -600)
    dragPill(pill(), 200, 900)
    for (const call of onLevel.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(0)
      expect(call[0]).toBeLessThanOrEqual(1)
    }
    expect(onLevel.mock.calls.length).toBeGreaterThan(0)
  })

  it('renders without a class of its own', () => {
    // Placement is the consumer's, but the component must not require one.
    mountToggle()
    expect(pill().className).toMatch(/pill/)
    expect(pill().className).not.toMatch(/undefined/)
  })
})

describe('as a slider', () => {
  function mountSlider(over: Record<string, unknown> = {}): Handlers {
    return mountToggle({
      keyStep: 0.1,
      valueLabel: '50%',
      valueText: '50 percent',
      ...over,
    })
  }

  it('moves two steps on a page key', () => {
    const { onLevel } = mountSlider()
    fireEvent.keyDown(pill(), { key: 'PageUp' })
    expect(onLevel).toHaveBeenLastCalledWith(0.7)
    fireEvent.keyDown(pill(), { key: 'PageDown' })
    expect(onLevel).toHaveBeenLastCalledWith(0.3)
  })

  it('takes the horizontal arrows too', () => {
    // A slider is a slider whichever way it is drawn; left and right are what
    // plenty of assistive tech sends.
    const { onLevel } = mountSlider()
    fireEvent.keyDown(pill(), { key: 'ArrowRight' })
    expect(onLevel).toHaveBeenLastCalledWith(0.6)
    fireEvent.keyDown(pill(), { key: 'ArrowLeft' })
    expect(onLevel).toHaveBeenLastCalledWith(0.4)
  })

  it('cannot be walked past either end', () => {
    const { onLevel } = mountSlider({ level: 0.95 })
    fireEvent.keyDown(pill(), { key: 'PageUp' })
    expect(onLevel).toHaveBeenLastCalledWith(1)

    cleanup()
    const low = mountSlider({ level: 0.05 })
    fireEvent.keyDown(pill(), { key: 'PageDown' })
    expect(low.onLevel).toHaveBeenLastCalledWith(0)
  })

  it('keeps its own keys and passes the rest on', () => {
    const { onLevel } = mountSlider()
    const tab = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Tab',
    })
    pill().dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    expect(onLevel).not.toHaveBeenCalled()

    const up = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowUp',
    })
    pill().dispatchEvent(up)
    expect(up.defaultPrevented).toBe(true)
  })

  it('hides the readout from assistive tech, which has the value already', () => {
    // Two announcements of the same number, one of them a bare "50%" with no
    // idea what it belongs to.
    mountSlider()
    tapPill(pill())
    const readout = pill().querySelector('[class*="value"]')
    expect(readout?.textContent).toBe('50%')
    expect(readout?.getAttribute('aria-hidden')).toBe('true')
  })
})
