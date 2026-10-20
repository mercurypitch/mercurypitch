// ============================================================
// Lesson explorer tests — a card's links from any lesson's page
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { cardActions, createExplorer } from './explorer'
import { filmSources } from './films'
import type { LessonView } from './lesson-state'
import { lessonViews } from './lesson-state'
import type { StepMarks } from './position'
import { Positions } from './position'
import { Done } from './progress'
import type { Lesson } from './season'
import { LESSONS, TOPICS } from './season'

/** A lesson for a card test, live or coming later as `extra` makes it. */
const lesson = (extra: Partial<Lesson> = {}): Lesson => ({
  n: 9,
  lane: 'theory',
  title: 'Lesson nine',
  short: 'Nine',
  topics: [],
  hook: 'Why?',
  sig: 'A figure.',
  pr: {},
  ...extra,
})

/** Lesson `L` as a viewer who marked `done` and reached `steps` sees it from lesson `current`'s page. */
function view(
  L: Lesson,
  current: number,
  done: readonly number[] = [],
  steps: StepMarks = {},
): LessonView {
  const season = LESSONS.map((M) => (M.n === L.n ? L : M))
  return lessonViews(season, { done: new Set(done), steps, current })[L.n]
}

/** Lesson 1 as it reads once its film has sources (films.ts). */
const filmed: Lesson = { ...LESSONS[1], film: 'published' }

/** Where Lesson 1's card sends Watch from `at`: nowhere until its film has sources. */
const watchFrom = (at: string): string[] =>
  filmSources(1) === null ? [] : [`${at}#watch`]

/** Each action of a card as [label, href (null for a button), primary]. */
function actions(markup: string): [string, string | null, boolean][] {
  const box = document.createElement('div')
  box.innerHTML = markup
  return Array.from(box.querySelectorAll('a, button')).map((el) => [
    el.textContent ?? '',
    el.getAttribute('href'),
    el.classList.contains('primary'),
  ])
}

function explorerPage(): void {
  document.body.innerHTML =
    '<div class="filters"><button type="button" data-lane="all">All</button></div><div id="graph"></div><ol id="exList"></ol><div id="exCardHost"></div>'
}

const cardLinks = (): (string | null)[] =>
  Array.from(document.querySelectorAll('#exCardHost a.btn')).map((a) =>
    a.getAttribute('href'),
  )

const openCard = (): Element | null =>
  document.querySelector('#exCardHost .ex-card')

/** The open card's rows as { term: text }. */
function cardRows(): Record<string, string> {
  const rows: Record<string, string> = {}
  for (const dt of Array.from(document.querySelectorAll('#exCardHost dt')))
    rows[dt.textContent ?? ''] = dt.nextElementSibling?.textContent ?? ''
  return rows
}

/** The team's planning words, which a learner never meets on a card. */
const PLANNING =
  /Signature|deep link|\bslug\b|In production|\bplanned\b|durationSec|launch field|placeholder|still rendering|\b[TS]\d\d\b/i

afterEach(() => {
  localStorage.clear()
  document.body.textContent = ''
})

describe('cardActions', () => {
  it("starts the page's own lesson at the top of the page, its episode beside it", () => {
    // Act
    const own = actions(cardActions(view(filmed, 1), 1))

    // Assert
    expect(own).toEqual([
      ['Start lesson', '#top', true],
      ['Watch the episode', '#watch', false],
      ['Mark as done', null, false],
    ])
  })

  it('links another live lesson to its own page', () => {
    // Act: Lesson 1's card on Lesson 2's page
    const other = actions(cardActions(view(filmed, 2), 2))

    // Assert
    expect(other.map(([label, href]) => [label, href])).toEqual([
      ['Start lesson', '/learn/01'],
      ['Watch the episode', '/learn/01#watch'],
      ['Mark as done', null],
    ])
  })

  it('continues a lesson left part way at the step the viewer reached', () => {
    // Act: Lesson 2, left at step 3, from Lesson 1's page
    const fromOne = actions(
      cardActions(view(LESSONS[2], 1, [], { 2: { step: 3, of: 6 } }), 1),
    )

    // Assert: its film is not published, so there is nothing to watch
    expect(fromOne).toEqual([
      ['Continue: step 3', '/learn/02#step-3', true],
      ['Mark as done', null, false],
    ])
  })

  it('offers a lesson marked done again from the top, its toggle pressed', () => {
    // Arrange
    const box = document.createElement('div')

    // Act
    box.innerHTML = cardActions(view(LESSONS[2], 1, [2]), 1)

    // Assert
    expect(actions(box.innerHTML)).toEqual([
      ['Read again', '/learn/02', true],
      ['Done', null, false],
    ])
    expect(box.querySelector('[data-done]')?.getAttribute('aria-pressed')).toBe(
      'true',
    )
  })

  it('offers no episode until its film is published', () => {
    // Arrange
    const L = lesson({ page: '/learn/09', minutes: 12, film: 'production' })

    // Act
    const made = actions(cardActions(view(L, 1), 1))

    // Assert
    expect(made).toEqual([
      ['Start lesson', '/learn/09', true],
      ['Mark as done', null, false],
    ])
  })

  it('offers nothing for a lesson coming later', () => {
    // Act
    const later = cardActions(view(lesson(), 1), 1)

    // Assert
    expect(later).toBe('')
  })
})

