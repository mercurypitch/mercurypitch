// ============================================================
// Lesson menu tests — every lesson's row, and where the viewer is on this page
// ============================================================

import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as Menu from './lesson-menu'
import type { DeckNow, MenuModel, MenuRow } from './lesson-menu'
import { menuMarkup, menuModel } from './lesson-menu'
import { defaultPageState, seasonFor } from './publish'
import { LESSONS } from './season'
import { lessonWithNoPage } from './season.test-fixtures'
import type { StepDeck } from './step-deck'
import { TOUR_KEY, TOUR_VERSION } from './tour-gate'

/** This page's deck: six steps, the third showing, singing after the last. */
const DECK: DeckNow = {
  now: 3,
  titles: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'],
  after: { label: 'Sing it', href: '#sing' },
}

const rows = (m: MenuModel): MenuRow[] => m.arcs.flatMap((a) => a.rows)

const row = (m: MenuModel, n: number): MenuRow | undefined =>
  rows(m).find((r) => r.n === n)

describe('menuModel', () => {
  it('gives each lesson its state, its right-hand text and where its row goes', () => {
    // Arrange: on Lesson 2's page, Lesson 1 done, Lesson 4 left at step 3
    const kept = { 4: { step: 3, of: 5 } }
    const later = lessonWithNoPage().n

    // Act
    const m = menuModel(LESSONS, [1], kept, 2, DECK)

    // Assert
    expect(
      [1, 2, 3, 4, 5, later].map((n) => {
        const r = row(m, n)
        return [n, r?.state, r?.meta, r?.href]
      }),
    ).toEqual([
      [1, 'done', 'Done · 8 min', '/learn/01'],
      [2, 'here', 'Step 3 of 6', '#top'],
      [3, 'next', 'Up next', '/learn/03'],
      [4, 'progress', 'Step 3 of 5', '/learn/04#step-3'],
      [5, 'ready', 'Ready · 18 min', '/learn/05'],
      [later, 'later', 'Coming later', null],
    ])
  })

  it('says each row as a sentence, so a lesson coming later is never a dead link', () => {
    // Arrange
    const later = lessonWithNoPage()

    // Act
    const m = menuModel(LESSONS, [1], {}, 2, DECK)

    // Assert
    expect([1, 2, 3, later.n].map((n) => row(m, n)?.label)).toEqual([
      'Lesson 1, What is a note?, done, 8 minutes',
      'Lesson 2, Twelve notes, step 3 of 6',
      'Lesson 3, Match a note, up next',
      `Lesson ${later.n}, ${later.title}, coming later`,
    ])
    const hrefs = rows(m)
      .filter((r) => r.state === 'later')
      .map((r) => r.href)
    expect(hrefs).toEqual(
      LESSONS.filter((L) => L.n > 0 && L.page === undefined).map(() => null),
    )
  })

  it('recommends as up next the first lesson ready whose prerequisites are all done', () => {
    // Act: on Lesson 1's page, before and after Lesson 1 is done
    const [before, after] = [[], [1]].map((done) =>
      rows(menuModel(LESSONS, done, {}, 1, DECK))
        .filter((r) => r.state === 'next')
        .map((r) => r.n),
    )

    // Assert: Lessons 2, 3 and 8 all build on Lesson 1, so nothing comes
    // before it, and Lesson 2 is first after it
    expect(before).toEqual([])
    expect(after).toEqual([2])
  })

  it("opens this page's lesson to its steps: reached, showing or ahead, then what follows the last", () => {
    // Arrange: the viewer once reached step 5, and is back at step 3
    const kept = { 2: { step: 5, of: 6 } }

    // Act
    const m = menuModel(LESSONS, [], kept, 2, DECK)

    // Assert
    expect(row(m, 2)?.steps.map((s) => [s.n, s.state, s.href])).toEqual([
      [1, 'seen', '#step-1'],
      [2, 'seen', '#step-2'],
      [3, 'now', '#step-3'],
      [4, 'seen', '#step-4'],
      [5, 'seen', '#step-5'],
      [6, 'ahead', '#step-6'],
      [null, 'after', '#sing'],
    ])
    expect(rows(m).filter((r) => r.steps.length > 0)).toHaveLength(1)
  })

  it('tells the viewer where they are on this page, and continues there', () => {
    // Act
    const { here } = menuModel(LESSONS, [], {}, 2, DECK)

    // Assert
    expect(here).toEqual({
      title: 'You are here: step 3 of 6',
      line: 'Lesson 2 · Three',
      label: 'Continue. You are here: step 3 of 6, Three',
      href: '#step-3',
      fill: 0.5,
    })
  })

  it('keeps a lesson done on its own page at the step showing, every step seen and its ring full', () => {
    // Act
    const L2 = row(menuModel(LESSONS, [2], {}, 2, DECK), 2)

    // Assert
    expect([L2?.state, L2?.meta, L2?.fill]).toEqual([
      'here',
      'Done · step 3 of 6',
      1,
    ])
    expect(L2?.steps.map((s) => s.state)).toEqual([
      'seen',
      'seen',
      'now',
      'seen',
      'seen',
      'seen',
      'after',
    ])
  })

  it("counts the season's lessons done, the trailer left out, one bar a lesson", () => {
    // Arrange: on Lesson 2's page, Lessons 1 and 4 done, Lesson 5 begun
    const kept = { 5: { step: 2, of: 5 } }

    // Act
    const m = menuModel(LESSONS, [1, 4], kept, 2, DECK)

    // Assert
    expect(m.count).toBe('2 of 14 done')
    expect(m.season).toBe('Season 1 · 14 lessons')
    expect(m.bars.map((b) => b.kind)).toEqual([
      'done',
      'here',
      'ready',
      'done',
      'progress',
      // Lessons 6 on: ready with a page, coming later without one
      ...LESSONS.slice(6).map((L) =>
        L.page === undefined ? 'later' : 'ready',
      ),
    ])
    expect(m.bars[4].fill).toBeCloseTo(0.4)
  })

  it('splits the season into its two arcs', () => {
    // Act
    const { arcs } = menuModel(LESSONS, [], {}, 2, DECK)

    // Assert
    expect(arcs.map((a) => [a.name, a.span, a.rows.map((r) => r.n)])).toEqual([
      ['Hear it', 'Lessons 1 to 7', [1, 2, 3, 4, 5, 6, 7]],
      ['Shape it', 'Lessons 8 to 14', [8, 9, 10, 11, 12, 13, 14]],
    ])
  })
})

