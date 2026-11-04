// ============================================================
// Lesson leave watch tests — off screen for 600 ms, a hidden page, a page gone
// ============================================================
//
// Lesson 3's rule for leaving, on fake timers and the kit's observer
// double: a section off screen for 600 ms is left, a moment away under
// 600 ms is not, a hidden page and a page going are left at once.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scrollAwayAndBack, scrollIntoViewAgain, scrollOutOfView, } from './browser-doubles.test-fixtures'
import { AWAY_MS, onLeave } from './leave'

/** A section in the document, watched: how many times it has been left. */
function watched(): { section: HTMLElement; left: () => number } {
  const section = document.createElement('section')
  document.body.append(section)
  const leave = vi.fn()
  onLeave(section, leave)
  return { section, left: () => leave.mock.calls.length }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'hidden')
  document.body.textContent = ''
})

describe("the kit's leave watch", () => {
  it('leaves a section that stays off screen for 600 ms, and not before', () => {
    // Arrange
    const { section, left } = watched()

    // Act
    scrollOutOfView(section)
    vi.advanceTimersByTime(AWAY_MS - 1)
    const before = left()
    vi.advanceTimersByTime(1)

    // Assert
    expect(AWAY_MS).toBe(600)
    expect(before).toBe(0)
    expect(left()).toBe(1)
  })

  it('stops nothing for a moment away: back within 600 ms, or away and back in one report', () => {
    // Arrange
    const { section, left } = watched()

    // Act
    scrollOutOfView(section)
    vi.advanceTimersByTime(AWAY_MS - 100)
    scrollIntoViewAgain(section)
    scrollAwayAndBack(section)
    vi.advanceTimersByTime(AWAY_MS * 2)

    // Assert
    expect(left()).toBe(0)
  })

  it('leaves at once when the page is hidden, and when it goes', () => {
    // Arrange
    const { left } = watched()

    // Act
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
    const hidden = left()
    window.dispatchEvent(new Event('pagehide'))

    // Assert
    expect(hidden).toBe(1)
    expect(left()).toBe(2)
  })

  it('stays when the page is shown again', () => {
    // Arrange
    const { left } = watched()

    // Act
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    })
    document.dispatchEvent(new Event('visibilitychange'))

    // Assert
    expect(left()).toBe(0)
  })
})
