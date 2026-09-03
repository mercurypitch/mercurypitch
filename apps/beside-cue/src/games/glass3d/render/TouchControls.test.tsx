// The pad, as the DOM actually delivers it.
// ============================================================
//
// `input/pad-intent` has the arithmetic under test already. What is left
// here is the part that only breaks in a browser: which element is
// measured, which pointer is followed, and what happens when a press
// ends somewhere other than on a pointerup.

import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import type { IntentSource } from '../input/pad-intent'
import { createIntentSource, PAD_CONFIG } from '../input/pad-intent'
import { TouchControls } from './TouchControls'

/** jsdom has no PointerEvent and no pointer capture. The component is
 * written to survive both, which is what this stands in to prove. */
class FakePointerEvent extends MouseEvent {
  readonly pointerId: number
  constructor(type: string, init: MouseEventInit & { pointerId?: number }) {
    super(type, { bubbles: true, ...init })
    this.pointerId = init.pointerId ?? 1
  }
}

/** A pad 200px wide starting at x = 40, laid out where jsdom says
 * nothing is. Centre is 140. */
const PAD = { left: 40, width: 200, top: 700, height: 68 }

const mount = (): {
  pad: HTMLElement
  jump: HTMLElement
  src: IntentSource
} => {
  const src = createIntentSource()
  const { container } = render(() => <TouchControls source={src} />)
  const pad = container.querySelector('.stage3d__pad') as HTMLElement
  const jump = container.querySelector('.stage3d__jump') as HTMLElement
  pad.getBoundingClientRect = () =>
    ({
      left: PAD.left,
      width: PAD.width,
      top: PAD.top,
      height: PAD.height,
      right: PAD.left + PAD.width,
      bottom: PAD.top + PAD.height,
      x: PAD.left,
      y: PAD.top,
      toJSON: () => ({}),
    }) as DOMRect
  return { pad, jump, src }
}

const press = (
  el: HTMLElement,
  type: string,
  clientX: number,
  atMs?: number,
): void => {
  const event = new FakePointerEvent(type, { clientX, pointerId: 3 })
  if (atMs !== undefined) {
    Object.defineProperty(event, 'timeStamp', { value: atMs })
  }
  el.dispatchEvent(event)
}

describe('the walk pad', () => {
  it('renders a pad and a jump button', () => {
    const { pad, jump } = mount()
    expect(pad).toBeInTheDocument()
    expect(jump).toBeInTheDocument()
  })

  it('walks him the way the thumb is', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 235)
    expect(src.read(0).move).toBeGreaterThan(0.8)
    press(pad, 'pointerdown', 45)
    // Still the first pointer: a second finger on the pad is a mis-grab.
    expect(src.read(0).move).toBeGreaterThan(0.8)
  })

  it('walks him the other way from the other side', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 45)
    expect(src.read(0).move).toBeLessThan(-0.8)
  })

  it('follows a thumb that slides', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 150)
    press(pad, 'pointermove', 235)
    expect(src.read(0).move).toBeGreaterThan(0.8)
  })

  it('stops him when the thumb lifts', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 235, 1000)
    press(pad, 'pointerup', 235, 1400)
    expect(src.read(1400).move).toBe(0)
  })

  // The one-handed gesture: a quick press in the middle is a jump.
  it('jumps on a quick tap in the middle', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 141, 1000)
    press(pad, 'pointerup', 141, 1100)
    expect(src.read(1100).jump).toBe(true)
    expect(src.read(1100 + PAD_CONFIG.jumpPulseSeconds * 1000 + 1).jump).toBe(
      false,
    )
  })

  it('does not jump when the tap was out where walking starts', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 235, 1000)
    press(pad, 'pointerup', 235, 1050)
    expect(src.read(1050).jump).toBe(false)
  })

  it('does not jump when the press lingered', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 141, 1000)
    press(pad, 'pointerup', 141, 1000 + PAD_CONFIG.tapSeconds * 1000 + 50)
    expect(src.read(9999).jump).toBe(false)
  })

  // A pointer taken away by the system -- a call, a notification, a
  // gesture the OS decided was a swipe -- never sends a pointerup.
  it('stops him when the pointer is cancelled', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 235)
    pad.dispatchEvent(
      new FakePointerEvent('pointercancel', { clientX: 235, pointerId: 3 }),
    )
    expect(src.read(0).move).toBe(0)
  })

  it('ignores a pointerup from a finger it was not following', () => {
    const { pad, src } = mount()
    press(pad, 'pointerdown', 235)
    pad.dispatchEvent(
      new FakePointerEvent('pointerup', { clientX: 100, pointerId: 99 }),
    )
    expect(src.read(0).move).toBeGreaterThan(0.8)
  })
})

describe('the jump button', () => {
  it('holds while it is held, and lets go when it is let go', () => {
    const { jump, src } = mount()
    jump.dispatchEvent(new FakePointerEvent('pointerdown', {}))
    expect(src.read(0).jump).toBe(true)
    jump.dispatchEvent(new FakePointerEvent('pointerup', {}))
    expect(src.read(0).jump).toBe(false)
  })

  it('lets go when the thumb slides off it', () => {
    const { jump, src } = mount()
    jump.dispatchEvent(new FakePointerEvent('pointerdown', {}))
    jump.dispatchEvent(new FakePointerEvent('pointerleave', {}))
    expect(src.read(0).jump).toBe(false)
  })
})

describe('leaving the game mid-press', () => {
  it('lets go of everything when the app is backgrounded', () => {
    const { pad, jump, src } = mount()
    press(pad, 'pointerdown', 235)
    jump.dispatchEvent(new FakePointerEvent('pointerdown', {}))
    expect(src.read(0)).toEqual({ move: expect.any(Number), jump: true })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(src.read(0)).toEqual({ move: 0, jump: false })

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
  })
})
