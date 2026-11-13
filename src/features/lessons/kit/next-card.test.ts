// ============================================================
// Next-lesson card tests — the Wrap's card in each state, and on the page
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { VisitEnding } from './comfort'
import { SEASON_END } from './lesson-copy'
import type * as Card from './next-card'
import type { NextCard, SeasonEnd } from './next-card'
import { createNextCard, nextCard } from './next-card'
import { Done } from './progress'
import { defaultPageState, seasonFor } from './publish'
import { LESSONS } from './season'
import { withNoPage } from './season.test-fixtures'
import { LESSONS_2, SEASON_2 } from './season-2'
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
      state: 'Ready · 13 min',
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
      'Done · 13 min',
      'Read again',
      'again',
      '/learn/02',
    ])
  })

  it('opens the map on a lesson coming later, with no page to link', () =>
    // Arrange: a lesson not written yet
    withNoPage((later) => {
      // Act: on the page of the lesson before it
      const c = lessonCard(nextCard(LESSONS, [], {}, later.n - 1))

      // Assert
      expect([c?.n, c?.title, ...way(c)]).toEqual([
        later.n,
        later.title,
        'Coming later',
        'See it on the map',
        'map',
        '#explorer',
      ])
    }))

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
      rest: "You've seen every note you sing.",
      song: { label: 'Karaoke Night', href: '/karaoke-night?lesson=14' },
      map: { label: 'See the season map', href: '#explorer' },
    })
  })

  it("closes Season 1 on Lesson 14's page even where Season 2's lessons follow it", () => {
    // Act: one list holding both seasons, as a page carrying both reads it
    const c = nextCard([...LESSONS, ...LESSONS_2], [], {}, 14)

    // Assert: Season 1's close, never Lesson 15's card
    expect(c?.kind).toBe('end')
    expect(c?.kind === 'end' ? c.eyebrow : null).toBe('End of Season 1')
  })

  it("closes Season 2 on Lesson 28's page in its own words, its song marked with 28", () => {
    // Act
    const c = nextCard(LESSONS_2, [], {}, 28, SEASON_2)

    // Assert
    expect(c).toEqual({
      kind: 'end',
      eyebrow: 'End of Season 2',
      line: "You've read a song in two parts. Now sing a whole song.",
      rest: "You've read a song in two parts.",
      song: { label: 'Karaoke Night', href: '/karaoke-night?lesson=28' },
      map: { label: 'See the season map', href: '#explorer' },
    })
  })

  it("names Lesson 28 on Lesson 27's page, coming later on the map", () => {
    // Act
    const c = lessonCard(nextCard(LESSONS_2, [], {}, 27, SEASON_2))

    // Assert
    expect([c?.n, c?.title, c?.state, c?.kind, c?.href]).toEqual([
      28,
      'Cadences, form and a song in two parts',
      'Coming later',
      'map',
      '#explorer',
    ])
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

    // Act: on Lesson 4's page, the card for Lesson 5, a draft
    const c = lessonCard(
      nextCard(season, [1, 2, 3], { 5: { step: 3, of: 6 } }, 4),
    )

    // Assert
    expect([c?.n, c?.title, ...way(c)]).toEqual([
      5,
      'Breath and a steady note',
      'Coming later',
      'See it on the map',
      'map',
      '#explorer',
    ])
    expect(JSON.stringify(c)).not.toContain('/learn/05')
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
    VisitEnding.set('practise')
  })

  it("keeps the close's answer and the map, and drops the song, while the visit ends in rest", () => {
    // Arrange: the finale's Wrap
    document.body.innerHTML =
      '<div class="next-card card l14-next" data-next-card hidden><figure class="end-still"></figure></div>'
    const ways = (): (string | null)[][] =>
      Array.from(document.querySelectorAll('[data-next-card] a')).map((a) => [
        a.textContent,
        a.getAttribute('href'),
      ])
    const line = (): string | null | undefined =>
      document.querySelector('[data-next-card] .end-line')?.textContent

    // Act: Sing it ends in rest after the card is drawn
    createNextCard(LAST, VisitEnding)
    VisitEnding.set('rest')

    // Assert
    expect(line()).toBe("You've seen every note you sing.")
    expect(ways()).toEqual([['See the season map', '#explorer']])
    expect(
      Array.from(
        document.querySelector('[data-next-card]')?.children ?? [],
      ).map((e) => e.className),
    ).toEqual(['next-words', 'end-still'])

    // Act: a later ending that sings again
    VisitEnding.set('practise')

    // Assert
    expect(line()).toBe(SEASON_END.line)
    expect(ways()).toEqual([
      ['Karaoke Night', '/karaoke-night?lesson=14'],
      ['See the season map', '#explorer'],
    ])
  })

  it('draws a rest close at once on a page whose visit already ended in rest', () => {
    // Arrange
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    VisitEnding.set('rest')

    // Act
    createNextCard(LAST, VisitEnding)

    // Assert
    const card = document.querySelector<HTMLElement>('[data-next-card]')
    expect(card?.querySelector('.end-line')?.textContent).toBe(SEASON_END.rest)
    expect(card?.dataset.ending).toBe('rest')
    expect(card?.querySelector('a.btn.primary')).toBeNull()
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
      'Next lesson 03 · Match a note Ready · 16 min',
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
      ['eyebrow', 'Next lesson 02 · Twelve notes Ready · 13 min'],
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
    ]).toEqual(['Done · 13 min', 'Read again', true, '/learn/02'])
  })

  it("links a lesson coming later to the map, as the explorer's lesson link", () =>
    // Arrange: a lesson not written yet
    withNoPage(({ n: later }) => {
      document.body.innerHTML =
        '<div class="next-card card" data-next-card hidden></div>'

      // Act: on the page of the lesson before it
      createNextCard(later - 1)

      // Assert
      const card = document.querySelector<HTMLAnchorElement>('a.next-card')
      expect([
        card?.getAttribute('href'),
        card?.dataset.selectLesson,
        card?.classList.contains('is-later'),
        card?.querySelector('.tempo')?.textContent,
        card?.querySelector('.chip')?.textContent,
      ]).toEqual([
        '#explorer',
        String(later),
        true,
        'Coming later',
        'See it on the map',
      ])
    }))

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

