// ============================================================
// Frame loop wake tests — a resting loop looks again on any input
// ============================================================
//
// A settled loop asks for no frame until something wakes it. Any input on
// the page, a new window size and a change of the motion switch do, once
// each, so a figure that code changed without waking the loop still draws
// in the next frame; with none of them, the loop goes on asking nothing.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'

/** What a reader does on a page: each is heard on the document, wherever it lands. */
const INPUTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'keydown',
  'click',
  'wheel',
  'input',
  'change',
  'focusin',
  'focusout',
] as const

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe('a settled frame loop', () => {
  it('asks for one frame after each input, a new window size and a change of the motion switch', async () => {
    // Arrange: one drawer, at rest
    const { asked, loop, reduceMotion, settle } = await handLoop()
    let draws = 0
    loop.addDrawer({
      active: () => true,
      wants: () => false,
      draw: () => {
        draws += 1
      },
    })
    settle()
    const field = document.createElement('input')
    document.body.appendChild(field)
    const events: [string, () => void][] = [
      // dispatched at a control, not bubbling: the loop hears them as they pass the document
      ...INPUTS.map((type): [string, () => void] => [
        type,
        () => field.dispatchEvent(new Event(type)),
      ]),
      ['resize', () => window.dispatchEvent(new Event('resize'))],
      ['the motion switch', () => reduceMotion(false)],
    ]

    // Act
    const woken = events.map(([what, fire]): [string, number] => {
      fire()
      const frames = asked.length
      settle()
      return [what, frames]
    })

    // Assert: a frame each, and none drawn, since nothing wanted one
    expect(woken).toEqual(events.map(([what]) => [what, 1]))
    expect(draws).toBe(0)
    expect(asked).toHaveLength(0)
  })

  it('asks for no frame with no input, and draws what code changed unseen in the frame an input asks for', async () => {
    // Arrange: a drawer that draws when what it shows differs from what it drew
    const { asked, loop, settle } = await handLoop()
    let state = 0
    let shown = 0
    loop.addDrawer({
      active: () => true,
      wants: () => shown !== state,
      draw: () => {
        shown = state
      },
    })
    settle()

    // Act: the state changes with no wake, time passes, then a tap
    state = 1
    vi.advanceTimersByTime(5000)
    const unasked = asked.length
    document.body.dispatchEvent(new Event('pointerdown'))
    const frames = settle()

    // Assert
    expect(unasked).toBe(0)
    expect(frames).toBe(1)
    expect(shown).toBe(1)
    expect(asked).toHaveLength(0)
  })
})
