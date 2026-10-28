// ============================================================
// Lesson explorer tests — a card's links from any lesson's page
// ============================================================
//
// And the explorer on the page's frame loop: Lesson 13's plate shakes its
// sand every frame while motion plays; held still, it paints once for each
// change, and a card with no plate asks for no frame at all.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type { Explorer } from './explorer'
import { cardActions, createExplorer } from './explorer'
import { filmSources } from './films'
import type { HandLoop } from './frame-loop.test-fixtures'
import { handLoop } from './frame-loop.test-fixtures'
import type { LessonView } from './lesson-state'
import { lessonViews } from './lesson-state'
import type { Motion } from './motion-switch'
import type { StepMarks } from './position'
import { Positions } from './position'
import { Done } from './progress'
import type { Lesson } from './season'
import { LESSONS, TOPICS } from './season'
import { lessonWithNoPage } from './season.test-fixtures'
import { TEAM_STRINGS } from './team-notes.test-fixtures'

/** A lesson for a card test, live or coming later as `extra` makes it. */
const lesson = (extra: Partial<Lesson> = {}): Lesson => ({
  n: 9,
  lane: 'theory',
  title: 'Lesson nine',
  short: 'Nine',
  topics: [],
  hook: 'Why?',
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

/** Where lesson `n`'s card sends Watch from `at`: nowhere until its film has sources. */
const watchFrom = (at: string, n = 1): string[] =>
  filmSources(n) === null ? [] : [`${at}#watch`]

/** Lesson 2's Watch action on a card on another page, as `actions` reads it: none until its film has sources. */
const watchTwo = (): [string, string | null, boolean][] =>
  watchFrom('/learn/02', 2).map((href) => ['Watch the episode', href, false])

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
  vi.useRealTimers()
  vi.restoreAllMocks()
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

    // Assert: its episode beside it once its film has sources
    expect(fromOne).toEqual([
      ['Continue: step 3', '/learn/02#step-3', true],
      ...watchTwo(),
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
      ...watchTwo(),
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

  it("draws no team note or signature on any lesson's card", () => {
    // Arrange: each lesson's signature and why each variant exists (team-notes.ts)
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    for (const L of LESSONS) {
      // Act
      explorer.select(L.n, false)

      // Assert
      const text = openCard()?.textContent ?? ''
      expect(text, `lesson ${L.n}`).toContain(L.hook)
      for (const [what, team] of TEAM_STRINGS)
        expect(text.includes(team), `lesson ${L.n}: ${what}`).toBe(false)
    }
    expect(TEAM_STRINGS.length).toBeGreaterThan(0)
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
    expect(before).toBe('8 min')
    expect(cardRows().Length).toBe('8 min · film 5:14')
  })

  it('draws a lesson coming later without a Length row', () => {
    // Arrange
    const later = lessonWithNoPage()
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    // Act
    explorer.select(later.n, false)

    // Assert
    const rows = Object.keys(cardRows())
    expect(rows).toContain('Builds on')
    expect(rows).not.toContain('Length')
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Coming later')
  })

  it('draws a lesson with no drill to link without a Practise row', () => {
    // Arrange: any lesson with no drill to link yet
    const bare = LESSONS.find((L) => L.n > 0 && L.pr.link === undefined)
    if (bare === undefined)
      throw new Error('Every lesson links a drill now: retire this test')
    explorerPage()
    const explorer = createExplorer({ current: 1 })

    // Act
    explorer.select(bare.n, false)

    // Assert
    const rows = Object.keys(cardRows())
    expect(rows).toContain('Builds on')
    expect(rows).not.toContain('Practise')
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
    expect(continued).toEqual([
      '/learn/02#step-4',
      ...watchFrom('/learn/02', 2),
    ])
    expect(cardLinks()).toEqual(['/learn/02', ...watchFrom('/learn/02', 2)])
    expect(openCard()?.querySelector('a.btn')?.textContent).toBe('Read again')
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Done')
  })

  it('keeps the keyboard on Mark as done when the card is rebuilt around it', () => {
    // Arrange: Lesson 1's own card, the keyboard on its toggle
    explorerPage()
    createExplorer({ current: 1 })
    const toggle = document.querySelector<HTMLButtonElement>(
      '#exCardHost [data-done="1"]',
    )
    toggle?.focus()

    // Act
    toggle?.click()

    // Assert: the new card's toggle, pressed, has focus; never the page
    const now = document.activeElement
    expect(now).not.toBe(document.body)
    expect(now?.getAttribute('data-done')).toBe('1')
    expect(now?.getAttribute('aria-pressed')).toBe('true')
  })

  it("sends the keyboard to the opened lesson's title after an Opens link", () => {
    // Arrange: Lesson 1's card opens Lesson 2; jsdom cannot scroll to it
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    explorerPage()
    createExplorer({ current: 1 })
    const opens = document.querySelector<HTMLButtonElement>(
      '#exCardHost [data-go="2"]',
    )
    opens?.focus()

    // Act
    opens?.click()

    // Assert
    const now = document.activeElement
    expect(now?.tagName).toBe('H3')
    expect(now?.textContent).toBe(LESSONS[2].title)
    expect(now?.closest('.ex-card')?.getAttribute('data-card')).toBe('2')
  })

  it('says a card an Opens link focuses once, by its title, and a card the list opens on the status line', () => {
    // Arrange: Lesson 1's card opens Lesson 2; jsdom cannot scroll to it
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    explorerPage()
    createExplorer({ current: 1 })
    const status = (): string =>
      document.getElementById('exStatus')?.textContent ?? ''
    const opens = document.querySelector<HTMLButtonElement>(
      '#exCardHost [data-go="2"]',
    )
    opens?.focus()

    // Act: the Opens link
    opens?.click()
    const linked = { focus: document.activeElement?.tagName, said: status() }

    // Act: Lesson 3 from the list, the keyboard on its row
    const row = document.querySelector<HTMLButtonElement>(
      '#exList [data-n="3"] .it',
    )
    row?.focus()
    row?.click()

    // Assert
    expect(linked.focus).toBe('H3')
    expect(linked.said).not.toContain('card below')
    expect(status()).toBe(`Lesson 3, ${LESSONS[3].title}: card below`)
  })

  it('empties the status line when a link follows a card the list opened', () => {
    // Arrange: Lesson 3 from the list, so the line names its card
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    explorerPage()
    createExplorer({ current: 1 })
    const status = (): string =>
      document.getElementById('exStatus')?.textContent ?? ''
    const row = document.querySelector<HTMLButtonElement>(
      '#exList [data-n="3"] .it',
    )
    row?.focus()
    row?.click()
    const listed = status()
    const link = document.querySelector<HTMLButtonElement>(
      '#exCardHost [data-go]',
    )
    link?.focus()

    // Act: a Builds on or Opens link on Lesson 3's card
    link?.click()

    // Assert
    expect(listed).toBe(`Lesson 3, ${LESSONS[3].title}: card below`)
    expect(link).not.toBeNull()
    expect(document.activeElement?.tagName).toBe('H3')
    expect(status()).toBe('')
  })
})

// A page no worker served (`pnpm dev`, the e2e bundle) carries no state, so
// its map reads drafts as its build does (page-state.ts).
describe("a draft lesson on Lesson 1's map, on a page no worker served (drafts.ts)", () => {
  /** Lesson 1's explorer as a build with drafts shown ("1") or held back ("0") draws it, Lesson 3 selected. */
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

  it('shows a draft held back as coming later, with no link to its page', async () => {
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

  it('treats Lesson 10, a draft too, the same way either side of the switch, its ear drill kept', async () => {
    // Arrange
    const lessonTen = async (drafts: '1' | '0'): Promise<Element | null> => {
      vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
      vi.resetModules()
      const { createExplorer: explorerBuilt } = await import('./explorer')
      explorerPage()
      explorerBuilt({ current: 1 }).select(10, false)
      return document.querySelector('#exCardHost .ex-card')
    }

    // Act
    const shown = await lessonTen('1')
    const shownLinks = cardLinks()
    const hidden = await lessonTen('0')

    // Assert: to read where drafts show; coming later, and nothing to the page, where they do not
    expect(shown?.querySelector('h3')?.textContent).toBe('Major and minor')
    expect(shownLinks).toEqual(['/learn/10'])
    expect(hidden?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(hidden?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(hidden?.innerHTML).not.toContain('/learn/10')
    expect(hidden?.innerHTML).toContain('/ear-lab?lesson=10')
  })

  it('treats Lesson 12, a draft too, the same way either side of the switch, its ear drill kept', async () => {
    // Arrange
    const lessonTwelve = async (drafts: '1' | '0'): Promise<Element | null> => {
      vi.stubEnv('VITE_DRAFT_LESSONS', drafts)
      vi.resetModules()
      const { createExplorer: explorerBuilt } = await import('./explorer')
      explorerPage()
      explorerBuilt({ current: 1 }).select(12, false)
      return document.querySelector('#exCardHost .ex-card')
    }

    // Act
    const shown = await lessonTwelve('1')
    const shownLinks = cardLinks()
    const hidden = await lessonTwelve('0')

    // Assert: to read where drafts show; coming later, and nothing to the page, where they do not (WEB-SPEC, Tests 12)
    expect(shown?.querySelector('h3')?.textContent).toBe(
      'Chords and the four-chord song',
    )
    expect(shownLinks).toEqual(['/learn/12'])
    expect(hidden?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(hidden?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(hidden?.innerHTML).not.toContain('/learn/12')
    expect(
      hidden?.querySelector('a.addr[href="/ear-lab?lesson=12"]'),
    ).not.toBeNull()
    expect(hidden?.textContent).toContain('Ear Lab, then tap Cadence')
  })
})

describe("Lesson 1's map on a page the worker served (page-state.ts)", () => {
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

  afterEach(() => {
    document.head.querySelector('#lesson-state')?.remove()
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('links a draft the state publishes, where its build holds drafts back', async () => {
    // Arrange: a production bundle, and Lesson 3 published from the console
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const { createExplorer: explorerBuilt } = await import('./explorer')
    served({ 3: { published: true } })
    explorerPage()

    // Act
    explorerBuilt({ current: 1 }).select(3, false)

    // Assert
    expect(openCard()?.querySelector('.chip')?.textContent).toBe('Ready · read')
    expect(cardLinks()).toEqual(['/learn/03'])
  })

  it('shows a released lesson the state holds back as coming later, with no link', () => {
    // Arrange: Lesson 2 held back
    served({ 2: { published: false } }, true)
    explorerPage()

    // Act
    createExplorer({ current: 1 }).select(2, false)

    // Assert
    const card = openCard()
    expect(card?.querySelector('h3')?.textContent).toBe('Twelve notes')
    expect(card?.querySelector('.chip')?.textContent).toBe('Coming later')
    expect(card?.querySelectorAll('a.btn, [data-done]')).toHaveLength(0)
    expect(document.getElementById('exCardHost')?.innerHTML).not.toContain(
      '/learn/02',
    )
  })

  it('draws the hook the console picked on its card', () => {
    // Arrange: Lesson 3's figures, the hook it opened on before
    served({ 3: { hook: 'figures' } }, true)
    explorerPage()

    // Act
    createExplorer({ current: 1 }).select(3, false)

    // Assert
    expect(openCard()?.querySelector('.hookq')?.textContent).toBe(
      LESSONS[3].hookAlts?.[0]?.text,
    )
  })
})

describe("the explorer on the page's frame loop", () => {
  /** The explorer on Lesson 1's page, its card on screen, settled; under reduced motion unless `reduce` is false. */
  async function settledExplorer(reduce = true): Promise<
    HandLoop & {
      explorer: Explorer
      motion: typeof Motion
      /** Selects Lesson 13, whose card shows the plate, and counts the plate's paints. */
      plate(): { canvas: HTMLCanvasElement; painted: () => number }
    }
  > {
    const hand = await handLoop(reduce)
    const { createExplorer: create } = await import('./explorer')
    const { Motion: motion } = await import('./motion-switch')
    explorerPage()
    const explorer = create({ current: 1 })
    const host = document.querySelector('#exCardHost')
    if (host === null) throw new Error('no card host')
    hand.see(host)
    hand.settle()
    return {
      ...hand,
      explorer,
      motion,
      plate() {
        explorer.select(13, false)
        const canvas = document.querySelector<HTMLCanvasElement>(
          '#exCardHost .plate canvas',
        )
        if (canvas === null) throw new Error('no plate')
        return { canvas, painted: hand.paints(canvas) }
      },
    }
  }

  it('asks for no frame on a card with no plate', async () => {
    // Arrange + Act
    const { asked } = await settledExplorer()

    // Assert
    expect(asked).toHaveLength(0)
  })

  it('paints a still plate once, then asks for none, and paints nothing in a frame another drawer asks for', async () => {
    // Arrange: reduced motion holds the sand still
    const { asked, loop, plate, settle } = await settledExplorer()

    // Act
    const { painted } = plate()
    settle()
    const first = painted()
    loop.wake()
    settle()

    // Assert
    expect(first).toBe(1)
    expect(painted()).toBe(1)
    expect(asked).toHaveLength(0)
  })

  it('paints a still plate once for each change: a new size, a new pixel ratio, a pixel ratio that changed with no word of it', async () => {
    // Arrange
    const { asked, loop, plate, resize, settle, zoom } = await settledExplorer()
    const { canvas, painted } = plate()
    settle()
    const ratio = window.devicePixelRatio
    const changes: (() => void)[] = [
      () => resize(canvas),
      zoom,
      () => {
        vi.stubGlobal('devicePixelRatio', 2)
        loop.wake()
      },
    ]

    // Act
    const each = changes.map((change) => {
      const before = painted()
      change()
      settle()
      return painted() - before
    })
    vi.stubGlobal('devicePixelRatio', ratio)

    // Assert
    expect(each).toEqual([1, 1, 1])
    expect(asked).toHaveLength(0)
  })

  it('shakes the sand every frame while motion plays, and rests once motion is paused or reduced, or the plate goes', async () => {
    // Arrange: no reduced motion, and nothing paused
    const { asked, explorer, motion, plate, reduceMotion, settle } =
      await settledExplorer(false)
    const { painted } = plate()

    // Act
    const shaking = settle(100)
    const stillAsking = asked.length
    motion.set(true)
    const paused = settle()
    motion.set(false)
    const resumed = settle(100)
    reduceMotion(true)
    const reduced = settle()
    explorer.select(2, false)
    const gone = settle()

    // Assert: a plate held still draws one last frame; another card has none
    expect([shaking, stillAsking]).toEqual([100, 1])
    expect([paused, resumed, reduced, gone]).toEqual([1, 100, 1, 1])
    expect(painted()).toBe(202)
    expect(asked).toHaveLength(0)
  })

  it('rests once a phone folds the card away, and shakes the sand again once its row opens it', async () => {
    // Arrange: a phone, where the card opens in the list under its row;
    // motion plays, and the list is on screen
    const { asked, paints, see, settle } = await handLoop(false)
    const media = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        (query === '(max-width: 860px)'
          ? { ...media(query), matches: true }
          : media(query)) as MediaQueryList,
    )
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
    const { createExplorer: create } = await import('./explorer')
    explorerPage()
    const explorer = create({ current: 1 })
    const list = document.querySelector('#exList')
    if (list === null) throw new Error('no list')
    see(list)
    settle()
    const plateNow = (): HTMLCanvasElement | null =>
      document.querySelector('#exList .ex-detail .plate canvas')
    const tapRow = (): void =>
      document
        .querySelector<HTMLButtonElement>('#exList [data-n="13"] button.it')
        ?.click()
    explorer.select(13, false)
    const plate = plateNow()
    if (plate === null) throw new Error('no plate')
    const painted = paints(plate)
    const shaking = settle(100)
    const shakingAsks = asked.length

    // Act: a second tap on Lesson 13's open row, then a third
    tapRow()
    const folded = document.querySelectorAll('#exList .ex-detail').length
    const toRest = settle()
    const foldedAsks = asked.length
    const foldedPaints = painted()
    tapRow()
    const back = plateNow()
    const paintedBack = back === null ? () => 0 : paints(back)
    const again = settle(100)

    // Assert: the fold takes the plate off the page, and its frames with it
    expect([shaking, shakingAsks, foldedPaints]).toEqual([100, 1, 100])
    expect(folded).toBe(0)
    expect(toRest).toBeLessThanOrEqual(2)
    expect(foldedAsks).toBe(0)
    expect(painted()).toBe(100)
    expect(back).not.toBeNull()
    expect([again, paintedBack()]).toEqual([100, 100])
    expect(asked).toHaveLength(1)
  })
})
