// ============================================================
// Next-lesson card tests — the Wrap's card in each state, and on the page
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { SEASON_END } from './lesson-copy'
import type * as Card from './next-card'
import type { NextCard, SeasonEnd } from './next-card'
import { createNextCard, nextCard } from './next-card'
import { Done } from './progress'
import { defaultPageState, seasonFor } from './publish'
import { LESSONS } from './season'
import { TEAM_STRINGS } from './team-notes.test-fixtures'

/** The card for a lesson, never the season's close. */
function lessonCard(c: NextCard | SeasonEnd | null): NextCard | null {
  if (c?.kind === 'end') throw new Error('the season closed early')
  return c
}

/** The card's state, its way on and where that goes. */
const way = (c: NextCard | SeasonEnd | null): (string | undefined)[] => {
  const card = lessonCard(c)
  return [card?.state, card?.label, card?.kind, card?.href]
}

/** The season's last lesson. */
const LAST = Math.max(...LESSONS.map((L) => L.n))

describe('nextCard', () => {
  it("names the lesson after this page's and starts it at its page's top", () => {
    // Act: on Lesson 1's page, nothing done
    const c = nextCard(LESSONS, [], {}, 1)

    // Assert
    expect(c).toEqual({
      n: 2,
      title: 'Twelve notes',
      tease: 'Seven letters, but twelve notes.',
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
    // Act: on Lesson 8's page, Lesson 9 not written yet
    const c = lessonCard(nextCard(LESSONS, [], {}, 8))

    // Assert
    expect([c?.n, c?.title, ...way(c)]).toEqual([
      9,
      'Landing a leap',
      'Coming later',
      'See it on the map',
      'map',
      '#explorer',
    ])
  })

  it("gives a lesson with no tease none: Lesson 3, whose figures are on Lesson 2's card", () => {
    // Act
    const c = lessonCard(nextCard(LESSONS, [], {}, 2))

    // Assert
    expect([c?.n, c?.tease]).toEqual([3, null])
  })

  it("closes the season after its last lesson: the trailer's question answered, a whole song and the map", () => {
    // Act
    const c = nextCard(LESSONS, [], {}, LAST)

    // Assert
    expect(c).toEqual({
      kind: 'end',
      eyebrow: 'End of Season 1',
      line: "You've seen every note you sing. Now sing a whole song.",
      song: { label: 'Karaoke Night', href: '/karaoke-night?lesson=14' },
      map: { label: 'See the season map', href: '#explorer' },
    })
  })

  it("marks the song's link with the finale's number, as the finale's own practise link is", () => {
    // Act
    const c = nextCard(LESSONS, [], {}, LAST)

    // Assert
    expect(c?.kind === 'end' ? c.song.href : null).toBe(
      LESSONS[LAST].pr.link?.href,
    )
  })

  it('draws no card for a lesson the season does not have', () => {
    // Act
    const c = nextCard(LESSONS, [], {}, LAST + 1)

    // Assert
    expect(c).toBeNull()
  })
})

describe('a lesson held back (publish.ts)', () => {
  it('is coming later with no link to its page, even with a step the viewer reached while it was shown', () => {
    // Arrange: drafts held back, as on mercurypitch.com, and a step kept from a dev visit
    const season = seasonFor(LESSONS, defaultPageState(false))

    // Act: on Lesson 2's page, the card for Lesson 3
    const c = lessonCard(nextCard(season, [1], { 3: { step: 3, of: 6 } }, 2))

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

describe('createNextCard on a page the worker served (page-state.ts)', () => {
  /** The page's state, as the site worker writes it into the head. */
  function served(lessons: object, drafts = false): void {
    const tag = document.createElement('script')
    tag.type = 'application/json'
    tag.id = 'lesson-state'
    tag.textContent = JSON.stringify({
      version: 1,
      updatedAt: null,
      lessons,
      drafts,
    })
    document.head.append(tag)
  }

  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
  })

  afterEach(() => {
    document.head.querySelector('#lesson-state')?.remove()
    document.body.textContent = ''
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('links a draft the state publishes, where its build holds drafts back', async () => {
    // Arrange: a production bundle, and Lesson 3 published from the console
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const built: typeof Card = await import('./next-card')
    served({ 3: { published: true } })

    // Act: Lesson 2's Wrap
    built.createNextCard(2)

    // Assert
    const card = document.querySelector<HTMLAnchorElement>('a.next-card')
    expect([
      card?.getAttribute('href'),
      card?.querySelector('.chip')?.textContent,
    ]).toEqual(['/learn/03', 'Start lesson'])
  })

  it('shows a released lesson the state holds back as coming later, on the map', () => {
    // Arrange: Lesson 2 held back
    served({ 2: { published: false } }, true)

    // Act: Lesson 1's Wrap
    createNextCard(1)

    // Assert
    const card = document.querySelector<HTMLAnchorElement>('a.next-card')
    expect([
      card?.getAttribute('href'),
      card?.classList.contains('is-later'),
      card?.querySelector('.tempo')?.textContent,
    ]).toEqual(['#explorer', true, 'Coming later'])
    expect(card?.outerHTML).not.toContain('/learn/02')
  })

  it('draws the hook the console picked, and the default tease for an id the lesson lacks', () => {
    // Arrange: on Lesson 2's Wrap, Lesson 3's card; on Lesson 3's, Lesson 4's
    served({ 3: { hook: 'figures' }, 4: { tease: 'gone' } }, true)

    // Act
    createNextCard(2)
    const hook = document.querySelector('a.next-card .q2')?.textContent
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    createNextCard(3)
    const tease = document.querySelector('a.next-card .next-tease')?.textContent

    // Assert
    expect(hook).toBe(LESSONS[3].hookAlts?.[0]?.text)
    expect(tease).toBe(LESSONS[4].tease)
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
    expect(card?.querySelector('.next-tease')).toBeNull()
  })

  it("draws the next lesson's tease between its eyebrow and its hook", () => {
    // Arrange: Lesson 1's Wrap
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'

    // Act
    createNextCard(1)

    // Assert
    const words = document.querySelector('a.next-card .next-words')
    expect(
      Array.from(words?.children ?? []).map((e) => [
        e.className,
        e.textContent,
      ]),
    ).toEqual([
      ['eyebrow', 'Next lesson 02 · Twelve notes Ready · 10 min'],
      ['next-tease', LESSONS[2].tease],
      ['q2', LESSONS[2].hook],
      ['chip', 'Start lesson'],
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

    // Act: on Lesson 8's page
    createNextCard(8)

    // Assert
    const card = document.querySelector<HTMLAnchorElement>('a.next-card')
    expect([
      card?.getAttribute('href'),
      card?.dataset.selectLesson,
      card?.classList.contains('is-later'),
      card?.querySelector('.tempo')?.textContent,
      card?.querySelector('.chip')?.textContent,
    ]).toEqual(['#explorer', '9', true, 'Coming later', 'See it on the map'])
  })

  it("closes the season on its last lesson's page: no link itself, its two ways on links", () => {
    // Arrange: the finale's Wrap, a figure in the mark
    document.body.innerHTML =
      '<div class="next-card card l14-next" data-next-card hidden><figure class="end-still"></figure></div>'

    // Act
    createNextCard(LAST)

    // Assert
    const card = document.querySelector<HTMLElement>('[data-next-card]')
    expect([
      card?.tagName,
      card?.className,
      card?.hidden,
      card?.dataset.nextCard,
    ]).toEqual(['DIV', 'next-card card l14-next is-end', false, 'end'])
    expect(card?.querySelector('.end-line')?.textContent).toBe(SEASON_END.line)
    expect(
      Array.from(card?.querySelectorAll('a') ?? []).map((a) => [
        a.textContent,
        a.getAttribute('href'),
        a.getAttribute('target'),
      ]),
    ).toEqual([
      ['Karaoke Night', '/karaoke-night?lesson=14', '_blank'],
      ['See the season map', '#explorer', null],
    ])
    expect(Array.from(card?.children ?? []).map((e) => e.className)).toEqual([
      'next-words',
      'end-still',
    ])
  })

  it("draws none of the team's notes or signatures on any lesson's card", () => {
    // Arrange: every string team-notes.ts holds
    expect(TEAM_STRINGS.length).toBeGreaterThan(0)

    for (const L of LESSONS) {
      document.body.innerHTML =
        '<div class="next-card card" data-next-card hidden></div>'

      // Act
      createNextCard(L.n)

      // Assert
      const text = document.body.textContent ?? ''
      expect(text, `lesson ${L.n}`).not.toBe('')
      for (const [what, team] of TEAM_STRINGS)
        expect(text.includes(team), `lesson ${L.n}: ${what}`).toBe(false)
    }
  })
})
