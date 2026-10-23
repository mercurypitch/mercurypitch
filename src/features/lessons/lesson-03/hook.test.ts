// ============================================================
// Lesson 3 cold open tests — the hook on the page's own markup
// ============================================================
//
// The stage's Tested tile is the predict's answer, so it is held back until
// a choice is made, and shows with the cards the choice reveals.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { initHook } from './hook'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/03.html'), 'utf8')

const tested = (): Element | null =>
  document.querySelector('[data-hook-tested]')

// the hook's sky repaints at each resize; jsdom has no ResizeObserver
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    disconnect(): void {}
  },
)

beforeEach(() => {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)
  if (body === null) throw new Error('learn/03.html has no body')
  document.body.innerHTML = body[1]
  initHook()
})

afterEach(() => {
  document.body.textContent = ''
})

describe("Lesson 3's hook", () => {
  it('holds the Tested tile back until a choice is made', () => {
    // Arrange
    const before = tested()?.classList.contains('held')

    // Act
    document
      .querySelector<HTMLButtonElement>('#predict [data-choice="most"]')
      ?.click()

    // Assert
    expect(before).toBe(true)
    expect(tested()?.classList.contains('held')).toBe(false)
  })
})
