// ============================================================
// Lesson 14 wrap — the practise card and the season's close, by the ending
// ============================================================
//
// WEB-SPEC, Wrap, on the page's own markup: with Sing it skipped or after
// singing, the Karaoke Night card with "Ten minutes", and the season's
// close with its line, Karaoke Night in a tab of its own and the map; after
// a rest ("Just listen today", "Effortful" or "Uncomfortable") the rest
// card, which links nowhere, and the close with "You've seen every note
// you sing." and the map alone, no "Now sing a whole song." and no Karaoke
// Night. The close is no link itself and keeps the song line's still after
// its words, an image named by its text alternative.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { VisitEnding } from '@/features/lessons/kit/comfort'
import { STILL_ALT } from './lines'
import { el, loadPage } from './page-dom.test-fixtures'
import { initWrap } from './wrap'

beforeEach(() => {
  localStorage.clear()
  VisitEnding.set('practise')
  loadPage()
})

afterEach(() => {
  VisitEnding.set('practise')
  document.body.textContent = ''
})

const close = (): HTMLElement => el('#wrap [data-next-card="end"]')
const links = (): string[][] =>
  Array.from(close().querySelectorAll('a'), (a) => [
    (a.textContent ?? '').trim(),
    a.getAttribute('href') ?? '',
    a.getAttribute('target') ?? '',
  ])

describe("Lesson 14's Wrap", () => {
  it('closes the season with its line, Karaoke Night in a tab of its own and the map, its still after the words', () => {
    // Act
    const line = initWrap()

    // Assert
    expect(close().tagName).toBe('DIV')
    expect(close().querySelector('.eyebrow')?.textContent).toBe(
      'End of Season 1',
    )
    expect(close().querySelector('.end-line')?.textContent).toBe(
      "You've seen every note you sing. Now sing a whole song.",
    )
    expect(links()).toEqual([
      ['Karaoke Night', '/karaoke-night?lesson=14', '_blank'],
      ['See the season map', '#explorer', ''],
    ])
    expect(Array.from(close().children, (k) => k.classList[0])).toEqual([
      'next-words',
      'end-still',
    ])
    expect(line?.state).toBe('still')
    expect(close().querySelector('canvas')?.getAttribute('aria-label')).toBe(
      STILL_ALT,
    )
    expect(el('#practiseCard').getAttribute('href')).toBe(
      '/karaoke-night?lesson=14',
    )
  })

  it('after a rest keeps the answer and the map alone, and the practise card turns to the rest card with no link', () => {
    // Arrange
    initWrap()

    // Act: "Effortful", "Uncomfortable" or "Just listen today"
    VisitEnding.set('rest')

    // Assert
    expect(close().dataset.ending).toBe('rest')
    expect(close().querySelector('.end-line')?.textContent).toBe(
      "You've seen every note you sing.",
    )
    expect(close().textContent).not.toContain('Now sing a whole song.')
    expect(links()).toEqual([['See the season map', '#explorer', '']])
    expect(close().querySelector('.end-still canvas')).not.toBeNull()
    const card = el('#practiseCard')
    expect(card.hasAttribute('href')).toBe(false)
    expect(el('#practiseCard [data-ending="rest"]').hidden).toBe(false)
    expect(el('#practiseCard [data-ending="practise"]').hidden).toBe(true)
  })
})
