import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TapPad } from './EarStage'

/** `event`, stamped `ms` on the page's clock, as the browser stamps it. */
function stamped<E extends Event>(event: E, ms: number): E {
  Object.defineProperty(event, 'timeStamp', { value: ms })
  return event
}

const key = (type: 'keydown' | 'keyup', name: string, ms: number) =>
  stamped(new KeyboardEvent(type, { key: name, bubbles: true }), ms)
const click = (ms: number) =>
  stamped(new MouseEvent('click', { bubbles: true }), ms)
const pointer = (type: 'pointerdown' | 'pointerup', ms: number) =>
  stamped(new MouseEvent(type, { button: 0, bubbles: true }), ms)

describe('TapPad', () => {
  afterEach(() => cleanup())

  it('takes a tap on pointer down and on Space, stamped by the event', () => {
    const onTap = vi.fn()
    render(() => <TapPad label="Tap" onTap={onTap} />)
    const pad = screen.getByTestId('ear-tap-pad')
    fireEvent.pointerDown(pad, { button: 0 })
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(typeof onTap.mock.calls[0]?.[0]).toBe('number')
    fireEvent.keyDown(pad, { key: ' ' })
    expect(onTap).toHaveBeenCalledTimes(2)
    // A held key repeats the event; a tap is one press.
    fireEvent.keyDown(pad, { key: ' ', repeat: true })
    fireEvent.keyDown(pad, { key: 'a' })
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('takes a click no pointer or key made, as a screen reader sends it, and not the echo of a tap', () => {
    const onTap = vi.fn()
    render(() => <TapPad label="Tap" onTap={onTap} />)
    const pad = screen.getByTestId('ear-tap-pad')
    fireEvent.click(pad)
    expect(onTap).toHaveBeenCalledTimes(1)
    fireEvent.pointerDown(pad, { button: 0 })
    fireEvent.pointerUp(pad, { button: 0 })
    fireEvent.click(pad)
    expect(onTap).toHaveBeenCalledTimes(2)
  })

  it('takes a click 50 ms after a Control keydown as a tap, and not one 50 ms after a Space keyup', () => {
    const onTap = vi.fn()
    render(() => <TapPad label="Tap" onTap={onTap} />)
    const pad = screen.getByTestId('ear-tap-pad')
    // VoiceOver's Control, then its click
    pad.dispatchEvent(key('keydown', 'Control', 1000))
    pad.dispatchEvent(click(1050))
    // Space taps on its keydown, and its keyup's click is the echo
    pad.dispatchEvent(key('keydown', ' ', 2000))
    pad.dispatchEvent(key('keyup', ' ', 2000))
    pad.dispatchEvent(click(2050))
    expect(onTap.mock.calls).toEqual([[1050], [2000]])
  })

  it("takes a click 300 ms after a pointer up as the pointer's echo, and one 300 ms after a Space keyup, 1,100 ms after a pointer up or after nothing as a tap", () => {
    const onTap = vi.fn()
    render(() => <TapPad label="Tap" onTap={onTap} />)
    const pad = screen.getByTestId('ear-tap-pad')
    // a finger, and its click stamped late on a busy main thread
    pad.dispatchEvent(pointer('pointerdown', 1000))
    pad.dispatchEvent(pointer('pointerup', 1000))
    pad.dispatchEvent(click(1300))
    // Space, then a click 300 ms after its keyup
    pad.dispatchEvent(key('keydown', ' ', 5000))
    pad.dispatchEvent(key('keyup', ' ', 5000))
    pad.dispatchEvent(click(5300))
    // a finger, then a click 1,100 ms after it
    pad.dispatchEvent(pointer('pointerdown', 10000))
    pad.dispatchEvent(pointer('pointerup', 10000))
    pad.dispatchEvent(click(11100))
    // a click alone
    pad.dispatchEvent(click(20000))
    expect(onTap.mock.calls).toEqual([
      [1000],
      [5000],
      [5300],
      [10000],
      [11100],
      [20000],
    ])
  })

  it('ignores secondary mouse buttons', () => {
    const onTap = vi.fn()
    render(() => <TapPad label="Tap" onTap={onTap} />)
    // jsdom has no PointerEvent; a MouseEvent carries the button number.
    screen
      .getByTestId('ear-tap-pad')
      .dispatchEvent(
        new MouseEvent('pointerdown', { button: 2, bubbles: true }),
      )
    expect(onTap).not.toHaveBeenCalled()
  })
})
