// ============================================================
// Lesson episode tests — a Watch section only for a film that can play
// ============================================================
//
// Each lesson with a film is read from its own page's markup, as it ships,
// so the masthead link and the section the tests look for are the real ones.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import './browser-doubles.test-fixtures'
import { createEpisode } from './episode'
import type { FilmSources } from './films'

const SOURCES: FilmSources = {
  hd: 'https://films.example.r2.dev/lesson-1080p.mp4',
  sd: 'https://films.example.r2.dev/lesson-720p.mp4',
}

/** Lesson n's page body, its markup as written and none of its scripts run. */
function openPage(n: number): void {
  const html = readFileSync(
    resolve(process.cwd(), `learn/${String(n).padStart(2, '0')}.html`),
    'utf8',
  )
  const page = new DOMParser().parseFromString(html, 'text/html')
  document.body.replaceChildren(
    ...Array.from(page.body.childNodes, (node) =>
      document.importNode(node, true),
    ),
  )
}

/** The page as it would ship with its film on: Watch and its link shown, the masthead III Explorer. */
function showWatchInMarkup(): void {
  document.getElementById('watch')?.removeAttribute('hidden')
  document
    .querySelector('.mast-nav a[href="#watch"]')
    ?.removeAttribute('hidden')
  document
    .querySelector('.mast-nav a[href="#explorer"] b')
    ?.replaceChildren('III')
}

function episode(film: FilmSources | null): void {
  createEpisode({ film, captions: '/captions.vtt', vtt: '', chapters: [] })
}

/** The masthead's numbered links a reader can see, as "II Watch". */
function numberedLinks(): string[] {
  return Array.from(
    document.querySelectorAll('.mast-nav a:not([hidden])'),
    (a) => [
      a.querySelector('b')?.textContent ?? '',
      a.lastChild?.textContent?.trim() ?? '',
    ],
  )
    .filter(([mark]) => /^[IVX]+$/.test(mark))
    .map(([mark, name]) => `${mark} ${name}`)
}

afterEach(() => {
  document.body.textContent = ''
})

describe.each([1, 2])('Lesson %i', (n) => {
  it('ships with no Watch section and no Watch link, so it paints without them before its script runs', () => {
    // Act
    openPage(n)

    // Assert
    expect(document.getElementById('watch')?.hidden).toBe(true)
    expect(numberedLinks()).toEqual(['I Lesson', 'II Explorer'])
  })

  it('shows the Watch section and its masthead link once the film has sources, Explorer moving to III', () => {
    // Arrange
    openPage(n)

    // Act
    episode(SOURCES)

    // Assert
    expect(document.getElementById('watch')?.hidden).toBe(false)
    expect(numberedLinks()).toEqual(['I Lesson', 'II Watch', 'III Explorer'])
  })

  it('takes them off a page that shows them while the film has no sources, the numerals closing up', () => {
    // Arrange
    openPage(n)
    showWatchInMarkup()

    // Act
    episode(null)

    // Assert
    expect(document.getElementById('watch')?.hidden).toBe(true)
    expect(numberedLinks()).toEqual(['I Lesson', 'II Explorer'])
  })
})