describe('createNextCard on a Season 2 page (page-state.ts carrySeason)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  afterEach(() => {
    document.body.textContent = ''
  })

  it("closes Season 2 on Lesson 28's page, links Lesson 26 from Lesson 25's and Lesson 27 from Lesson 26's, and names Lesson 28, still coming, on Lesson 27's", async () => {
    // Arrange: fresh modules, so the season carried here stays in this test
    const page = await import('./page-state')
    const card: typeof Card = await import('./next-card')
    const season2 = await import('./season-2')
    page.carrySeason(season2.SEASON_2)
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'

    // Act
    card.createNextCard(28)

    // Assert
    const end = document.querySelector<HTMLElement>('[data-next-card]')
    expect(end?.dataset.nextCard).toBe('end')
    expect(end?.querySelector('.eyebrow')?.textContent).toBe('End of Season 2')
    expect(end?.querySelector('a.btn.primary')?.getAttribute('href')).toBe(
      '/karaoke-night?lesson=28',
    )

    // Act: Lesson 25's Wrap
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    card.createNextCard(25)

    // Assert: Lesson 26's page, a draft this build shows, is a link
    const next = document.querySelector<HTMLElement>('[data-next-card]')
    expect(next?.dataset.nextCard).toBe('26')
    expect(next?.dataset.selectLesson).toBeUndefined()
    expect(next?.getAttribute('href')).toBe('/learn/26')

    // Act: Lesson 26's Wrap
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    card.createNextCard(26)

    // Assert: and so is Lesson 27's
    const after = document.querySelector<HTMLElement>('[data-next-card]')
    expect(after?.dataset.nextCard).toBe('27')
    expect(after?.dataset.selectLesson).toBeUndefined()
    expect(after?.getAttribute('href')).toBe('/learn/27')

    // Act: Lesson 27's Wrap
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'
    card.createNextCard(27)

    // Assert
    const last = document.querySelector<HTMLElement>('[data-next-card]')
    expect(last?.dataset.nextCard).toBe('28')
    expect(last?.dataset.selectLesson).toBe('28')
  })

  it("closes Season 1 on Lesson 14's page of a build that carries Season 2", async () => {
    // Arrange
    const page = await import('./page-state')
    const card: typeof Card = await import('./next-card')
    const season2 = await import('./season-2')
    page.carrySeason(season2.SEASON_2)
    document.body.innerHTML =
      '<div class="next-card card" data-next-card hidden></div>'

    // Act
    card.createNextCard(14)

    // Assert
    const end = document.querySelector<HTMLElement>('[data-next-card]')
    expect(end?.dataset.nextCard).toBe('end')
    expect(end?.querySelector('.eyebrow')?.textContent).toBe('End of Season 1')
  })
})
