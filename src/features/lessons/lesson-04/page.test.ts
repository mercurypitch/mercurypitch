// ============================================================
// Lesson 4's page document — the house in its sprite, and its spoken signs
// ============================================================
//
// learn/04.html is hand-written markup, so two of its promises are held
// here: the sprite's `#i-home` is the very house the canvas draws
// (kit/home-glyph.ts), and every ♯ and ♭ its text prints is followed by its
// spoken name, the sign itself hidden from a screen reader. Mounted, its
// Move do marks the button at an end aria-disabled, and only that one, and
// a press there keeps the keyboard's place and leaves do where it is.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { HOME_PATH } from '@/features/lessons/kit/home-glyph'
import { MOVE_MAX } from '@/features/lessons/kit/move-do'
import { initSing } from './sing'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/04.html'), 'utf8')

afterEach(() => {
  document.body.textContent = ''
})

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span class="sr">\s(?:sharp|flat)<\/span\s*>/g

describe("Lesson 4's page", () => {
  it("draws the sprite's house with the canvas's own path", () => {
    // Act
    const symbol = /<symbol id="i-home"[^>]*>([\s\S]*?)<\/symbol>/.exec(PAGE)

    // Assert
    expect(symbol).not.toBeNull()
    expect(symbol?.[1]).toContain(`d="${HOME_PATH}"`)
  })

  it('follows every ♯ and ♭ it prints with its spoken name', () => {
    // Arrange
    const signs = PAGE.match(/[♯♭]/g) ?? []

    // Act
    const bare = PAGE.replace(SPOKEN_SIGN, '').match(/[♯♭]/g) ?? []

    // Assert
    expect(signs.length).toBeGreaterThan(0)
    expect(bare).toEqual([])
  })

  it('carries no Watch section: Lesson 4 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the cold open, the recall after it and before the four words', () => {
    // Act: each section's place in the document
    const at = ['id="cold"', 'id="recall"', 'id="words"'].map((id) =>
      PAGE.indexOf(id),
    )

    // Assert: decided 20 October 2026 (MASTER-PLAN § 4.2), as Lesson 2 runs
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  /** Sing it mounted on the page's own markup, and its two Move do buttons. */
  function mountMoveDo(): [HTMLButtonElement, HTMLButtonElement] {
    document.body.innerHTML =
      /<body[^>]*>([\s\S]*)<\/body>/.exec(PAGE)?.[1] ?? ''
    initSing({ blue: 'blue.png', orange: 'orange.png' })
    const button = (step: string): HTMLButtonElement => {
      const b = document.querySelector<HTMLButtonElement>(
        `#sing [data-move-do="${step}"]`,
      )
      if (b === null) throw new Error(`no Move do ${step}`)
      return b
    }
    return [button('-1'), button('1')]
  }

  it("marks Move do's lower button aria-disabled at the lowest do and its higher one at the highest", () => {
    // Arrange
    const [lower, higher] = mountMoveDo()
    const ends = (): (string | null)[] => [
      lower.getAttribute('aria-disabled'),
      higher.getAttribute('aria-disabled'),
    ]

    // Act: down to the lowest do, then up to the highest
    for (let k = 0; k < MOVE_MAX; k++) lower.click()
    const lowest = ends()
    for (let k = 0; k < 2 * MOVE_MAX; k++) higher.click()
    const highest = ends()

    // Assert: never disabled, so neither leaves the tab order
    expect(lowest).toEqual(['true', 'false'])
    expect(highest).toEqual(['false', 'true'])
    expect([lower.disabled, higher.disabled]).toEqual([false, false])
  })

  it('keeps the keyboard on Move do lower at the lowest do, and a press there leaves do where it is', () => {
    // Arrange: do four lower, the keyboard on lower
    const [lower] = mountMoveDo()
    const guide = (): string | null =>
      document.querySelector('#scaleGuide')?.getAttribute('aria-label') ?? null
    lower.focus()
    for (let k = 0; k < MOVE_MAX; k++) lower.click()
    const lowest = guide()

    // Act
    lower.click()

    // Assert: still B♭2 to B♭3, four below D3
    expect(lowest).toMatch(/^Thirteen rows, B flat 2 to B flat 3,/)
    expect(guide()).toBe(lowest)
    expect(document.activeElement).toBe(lower)
  })
})
