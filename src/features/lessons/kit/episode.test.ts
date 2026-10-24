// ============================================================
// Lesson episode tests — a Watch section only for a film that can play
// ============================================================
//
// Each lesson with a film is read from its own page's markup, as it ships,
// so the masthead link and the section the tests look for are the real ones,
// and its transcript from the captions the page bundles: every turn named
// by its host, Merc or Tavi, as the captions name them.

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

function episode(film: FilmSources | null, vtt = ''): void {
  createEpisode({ film, captions: '/captions.vtt', vtt, chapters: [] })
}

/** Lesson n's captions, as its page bundles them. */
function captionsOf(n: number): string {
  const name = `lesson-${String(n).padStart(2, '0')}`
  return readFileSync(
    resolve(
      process.cwd(),
      `src/features/lessons/${name}/assets/${name}.en.vtt`,
    ),
    'utf8',
  )
}

/** The transcript's paragraphs as [speaker, words]: no speaker for a sound. */
function transcript(): [string, string][] {
  return Array.from(document.querySelectorAll('#tx p'), (p) => [
    p.querySelector('.who')?.textContent ?? '',
    p.lastChild?.textContent ?? '',
  ])
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

  it('names each turn of its transcript Merc or Tavi, as its captions do', () => {
    // Arrange
    openPage(n)

    // Act
    episode(SOURCES, captionsOf(n))

    // Assert: both hosts speak, no label is left in the words, and the
    // opening sounds name who sings
    const paragraphs = transcript()
    const speakers = new Set(paragraphs.map(([who]) => who))
    expect([...speakers].sort()).toEqual(['', 'Merc', 'Tavi'])
    expect(
      paragraphs.filter(([, words]) => /^[A-Z]{2,}(?: MERC)?:/.test(words)),
    ).toEqual([])
    expect(paragraphs.slice(0, 2)).toEqual([
      ['', 'Merc sings an A, 220 Hz'],
      ['', 'Tavi sings an A, 440 Hz'],
    ])
  })
})

describe('a transcript from captions cut before 24 October 2026', () => {
  it('still names the hosts from the colour labels', () => {
    // Arrange
    openPage(1)
    const vtt = [
      'WEBVTT',
      '00:00.000 --> 00:01.000\nBLUE: One.',
      '00:01.000 --> 00:02.000\nORANGE: Two.',
      '00:02.000 --> 00:03.000\nBLUE MERC: Three.',
      '00:03.000 --> 00:04.000\nORANGE MERC: Four.',
    ].join('\n\n')

    // Act
    episode(SOURCES, vtt)

    // Assert
    expect(transcript()).toEqual([
      ['Merc', 'One.'],
      ['Tavi', 'Two.'],
      ['Merc', 'Three.'],
      ['Tavi', 'Four.'],
    ])
  })
})
