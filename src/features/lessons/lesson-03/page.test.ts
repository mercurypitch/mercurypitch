// ============================================================
// Lesson 3's page document — its film's Watch section, as the markup ships it
// ============================================================
//
// learn/03.html is hand-written markup, so one of its promises is held
// here: its film's Watch section waits hidden, with its masthead link, for
// kit/episode.ts to show them once the film has its sources, as Lessons 2
// and 4's do, and the hero links the film's own page.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const PAGE = readFileSync(resolve(process.cwd(), 'learn/03.html'), 'utf8')

afterEach(() => {
  document.body.textContent = ''
})

describe("Lesson 3's page", () => {
  it('carries its film in a Watch section, hidden with its masthead link until kit/episode.ts shows them', () => {
    // Arrange
    document.body.innerHTML = PAGE.slice(
      PAGE.indexOf('<body>') + 6,
      PAGE.indexOf('</body>'),
    )

    // Act
    const watch = document.querySelector<HTMLElement>('section#watch')
    const link = document.querySelector<HTMLAnchorElement>(
      '.mast-nav a[href="#watch"]',
    )

    // Assert
    expect(watch?.hidden).toBe(true)
    expect(link?.hidden).toBe(true)
    expect(watch?.querySelector('video#ep')?.getAttribute('poster')).toBe(
      '/src/features/lessons/lesson-03/assets/poster.jpg',
    )
    expect(watch?.querySelector('track')?.getAttribute('src')).toBe(
      '/src/features/lessons/lesson-03/assets/lesson-03.en.vtt',
    )
    // after Sing it and before the explorer, as on Lesson 4's page
    expect(PAGE.indexOf('id="sing"')).toBeLessThan(PAGE.indexOf('id="watch"'))
    expect(PAGE.indexOf('id="watch"')).toBeLessThan(
      PAGE.indexOf('id="explorer"'),
    )
    // the hero's way to the film's own page, with its running time
    expect(
      document
        .querySelector('.hero .hero-film a[href="/learn/03/watch"]')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Watch the film9:32')
  })
})