describe('createExplorer', () => {
  it("opens on the page's own lesson, its poster in its card and its actions within the page", () => {
    // Arrange
    explorerPage()

    // Act
    createExplorer({ current: 1, posters: { 1: '/assets/poster-01.jpg' } })

    // Assert
    const img = openCard()?.querySelector('img')
    expect(openCard()?.querySelector('h3')?.textContent).toBe('What is a note?')
    expect(img?.getAttribute('src')).toBe('/assets/poster-01.jpg')
    expect(img?.alt).toBe(LESSONS[1].posterAlt)
    expect(cardLinks()).toEqual(['#top', ...watchFrom('')])
  })

  it("opens on another lesson's page on that lesson, and links Lesson 1's card to its own page", () => {
    // Arrange: Lesson 4's page
    explorerPage()
    const explorer = createExplorer({ current: 4 })
    const opened = openCard()?.querySelector('h3')?.textContent

    // Act
    explorer.select(1, false)

    // Assert
    expect(opened).toBe(LESSONS[4].title)
    expect(openCard()?.querySelector('h3')?.textContent).toBe('What is a note?')
    expect(cardLinks()).toEqual(['/learn/01', ...watchFrom('/learn/01')])
  })

  it("draws none of the team's planning words on any lesson's card", () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    for (const L of LESSONS) {
      // Act
      explorer.select(L.n, false)

      // Assert
      expect(openCard()?.textContent, `lesson ${L.n}`).not.toMatch(PLANNING)
    }
  })

  it('shows the trailer as its hook and "Coming later", and nothing else', () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    // Act
    explorer.select(0, false)

    // Assert
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(openCard()?.querySelector('.hookq')?.textContent).toBe(
      LESSONS[0].hook,
    )
    expect(openCard()?.querySelectorAll('dl, a.btn, [data-done]')).toHaveLength(
      0,
    )
  })

  it('names each topic in words, its code kept for the page as data', () => {
    // Arrange
    explorerPage()

    // Act
    createExplorer({ current: 1 })

    // Assert
    const topics = Array.from(
      document.querySelectorAll<HTMLElement>('#exCardHost .topic'),
    ).map((t) => [t.dataset.topic, t.textContent])
    expect(topics).toEqual([
      ['T01', TOPICS.T01],
      ['T02', TOPICS.T02],
    ])
  })

  it("gives a live lesson's reading time, and its film's once the film plays", () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 1 })
    const before = cardRows().Length

    // Act
    explorer.setLength(1, '5:14')

    // Assert
    expect(before).toBe('10 min')
    expect(cardRows().Length).toBe('10 min · film 5:14')
  })

  it('draws a lesson with no drill to link without a Practise row, and one coming later without a Length row', () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    // Act: Lesson 10 is coming later, with no drill to link yet
    explorer.select(10, false)

    // Assert
    expect(Object.keys(cardRows())).toEqual(['Topics', 'Builds on', 'Opens'])
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Coming later')
  })

  it('follows the viewer: a step reached on its page continues it, and marking it done offers it again', () => {
    // Arrange: Lesson 2's card on Lesson 1's map
    explorerPage()
    const explorer = createExplorer({ current: 1 })
    explorer.select(2, false)
    Positions.reach(2, { step: 4, of: 6 })
    const continued = cardLinks()

    // Act
    Done.set(2, true)

    // Assert
    expect(continued).toEqual(['/learn/02#step-4'])
    expect(cardLinks()).toEqual(['/learn/02'])
    expect(openCard()?.querySelector('a.btn')?.textContent).toBe('Read again')
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Done')
  })
})

describe("a draft lesson on Lesson 1's map (drafts.ts)", () => {
  /** Lesson 1's explorer as a build with drafts shown ("1") or hidden ("0") draws it, Lesson 3 selected. */
  async function lessonThreeFromLessonOne(drafts: '1' | '0'): Promise<void> {
    vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
    vi.resetModules()
    const { createExplorer: explorerBuilt } = await import('./explorer')
    explorerPage()
    explorerBuilt({ current: 1 }).select(3, false)
  }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('links a shown draft to its own page, to read and never to watch', async () => {
    // Act
    await lessonThreeFromLessonOne('1')

    // Assert
    expect(document.querySelector('#exCardHost h3')?.textContent).toBe(
      'Match a note',
    )
    expect(cardLinks()).toEqual(['/learn/03'])
  })

  it('shows a hidden draft as coming later, with no link to the page the build leaves out', async () => {
    // Arrange: a step kept from a visit to a build that showed it
    localStorage.setItem('fyp-pos', JSON.stringify({ 3: { step: 3, of: 6 } }))

    // Act
    await lessonThreeFromLessonOne('0')

    // Assert
    const card = document.querySelector('#exCardHost .ex-card')
    expect(card?.querySelector('h3')?.textContent).toBe('Match a note')
    expect(card?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(card?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(card?.innerHTML).not.toContain('/learn/03')
  })

  it('treats Lesson 5, a draft too, the same way either side of the switch', async () => {
    // Arrange
    const lessonFive = async (drafts: '1' | '0'): Promise<Element | null> => {
      vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
      vi.resetModules()
      const { createExplorer: explorerBuilt } = await import('./explorer')
      explorerPage()
      explorerBuilt({ current: 1 }).select(5, false)
      return document.querySelector('#exCardHost .ex-card')
    }

    // Act
    const shown = await lessonFive('1')
    const shownLinks = cardLinks()
    const hidden = await lessonFive('0')

    // Assert: to read where drafts show; coming later, and nothing to the page, where they do not
    expect(shown?.querySelector('h3')?.textContent).toBe(
      'Breath and a steady note',
    )
    expect(shownLinks).toEqual(['/learn/05'])
    expect(hidden?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(hidden?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(hidden?.innerHTML).not.toContain('/learn/05')
    expect(hidden?.innerHTML).toContain('/mirror?lesson=05')
  })
})