describe('menuMarkup', () => {
  it('ends its foot on the hub, every lesson on one page, styled as the links before it', () => {
    // Arrange
    const m = menuModel(LESSONS, [], {}, 2, DECK)

    // Act
    const html = menuMarkup(m, [], {
      map: '#explorer',
      practise: '/ear-lab?lesson=02',
    })

    // Assert
    const foot = new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector('.lm-foot')
    const links = Array.from(foot?.querySelectorAll('a') ?? [])
    expect(links.at(-1)?.textContent).toBe('All lessons')
    expect(links.at(-1)?.getAttribute('href')).toBe('/learn/')
    expect(foot?.lastElementChild).toBe(links.at(-1))
    expect(new Set(links.map((a) => a.className))).toEqual(new Set(['btn sm']))
  })
})

describe('a lesson held back (publish.ts)', () => {
  it('is coming later and not a link, even with a step the viewer reached while it was shown', () => {
    // Arrange: drafts held back, as on mercurypitch.com, and a step kept from a dev visit
    const season = seasonFor(LESSONS, defaultPageState(false))

    // Act
    const m = menuModel(season, [1], { 3: { step: 3, of: 6 } }, 1, DECK)

    // Assert
    const L3 = row(m, 3)
    expect([L3?.state, L3?.meta, L3?.href, L3?.fill]).toEqual([
      'later',
      'Coming later',
      null,
      0,
    ])
    expect(rows(m).map((r) => r.href)).not.toContain('/learn/03#step-3')
  })
})

