// ============================================================
// Lesson 6's page document — its spoken signs, its guide, its references
// ============================================================
//
// learn/06.html is hand-written markup, so some of its promises are held
// here: every ♯ and ♭ its text prints is followed by its spoken name, the
// sign itself hidden from a screen reader, and no accessible name carries
// a sign at all; the sing-along guide's label is the code's own; every id
// a label or description points at exists, once; there is no Watch
// section, because Lesson 6 has no film; and the page opens on its cold
// open, the predict in the hero, with the recall in its own section after.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_LABEL } from './sing-guide'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/06.html'), 'utf8')

/** A sign as the page writes it, however the formatter wraps it: hidden, then said. */
const SPOKEN_SIGN =
  /<span\s+aria-hidden="true"\s*>[♯♭]<\/span\s*>\s*<span\s+class="sr"\s*>\s(?:sharp|flat)<\/span\s*>/g

/** Every value of one attribute, in page order. */
const valuesOf = (attr: string): string[] =>
  Array.from(
    PAGE.matchAll(new RegExp(`\\s${attr}="([^"]*)"`, 'g')),
    (m) => m[1],
  )

describe("Lesson 6's page", () => {
  it('follows every ♯ and ♭ it prints with its spoken name', () => {
    // Arrange
    const signs = PAGE.match(/[♯♭]/g) ?? []

    // Act
    const bare = PAGE.replace(SPOKEN_SIGN, '').match(/[♯♭]/g) ?? []

    // Assert
    expect(signs.length).toBeGreaterThan(0)
    expect(bare).toEqual([])
  })

  it('puts no sign in an accessible name or a share card: they are spoken', () => {
    const named = [
      ...valuesOf('aria-label'),
      ...valuesOf('aria-valuetext'),
      ...valuesOf('alt'),
      ...valuesOf('content'),
    ]
    expect(named.filter((v) => /[♯♭]/.test(v))).toEqual([])
  })

  it("labels the sing-along guide with the code's own description", () => {
    expect(PAGE).toContain(`aria-label="${GUIDE_LABEL}"`)
  })

  it('points every label and description at an id that exists, once', () => {
    // Arrange
    const ids = valuesOf('id')
    const refs = [
      ...valuesOf('aria-labelledby'),
      ...valuesOf('aria-describedby'),
    ].flatMap((v) => v.split(/\s+/))

    // Act
    const missing = refs.filter((r) => !ids.includes(r))
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i)

    // Assert
    expect(refs.length).toBeGreaterThan(0)
    expect(missing).toEqual([])
    expect(twice).toEqual([])
  })

  it('carries no Watch section: Lesson 6 has no film', () => {
    expect(PAGE).not.toMatch(/id="watch"/)
    expect(PAGE).not.toMatch(/<video/)
  })

  it('opens on the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = ['id="predict"', 'id="recall"', 'id="words"'].map((id) =>
      PAGE.indexOf(id),
    )

    // Assert: CURIOSITY-MOMENTS § 3.1, as Lessons 2, 4 and 5 run
    expect(at.every((i) => i > 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('asks the recall in a section of its own, outside the hero', () => {
    // Act
    const hero = /<section class="hero[^"]*"[\s\S]*?<\/section>\s*<!--/.exec(
      PAGE,
    )?.[0]

    // Assert
    expect(hero).toBeDefined()
    expect(hero).toContain('id="predict"')
    expect(hero).not.toContain('id="recall"')
  })
})
