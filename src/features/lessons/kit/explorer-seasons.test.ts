// ============================================================
// Lesson explorer season tests — a tab per season, and the lines between them
// ============================================================
//
// A Season 1 page opens on Season 1's tab, which draws what it drew before
// there were seasons; its Season 2 tab loads Season 2's map on demand and
// draws its lessons coming later, with the Season 1 lessons its edges start
// from in the column before it. A card's link to a lesson of the other
// season opens that season's tab on it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { createExplorer } from './explorer'
import { LESSONS } from './season'
import { EDGES_2, LESSONS_2 } from './season-2'

function explorerPage(): void {
  // a card link scrolls its card in, which jsdom cannot
  vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
  document.body.innerHTML =
    '<div class="ex-bar"><div class="filters"><button type="button" data-lane="all">All</button><button type="button" data-lane="voice">Voice</button></div></div><div id="graph"></div><ol id="exList"></ol><div id="exCardHost"></div>'
  // a wide map, as a desktop lays it out
  Object.defineProperty(document.getElementById('graph'), 'clientWidth', {
    value: 1200,
  })
}

/** The season tabs as [label, pressed]. */
const tabs = (): [string, string | null][] =>
  Array.from(document.querySelectorAll('.ex-seasons button')).map((b) => [
    b.textContent ?? '',
    b.getAttribute('aria-pressed'),
  ])