describe('createLessonMenu on a page the worker served (page-state.ts)', () => {
  const showModal = HTMLDialogElement.prototype.showModal

  /** A step deck on its first of six steps. */
  const deck = {
    current: 1,
    count: 6,
    titles: DECK.titles,
    after: { label: 'Sing it', selector: '#sing' },
    subscribe: () => () => undefined,
    jump: () => undefined,
    show: () => undefined,
  } as unknown as StepDeck

  afterEach(() => {
    HTMLDialogElement.prototype.showModal = showModal
    document.querySelector<HTMLElement>('.tour-x')?.click()
    document.documentElement.classList.remove('touring')
    document.head.querySelector('#lesson-state')?.remove()
    document.getElementById('tourSheet')?.remove()
    document.body.textContent = ''
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('ends the masthead on a question mark that plays the tour from step 1, on a browser that has closed it', async () => {
    // Arrange: a return visit, the tour's record written, and Merc and
    // Tavi's stage drawn, so the tour has a step to show
    localStorage.setItem(TOUR_KEY, TOUR_VERSION)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const built: typeof Menu = await import('./lesson-menu')
    document.body.innerHTML =
      '<header class="mast" id="mast"><div class="mast-in"><span class="mast-ep">Lesson 01</span><button id="soundSwitch" type="button">Sound</button></div></header><div id="heroStage"></div>'
    const stage = document.getElementById('heroStage') as HTMLElement
    const box = { x: 0, y: 100, width: 300, height: 200 } as DOMRect
    stage.getBoundingClientRect = () => box
    stage.getClientRects = () => [box] as unknown as DOMRectList
    built.createLessonMenu({
      lesson: 1,
      deck,
      label: document.querySelector('.mast-ep') as HTMLElement,
      sections: [],
    })
    const mark = document.querySelector<HTMLButtonElement>(
      '.mast-in > :last-child',
    )

    // Act
    mark?.click()
    await vi.dynamicImportSettled()

    // Assert
    expect([
      mark?.className,
      mark?.type,
      mark?.getAttribute('aria-label'),
      mark?.querySelector('use')?.getAttribute('href'),
    ]).toEqual(['lm-tour', 'button', 'Tour this page', '#i-help'])
    expect(document.getElementById('tourTitle')?.textContent).toBe(
      'Meet Merc and Tavi',
    )
    expect(document.querySelector('.tour-count')?.textContent).toBe('1 of 1')
  })

  it("draws its question mark from a symbol in every lesson page's sprite", () => {
    // Arrange: every lesson page in the repository
    const pages = readdirSync(resolve(process.cwd(), 'learn')).filter((name) =>
      /^\d{2}\.html$/.test(name),
    )

    // Act
    const without = pages.filter(
      (name) =>
        !readFileSync(resolve(process.cwd(), 'learn', name), 'utf8').includes(
          '<symbol id="i-help" viewBox="0 0 24 24">',
        ),
    )

    // Assert
    expect(pages.length).toBeGreaterThanOrEqual(8)
    expect(without).toEqual([])
  })

  it('names its button by the label on screen, the season too where it shows, then what it opens', async () => {
    // Arrange: a phone first, then a screen wide enough for "Season 1 · "
    let wide = false
    const listeners: (() => void)[] = []
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query === '(min-width: 1021px)' ? wide : false
          },
          media: query,
          addEventListener: (_: string, fn: () => void) => listeners.push(fn),
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    )
    const built: typeof Menu = await import('./lesson-menu')
    document.body.innerHTML = '<span class="mast-ep">Lesson 01</span>'
    built.createLessonMenu({
      lesson: 1,
      deck,
      label: document.querySelector('.mast-ep') as HTMLElement,
      sections: [],
    })
    const button = document.querySelector('.lm-btn')
    const onPhone = button?.getAttribute('aria-label')

    // Act
    wide = true
    listeners.forEach((fn) => fn())

    // Assert
    expect(onPhone).toBe('Lesson 01, What is a note? All 14 lessons')
    expect(button?.getAttribute('aria-label')).toBe(
      'Season 1 · Lesson 01, What is a note? All 14 lessons',
    )
    vi.restoreAllMocks()
  })

  it('lists the lessons as the state has them: a draft it publishes linked, a lesson it holds back coming later', async () => {
    // Arrange: a production bundle, Lesson 3 published and Lesson 2 held back
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const built: typeof Menu = await import('./lesson-menu')
    HTMLDialogElement.prototype.showModal = function open(
      this: HTMLDialogElement,
    ) {
      this.setAttribute('open', '')
    }
    const tag = document.createElement('script')
    tag.type = 'application/json'
    tag.id = 'lesson-state'
    tag.textContent = JSON.stringify({
      version: 1,
      updatedAt: null,
      lessons: { 3: { published: true }, 2: { published: false } },
      drafts: false,
    })
    document.head.append(tag)
    document.body.innerHTML = '<span class="mast-ep">Lesson 01</span>'
    built.createLessonMenu({
      lesson: 1,
      deck,
      label: document.querySelector('.mast-ep') as HTMLElement,
      sections: [],
    })

    // Act
    document.querySelector<HTMLButtonElement>('.lm-btn')?.click()

    // Assert
    const hrefs = Array.from(document.querySelectorAll('#lessonMenu a')).map(
      (a) => a.getAttribute('href') ?? '',
    )
    expect(hrefs).toContain('/learn/03')
    expect(hrefs.filter((h) => h.startsWith('/learn/02'))).toEqual([])
    expect(hrefs.filter((h) => h.startsWith('/learn/05'))).toEqual([])
  })
})
