// ============================================================
// Lesson 7 hold to repeat tests — Lower and Higher, held on a fake clock
// ============================================================
//
// WEB-SPEC, Tests 5: a held Lower or Higher repeats every 150 ms after
// 400 ms and stops at the column's ends; a keyboard press moves one
// semitone; the click a pointer press ends with moves nothing more.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindHoldRepeat, HOLD_DELAY_MS, HOLD_EVERY_MS } from './hold-repeat'

afterEach(() => {
  vi.useRealTimers()
  document.body.textContent = ''
})

/** A button bound to a note that climbs from 0 to `top`, and the note as it stands. */
function climber(top: number): {
  button: HTMLButtonElement
  note: () => number
} {
  const button = document.createElement('button')
  document.body.append(button)
  let note = 0
  bindHoldRepeat(button, () => {
    if (note >= top) return false
    note += 1
    return note < top
  })
  return { button, note: () => note }
}

/** A pointer event; jsdom has no PointerEvent, and the binding reads only `button`. */
const press = (
  b: HTMLElement,
  type: string,
  init: MouseEventInit = {},
): void => {
  b.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, ...init }))
}

describe('a held Lower or Higher', () => {
  it('moves at once, then every 150 ms after 400 ms', () => {
    // Arrange
    vi.useFakeTimers()
    const { button, note } = climber(24)

    // Act
    press(button, 'pointerdown')
    const first = note()
    vi.advanceTimersByTime(HOLD_DELAY_MS - 1)
    const beforeRepeat = note()
    vi.advanceTimersByTime(1)
    const atRepeat = note()
    vi.advanceTimersByTime(HOLD_EVERY_MS * 4)

    // Assert
    expect(first).toBe(1)
    expect(beforeRepeat).toBe(1)
    expect(atRepeat).toBe(2)
    expect(note()).toBe(6)
  })

  it('climbs the column from its bottom to its top in under 4 s, then stops', () => {
    // Arrange
    vi.useFakeTimers()
    const { button, note } = climber(24)

    // Act
    press(button, 'pointerdown')
    vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_EVERY_MS * 22)
    const at = note()
    vi.advanceTimersByTime(10_000)

    // Assert
    expect(HOLD_DELAY_MS + HOLD_EVERY_MS * 22).toBeLessThan(4000)
    expect(at).toBe(24)
    expect(note()).toBe(24)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['pointerup', 'pointercancel', 'pointerleave'])(
    'stops repeating on %s',
    (end) => {
      // Arrange
      vi.useFakeTimers()
      const { button, note } = climber(24)
      press(button, 'pointerdown')
      vi.advanceTimersByTime(HOLD_DELAY_MS + HOLD_EVERY_MS)

      // Act
      press(button, end)
      const at = note()
      vi.advanceTimersByTime(2000)

      // Assert
      expect(at).toBe(3)
      expect(note()).toBe(3)
    },
  )

  it('moves nothing more on the click a pointer press ends with', () => {
    // Arrange
    vi.useFakeTimers()
    const { button, note } = climber(24)
    press(button, 'pointerdown')
    press(button, 'pointerup')

    // Act: a pointer's click counts its press in `detail`
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))

    // Assert
    expect(note()).toBe(1)
  })

  it('moves one semitone on a keyboard press, which is a click with no pointer', () => {
    // Arrange
    const { button, note } = climber(24)

    // Act: Enter and Space click a button with `detail` 0
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))

    // Assert
    expect(note()).toBe(2)
  })

  it('ignores a press that is not the main button, and swallows the context menu', () => {
    // Arrange
    vi.useFakeTimers()
    const { button, note } = climber(24)
    const menu = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
    })

    // Act
    press(button, 'pointerdown', { button: 2 })
    vi.advanceTimersByTime(2000)
    button.dispatchEvent(menu)

    // Assert
    expect(note()).toBe(0)
    expect(menu.defaultPrevented).toBe(true)
  })
})
