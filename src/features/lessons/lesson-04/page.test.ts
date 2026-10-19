// ============================================================
// Lesson 4's page document — the house in its sprite, and its spoken signs
// ============================================================
//
// learn/04.html is hand-written markup, so two of its promises are held
// here: the sprite's `#i-home` is the very house the canvas draws
// (kit/home-glyph.ts), and every ♯ and ♭ its text prints is followed by its
// spoken name, the sign itself hidden from a screen reader.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HOME_PATH } from '@/features/lessons/kit/home-glyph'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/04.html'), 'utf8')

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
})
