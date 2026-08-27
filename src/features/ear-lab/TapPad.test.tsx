import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TapPad } from './EarStage'

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
