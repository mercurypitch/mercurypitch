// ============================================================
// Lesson 5's page document — the cold open first, the recall after it
// ============================================================
//
// learn/05.html is hand-written markup, so its order is held here: the
// page opens on its cold open, the predict in the hero, and asks Lesson 3's
// recall straight after, as Lesson 2 does (MASTER-PLAN § 4.2, decided 20
// October 2026).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/05.html'), 'utf8')

describe("Lesson 5's page", () => {
  it('opens on the cold open, the recall after it and before the four words', () => {
    // Act: each part's place in the document
    const at = ['id="predict"', 'id="recall"', 'id="words"'].map((id) =>
      PAGE.indexOf(id),
    )

    // Assert
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