const tab = (n: number): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.ex-seasons [data-season="${n}"]`)!

/** The numbers on the map's lesson nodes, in order. */
const nodes = (): number[] =>
  Array.from(document.querySelectorAll('#graph button.node')).map((b) =>
    Number(b.textContent),
  )

/** The earlier season's lessons drawn before the map, in order. */
const priors = (): number[] =>
  Array.from(document.querySelectorAll('#graph .node.prior')).map((d) =>
    Number(d.textContent),
  )

const openTitle = (): string | null | undefined =>
  document.querySelector('#exCardHost .ex-card h3')?.textContent

/** Opens Season 2's tab and waits for its map, which loads on demand. */
async function openSeason2(): Promise<void> {
  tab(2).click()
  await vi.waitFor(() => expect(nodes()[0]).toBe(15))
}

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  document.body.textContent = ''
})

describe('the explorer, a tab per season', () => {
  it("opens a Season 1 page on Season 1's tab, which maps the trailer and Lessons 1 to 14 as before", () => {
    // Arrange
    explorerPage()

    // Act
    createExplorer({ current: 2 })

    // Assert
    expect(tabs()).toEqual([
      ['Season 1', 'true'],
      ['Season 2', 'false'],
    ])
    expect(nodes()).toEqual(LESSONS.map((L) => L.n))
    expect(priors()).toEqual([])
    expect(document.querySelectorAll('#graph path.edge')).toHaveLength(18)
    expect(
      Array.from(document.querySelectorAll('#graph .lane-lbl')).map(
        (l) => l.textContent,
      ),
    ).toEqual(['Theory7 lessons', 'Voice6 lessons + 14'])
    expect(openTitle()).toBe('Twelve notes')
  })

  it("puts the tabs first in the explorer's bar, before the lane filter", () => {
    // Arrange
    explorerPage()

    // Act
    createExplorer({ current: 1 })

    // Assert
    expect(document.querySelector('.ex-bar')?.firstElementChild).toBe(
      document.querySelector('.ex-seasons'),
    )
    expect(
      document.querySelector('.ex-seasons')?.getAttribute('aria-label'),
    ).toBe('Season')
  })

  it("draws Season 2's fourteen lessons coming later, with the Season 1 lessons its edges start from before them", async () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })

    // Act
    await openSeason2()

    // Assert
    expect(tabs()).toEqual([
      ['Season 1', 'false'],
      ['Season 2', 'true'],
    ])
    expect(nodes()).toEqual(LESSONS_2.map((L) => L.n))
    expect(priors()).toEqual([2, 5, 6, 8, 9, 10, 12, 14])
    expect(document.querySelectorAll('#graph path.edge')).toHaveLength(
      EDGES_2.length,
    )
    expect(document.querySelector('#graph .prior-lbl')?.textContent).toBe(
      'Season 1',
    )
    // the Season 1 column clears the lane labels, which reach about 155px
    // in, and its caption is centred over it
    const lefts = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#graph .node.prior, #graph .prior-lbl',
      ),
    ).map((d) => parseFloat(d.style.left))
    expect(new Set(lefts).size).toBe(1)
    expect(lefts[0] - 15).toBeGreaterThan(165)
    expect(
      Array.from(document.querySelectorAll('#graph .arc span')).map(
        (a) => a.textContent,
      ),
    ).toEqual(['Read itLessons 15 to 21', 'Harmonise itLessons 22 to 28'])
    expect(
      Array.from(document.querySelectorAll('#graph .lane-lbl b')).map(
        (b) => b.parentElement?.textContent,
      ),
    ).toEqual(['Theory7 lessons', 'Voice6 lessons + 28'])
  })

  it("opens Season 2 on Lesson 15's card, to read where drafts show, building on Lesson 2 of Season 1", async () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })

    // Act
    await openSeason2()

    // Assert: Lesson 15 is a draft with a page, shown in this build
    const card = document.querySelector('#exCardHost .ex-card')
    expect(openTitle()).toBe('The staff: where notes sit')
    expect(card?.querySelector('.eyebrow')?.textContent).toContain('Lesson 15')
    expect(card?.querySelector('.eyebrow')?.textContent).toContain(
      'Ready · read',
    )
    expect(
      Array.from(card?.querySelectorAll('a.btn') ?? [], (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['/learn/15'])
    expect(
      Array.from(card?.querySelectorAll('[data-go]') ?? []).map(
        (b) => b.textContent,
      ),
    ).toEqual([
      '02 · Twelve notes',
      '16 · Sight-singing',
      '21 · Circle of fifths',
    ])
    expect(card?.querySelector('.topic')?.textContent).toBe(
      'Staff notation: staff, clefs, ledger lines, grand staff',
    )
  })

  it("draws Lesson 15 coming later where drafts are held back, with nothing to its page and Compose's link kept", async () => {
    // Arrange: a production build's default for a page no worker served
    vi.stubEnv('VITE_DRAFT_LESSONS', '0')
    vi.resetModules()
    const { createExplorer: explorerBuilt } = await import('./explorer')
    explorerPage()
    explorerBuilt({ current: 1 })

    // Act
    await openSeason2()

    // Assert: Lesson 15's WEB-SPEC, What the kit and the app still need, item 2
    const card = document.querySelector('#exCardHost .ex-card')
    expect(card?.querySelector('.eyebrow')?.textContent).toContain(
      'Coming later',
    )
    expect(card?.querySelector('.ex-actions')).toBeNull()
    expect(card?.innerHTML).not.toContain('/learn/15')
    expect(
      card?.querySelector('a.addr[href="/?lesson=15#/compose"]'),
    ).not.toBeNull()
    vi.unstubAllEnvs()
  })

  it('opens a Season 2 page that carries its season on its own tab, on its own card', async () => {
    // Arrange: Lesson 15's page carries Season 2 before it draws (main.ts)
    vi.resetModules()
    const { carrySeason } = await import('./page-state')
    const { SEASON_2: S2 } = await import('./season-2')
    const { createExplorer: explorerBuilt } = await import('./explorer')
    carrySeason(S2)
    explorerPage()

    // Act
    explorerBuilt({ current: 15 })

    // Assert: no load waits, since the page carries the season
    expect(tabs()).toEqual([
      ['Season 1', 'false'],
      ['Season 2', 'true'],
    ])
    expect(nodes()[0]).toBe(15)
    expect(openTitle()).toBe('The staff: where notes sit')
  })

  it("opens Lesson 17's page on its own card, Ready, with the Ear Lab's link", async () => {
    // Arrange: Lesson 17's page carries Season 2 before it draws (main.ts)
    vi.resetModules()
    const { carrySeason } = await import('./page-state')
    const { SEASON_2: S2 } = await import('./season-2')
    const { createExplorer: explorerBuilt } = await import('./explorer')
    carrySeason(S2)
    explorerPage()

    // Act
    explorerBuilt({ current: 17 })

    // Assert: a draft with a page, shown in this build, whose card on its own
    // page goes back to its top (Lesson 17's WEB-SPEC, Explorer and season data)
    const card = document.querySelector('#exCardHost .ex-card')
    expect(openTitle()).toBe('How long is a note?')
    expect(card?.querySelector('.eyebrow')?.textContent).toContain('Lesson 17')
    expect(card?.querySelector('.eyebrow')?.textContent).toContain('Ready')
    expect(
      Array.from(card?.querySelectorAll('a.btn') ?? [], (a) =>
        a.getAttribute('href'),
      ),
    ).toEqual(['#top'])
    expect(
      card?.querySelector('a.addr[href="/ear-lab?lesson=17"]'),
    ).not.toBeNull()
  })

  it("lights a Season 2 lesson's lines in from Season 1, and its Season 1 lessons on its path", async () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 1 })
    await openSeason2()

    // Act: Lesson 16 needs 9 and 15
    explorer.select(16, false)

    // Assert
    const lit = Array.from(
      document.querySelectorAll('#graph path.edge.in'),
    ).length
    expect(lit).toBe(2)
    const on = Array.from(document.querySelectorAll('#graph .node.prior.anc'))
    expect(on.map((d) => Number(d.textContent))).toEqual([2, 6, 9])
  })

  it("opens Season 1's tab on a Season 1 lesson a Season 2 card builds on", async () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })
    await openSeason2()
    document.querySelector<HTMLElement>('#exCardHost [data-go="16"]')?.click()

    // Act: Lesson 16 builds on Lesson 9
    document.querySelector<HTMLElement>('#exCardHost [data-go="9"]')?.click()

    // Assert
    expect(tabs()).toEqual([
      ['Season 1', 'true'],
      ['Season 2', 'false'],
    ])
    expect(nodes()).toEqual(LESSONS.map((L) => L.n))
    expect(openTitle()).toBe('Landing a leap')
  })

  it('goes back to the lesson last picked on a tab', async () => {
    // Arrange
    explorerPage()
    const explorer = createExplorer({ current: 3 })
    explorer.select(5, false)
    await openSeason2()
    explorer.select(20, false)

    // Act
    tab(1).click()
    await vi.waitFor(() => expect(nodes()[0]).toBe(0))

    // Assert
    expect(openTitle()).toBe(LESSONS[5].title)
  })

  it("lists Season 2's rows on a phone, each saying what it comes after, in its two arcs", async () => {
    // Arrange: a phone's width, where the map is a list
    explorerPage()
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(max-width: 860px)',
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    )
    createExplorer({ current: 1 })

    // Act
    tab(2).click()
    await vi.waitFor(() =>
      expect(document.querySelector('#exList [data-n="15"]')).not.toBeNull(),
    )

    // Assert
    expect(
      Array.from(document.querySelectorAll('#exList .ex-arc')).map(
        (a) => a.textContent,
      ),
    ).toEqual(['Read it Lessons 15 to 21', 'Harmonise it Lessons 22 to 28'])
    expect(
      document.querySelector('#exList [data-n="16"] small')?.textContent,
    ).toBe('Coming later · after 9, 15')
    expect(document.querySelectorAll('#exList .ex-row')).toHaveLength(14)
  })

  it('keeps the lane filter across tabs, dimming the other lane and its earlier lessons', async () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })
    document.querySelector<HTMLElement>('[data-lane="voice"]')?.click()

    // Act
    await openSeason2()

    // Assert: Lesson 2 is theory, Lesson 5 voice, Lesson 14 both
    const dim = (n: number): boolean =>
      Array.from(document.querySelectorAll('#graph .node.prior'))
        .find((d) => d.textContent === String(n))
        ?.classList.contains('dim') ?? false
    expect([dim(2), dim(5), dim(14)]).toEqual([true, false, false])
  })
})
