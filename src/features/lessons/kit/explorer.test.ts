// ============================================================
// Lesson explorer tests — a card's links from any lesson's page
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { cardActions, createExplorer } from './explorer'
import type { Lesson } from './season'
import { LESSONS } from './season'

/** A lesson for a card test, live or planned as `extra` makes it. */
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

afterEach(() => {
  document.body.textContent = ''
})

describe('cardActions', () => {
  it("links the page's own lesson within the page, the episode first", () => {
    // Act
    const own = actions(cardActions(LESSONS[1], 'ready', 1))

    // Assert
    expect(own).toEqual([
      ['Watch the episode', '#watch', true],
      ['Read the lesson', '#lesson', false],
      ['Mark as done', null, false],
    ])
  })

  it('links another live lesson to its own page', () => {
    // Act: Lesson 1's card on Lesson 2's page
    const other = actions(cardActions(LESSONS[1], 'ready', 2))

    // Assert
    expect(other.map(([label, href]) => [label, href])).toEqual([
      ['Watch the episode', '/learn/01#watch'],
      ['Read the lesson', '/learn/01#lesson'],
      ['Mark as done', null],
    ])
  })

  it('offers no episode while its film is in production, the lesson leading', () => {
    // Arrange
    const L = lesson({ page: '/learn/09', film: 'production' })

    // Act
    const inProduction = actions(cardActions(L, 'production', 1))

    // Assert
    expect(inProduction).toEqual([
      ['Read the lesson', '/learn/09#lesson', true],
      ['Mark as done', null, false],
    ])
  })

  it('offers the lesson alone for a page with no film', () => {
    // Arrange
    const L = lesson({ page: '/learn/09' })

    // Act
    const readOnly = actions(cardActions(L, 'read', 1))

    // Assert
    expect(readOnly).toEqual([
      ['Read the lesson', '/learn/09#lesson', true],
      ['Mark as done', null, false],
    ])
  })

  it('offers nothing for a planned lesson', () => {
    // Act
    const planned = cardActions(lesson(), 'planned', 1)

    // Assert
    expect(planned).toBe('')
  })
})

describe('createExplorer', () => {
  it("opens on the page's own lesson, its poster in its card and its links within the page", () => {
    // Arrange
    explorerPage()

    // Act
    createExplorer({ current: 1, posters: { 1: '/assets/poster-01.jpg' } })

    // Assert
    const card = document.querySelector('#exCardHost .ex-card')
    const img = card?.querySelector('img')
    expect(card?.querySelector('h3')?.textContent).toBe('What is a note?')
    expect(img?.getAttribute('src')).toBe('/assets/poster-01.jpg')
    expect(img?.alt).toBe(LESSONS[1].posterAlt)
    expect(cardLinks()).toEqual(['#watch', '#lesson'])
  })

  it("opens on another lesson's page on that lesson, and links Lesson 1's card to its own page", () => {
    // Arrange: Lesson 3's page
    explorerPage()
    const explorer = createExplorer({ current: 3 })
    const opened = document.querySelector('#exCardHost h3')?.textContent

    // Act
    explorer.select(1, false)

    // Assert
    expect(opened).toBe(LESSONS[3].title)
    expect(document.querySelector('#exCardHost h3')?.textContent).toBe(
      'What is a note?',
    )
    expect(cardLinks()).toEqual(['/learn/01#watch', '/learn/01#lesson'])
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
    expect(cardLinks()).toEqual(['/learn/03#lesson'])
  })

  it('shows a hidden draft as planned, with no link to the page the build leaves out', async () => {
    // Act
    await lessonThreeFromLessonOne('0')

    // Assert
    const card = document.querySelector('#exCardHost .ex-card')
    expect(card?.querySelector('h3')?.textContent).toBe('Match a note')
    expect(card?.textContent).toContain('Planned')
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

    // Assert: to read where drafts show; planned, and nothing to the page, where they do not
    expect(shown?.querySelector('h3')?.textContent).toBe(
      'Breath and a steady note',
    )
    expect(shownLinks).toEqual(['/learn/05#lesson'])
    expect(hidden?.textContent).toContain('Planned')
    expect(hidden?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(hidden?.innerHTML).not.toContain('/learn/05')
    expect(hidden?.innerHTML).toContain('/mirror?lesson=05')
  })
})
