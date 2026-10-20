// ============================================================
// Next-lesson card tests — the Wrap's card in each state, and on the page
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as Card from './next-card'
import type { NextCard } from './next-card'
import { createNextCard, nextCard } from './next-card'
import { Done } from './progress'
import type * as Season from './season'
import { LESSONS } from './season'

/** The card's state, its way on and where that goes. */
const way = (c: NextCard | null): (string | undefined)[] => [
  c?.state,
  c?.label,
  c?.kind,
  c?.href,
]

describe('nextCard', () => {
  it("names the lesson after this page's and starts it at its page's top", () => {
    // Act: on Lesson 1's page, nothing done
    const c = nextCard(LESSONS, [], {}, 1)

    // Assert
    expect(c).toEqual({
      n: 2,
      title: 'Twelve notes',
      hook: 'Musicians only use seven letters, so where do the other five notes come from?',
      state: 'Ready · 10 min',
      label: 'Start lesson',
      kind: 'start',
      href: '/learn/02',
    })
  })

  it('continues at the step the viewer reached', () => {
    // Act: Lesson 2 left at step 3 of 6
    const c = nextCard(LESSONS, [1], { 2: { step: 3, of: 6 } }, 1)

    // Assert
    expect(way(c)).toEqual([
      'Step 3 of 6',
      'Continue: step 3',
      'continue',
      '/learn/02#step-3',
    ])
  })

  it('reads a lesson done again, from the top', () => {
    // Act: Lesson 2 done
    const c = nextCard(LESSONS, [1, 2], {}, 1)

    // Assert
    expect(way(c)).toEqual([
      'Done · 10 min',
      'Read again',
      'again',
      '/learn/02',
    ])
  })

  it('opens the map on a lesson coming later, with no page to link', () => {
    // Act: on Lesson 5's page, Lesson 6 not written yet
    const c = nextCard(LESSONS, [], {}, 5)

    // Assert
    expect([c?.n, c?.title, ...way(c)]).toEqual([
      6,
      'Intervals: the distance between notes',
      'Coming later',
      'See it on the map',
      'map',
      '#explorer',
    ])
  })

  it("draws no card after the season's last lesson", () => {
    // Arrange
    const last = Math.max(...LESSONS.map((L) => L.n))

    // Act
    const c = nextCard(LESSONS, [], {}, last)

    // Assert
    expect(c).toBeNull()
  })
})

describe('a hidden draft (drafts.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('is coming later with no link to its page, even with a step the viewer reached while it was shown', async () => {
    // Arrange: a build that hides drafts, and a step kept from a dev visit
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const season: typeof Season = await import('./season')
    const card: typeof Card = await import('./next-card')

    // Act: on Lesson 2's page, the card for Lesson 3
    const c = card.nextCard(season.LESSONS, [1], { 3: { step: 3, of: 6 } }, 2)

    // Assert
    expect([c?.n, c?.title, ...way(c)]).toEqual([
      3,
      'Match a note',
      'Coming later',
      'See it on the map',
      'map',
      '#explorer',
    ])
    expect(JSON.stringify(c)).not.toContain('/learn/03')
  })
})

describe('createNextCard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it('draws the card in place of the mark, keeping what the mark held after its words', () => {
    // Arrange: Lesson 2's Wrap, its two figures in the mark
    document.body.innerHTML =
      '<div class="next-card card l2-next" data-next-card hidden><div class="tease">59 %</div></div>'

    // Act
    createNextCard(2)

    // Assert
    const card = document.querySelector<HTMLAnchorElement>('[data-next-card]')
    expect([
      card?.tagName,
      card?.className,
      card?.hidden,
      card?.getAttribute('href'),
      card?.dataset.nextCard,
    ]).toEqual(['A', 'next-card card l2-next', false, '/learn/03', '3'])
    expect(
      ['.eyebrow', '.q2', '.chip'].map(
        (s) => card?.querySelector(s)?.textContent,
      ),
    ).toEqual([
      'Next lesson 03 · Match a note Ready · 15 min',
      LESSONS.find((L) => L.n === 3)?.hook,
      'Start lesson',
    ])
    expect(Array.from(card?.children ?? []).map((e) => e.className)).toEqual([
      'next-words',
      'tease',
    ])
  })

  it('redraws the same card as the lesson is marked done', () => {
    // Arrange
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    createNextCard(1)
    const card = document.querySelector<HTMLAnchorElement>('a.next-card')

    // Act
    Done.set(2, true)

    // Assert: one card, the one the explorer may have bound, read again
    expect(document.querySelector('a.next-card')).toBe(card)
    expect([
      card?.querySelector('.tempo')?.textContent,
      card?.querySelector('.chip')?.textContent,
      card?.classList.contains('is-again'),
      card?.getAttribute('href'),
    ]).toEqual(['Done · 10 min', 'Read again', true, '/learn/02'])
  })

  it("links a lesson coming later to the map, as the explorer's lesson link", () => {
    // Arrange
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'

    // Act: on Lesson 5's page
    createNextCard(5)

    // Assert
    const card = document.querySelector<HTMLAnchorElement>('a.next-card')
    expect([
      card?.getAttribute('href'),
      card?.dataset.selectLesson,
      card?.classList.contains('is-later'),
      card?.querySelector('.tempo')?.textContent,
      card?.querySelector('.chip')?.textContent,
    ]).toEqual(['#explorer', '6', true, 'Coming later', 'See it on the map'])
  })

  it("leaves the mark hidden after the season's last lesson", () => {
    // Arrange
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    const last = Math.max(...LESSONS.map((L) => L.n))

    // Act
    createNextCard(last)

    // Assert
    const mark = document.querySelector<HTMLElement>('[data-next-card]')
    expect([mark?.tagName, mark?.hidden]).toEqual(['DIV', true])
  })
})
