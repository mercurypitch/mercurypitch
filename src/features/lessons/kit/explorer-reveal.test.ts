// ============================================================
// Lesson explorer reveal tests — a tapped lesson's card comes into view
// ============================================================
//
// jsdom lays nothing out, so a test lays the boxes out itself, most as the
// audit measured them on a tablet held sideways (lesson-polish A1): a 59 px
// masthead, the open card at 483 to 1100 px and its main button at 1027 to
// 1071 px, on jsdom's 768 px screen.

import { afterEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import { q, qa } from './dom'
import { createExplorer, revealDelta } from './explorer'

/** The room under a 59 px masthead on a 768 px screen: 8 px below it to 12 px above the screen's foot. */
const ROOM = { top: 67, bottom: 756 }

/** The scroll that brings the measured button's foot to the room's: 1071 - 756. */
const REVEAL = 315

/** The explorer's markup under a masthead, as a lesson page has it. */
function explorerPage(): void {
  document.body.innerHTML =
    '<header id="mast"></header><div class="filters"><button type="button" data-lane="all">All</button></div><div id="graph"></div><ol id="exList"></ol><div id="exCardHost"></div>'
}

/** A box's top and bottom, px from the top of the screen. */
type Edges = readonly [number, number]

/** Where the open card, its main button (if it has one), its question and (on a phone's list) its row sit. */
interface Layout {
  readonly card: Edges
  readonly button?: Edges
  readonly hook?: Edges
  readonly row?: Edges
}

/** As the audit measured them on a tablet held sideways. */
const TABLET: Layout = { card: [483, 1100], button: [1027, 1071] }

/** Lays the page out as `layout` says, under a 59 px masthead; everything else is empty. */
function measuredBoxes(layout: Layout = TABLET): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const at = ([top, bottom]: Edges): DOMRect =>
        ({ top, bottom, height: bottom - top }) as DOMRect
      if (this.id === 'mast') return at([0, 59])
      if (this.classList.contains('ex-card')) return at(layout.card)
      if (
        layout.button !== undefined &&
        this.matches('.ex-actions .btn.primary')
      )
        return at(layout.button)
      if (layout.hook !== undefined && this.classList.contains('hookq'))
        return at(layout.hook)
      if (layout.row !== undefined && this.matches('#exList .ex-row'))
        return at(layout.row)
      return at([0, 0])
    },
  )
}

/** `window.scrollBy`, stubbed: reads back the top of each scroll asked for. */
function pageScrolls(): () => (number | undefined)[] {
  const by = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined)
  return () => by.mock.calls.map(([o]) => (o as ScrollToOptions).top)
}

/** A screen under 860 px wide, where the explorer is a list. */
function phoneScreen(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(max-width: 860px)',
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  )
}

/** Lesson `current`'s page with its next-lesson card, a link to the explorer that selects Lesson `next`. */
function pageWithNextCard(current: number, next: number): void {
  explorerPage()
  document.body.insertAdjacentHTML(
    'beforeend',
    `<a class="next-card" href="#explorer" data-select-lesson="${next}">Lesson ${next}</a>`,
  )
  createExplorer({ current })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  localStorage.clear()
  document.body.textContent = ''
})

describe('revealDelta', () => {
  it("scrolls by the least that shows the button, the card's top kept in view", () => {
    // Act: the card measured on a tablet held sideways, its button under the fold
    const d = revealDelta(
      { top: 483, bottom: 1100 },
      { top: 1027, bottom: 1071 },
      ROOM,
    )

    // Assert
    expect(d).toBe(REVEAL)
  })

  it('shows a card taller than the room from its top, under the masthead', () => {
    // Act
    const d = revealDelta(
      { top: 483, bottom: 1400 },
      { top: 1027, bottom: 1071 },
      ROOM,
    )

    // Assert
    expect(d).toBe(483 - ROOM.top)
  })

  it('leaves a button already on screen where it is', () => {
    // Act
    const d = revealDelta(
      { top: 483, bottom: 1400 },
      { top: 600, bottom: 644 },
      ROOM,
    )

    // Assert
    expect(d).toBe(0)
  })

  it("scrolls up as far as the card's top to a button above the room", () => {
    // Act
    const d = revealDelta(
      { top: -500, bottom: 50 },
      { top: -300, bottom: -256 },
      ROOM,
    )

    // Assert
    expect(d).toBe(-500 - ROOM.top)
  })

  it("brings the button in first when the card's top cannot come with it", () => {
    // Act: a tall card whose button sits further under its top than the room is tall
    const d = revealDelta(
      { top: 100, bottom: 2000 },
      { top: 900, bottom: 944 },
      ROOM,
    )

    // Assert
    expect(d).toBe(944 - ROOM.bottom)
  })
})

describe('a lesson tapped in the explorer', () => {
  it("scrolls a tapped node's card into view, as far as its main button", () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })
    measuredBoxes()
    const tops = pageScrolls()

    // Act
    q('#graph [aria-label^="Lesson 2:"]').click()

    // Assert
    expect(tops()).toEqual([REVEAL])
  })

  it("scrolls a tapped row's card into view on a phone's list", () => {
    // Arrange: the row just above its card
    phoneScreen()
    explorerPage()
    createExplorer({ current: 1 })
    measuredBoxes({ ...TABLET, row: [423, 483] })
    const tops = pageScrolls()

    // Act
    q('#exList [data-n="2"] button.it').click()

    // Assert
    expect(document.querySelector('#exList .ex-detail .ex-card')).not.toBeNull()
    expect(tops()).toEqual([REVEAL])
  })

  it("brings a card taller than the screen in from its row's top on a phone's list, the row kept in view", () => {
    // Arrange: a row near the foot of the screen, its long card under it
    phoneScreen()
    explorerPage()
    createExplorer({ current: 1 })
    measuredBoxes({ row: [700, 760], card: [760, 1700], button: [960, 1004] })
    const tops = pageScrolls()

    // Act
    q('#exList [data-n="2"] button.it').click()

    // Assert: the row's top lands just under the masthead
    expect(tops()).toEqual([700 - ROOM.top])
  })

  it('says, politely, which card opened and that it is below', () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 1 })
    pageScrolls()
    const status = q('#exStatus')
    const atLoad = status.textContent

    // Act
    q('#graph [aria-label^="Lesson 2:"]').click()

    // Assert
    expect(atLoad).toBe('')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('Lesson 2, Twelve notes: card below')
  })

  it('makes the map one tab stop, the selected node, which an arrow moves along', () => {
    // Arrange
    explorerPage()
    createExplorer({ current: 2 })
    const stops = (): string[] =>
      qa<HTMLButtonElement>('#graph button.node')
        .filter((b) => b.tabIndex === 0)
        .map((b) => b.getAttribute('aria-label') ?? '')
    const atLoad = stops()

    // Act
    q('#graph [aria-label^="Lesson 2:"]').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )

    // Assert
    expect(atLoad).toEqual(['Lesson 2: Twelve notes'])
    expect(stops()).toEqual(['Lesson 3: Match a note'])
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Lesson 3: Match a note',
    )
  })
})

describe("a next-lesson card's link to the explorer", () => {
  it('selects its lesson at once, and shows the card once the jump to the explorer has settled', () => {
    // Arrange
    pageWithNextCard(3, 4)
    measuredBoxes()
    const tops = pageScrolls()
    q('[data-select-lesson]').click()
    const duringJump = tops()

    // Act
    window.dispatchEvent(new Event('scrollend'))

    // Assert
    expect(q('#exCardHost h3').textContent).toBe('The major scale and home')
    expect(duringJump).toEqual([])
    expect(tops()).toEqual([REVEAL])
  })

  it('shows the card 150 ms after the last scroll where the browser never says the scroll ended', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    pageWithNextCard(3, 4)
    measuredBoxes()
    const tops = pageScrolls()
    q('[data-select-lesson]').click()
    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(149)
    const gliding = tops()

    // Act
    vi.advanceTimersByTime(1)

    // Assert
    expect(gliding).toEqual([])
    expect(tops()).toEqual([REVEAL])
  })

  it('shows the card after 600 ms when the page does not scroll at all', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    pageWithNextCard(3, 4)
    measuredBoxes()
    const tops = pageScrolls()
    q('[data-select-lesson]').click()
    vi.advanceTimersByTime(599)
    const early = tops()

    // Act
    vi.advanceTimersByTime(1)

    // Assert
    expect(early).toEqual([])
    expect(tops()).toEqual([REVEAL])
  })

  it('shows a card coming later as far as its question, which stands in for the button it does not have', () => {
    // Arrange: Lesson 6's card leads to Lesson 7, coming later, its question under the fold
    pageWithNextCard(6, 7)
    measuredBoxes({ card: [700, 1000], hook: [810, 870] })
    const tops = pageScrolls()
    q('[data-select-lesson]').click()

    // Act
    window.dispatchEvent(new Event('scrollend'))

    // Assert
    expect(q('#exCardHost h3').textContent).toBe(
      'Slides, sirens and your range',
    )
    expect(document.querySelector('#exCardHost .ex-actions')).toBeNull()
    expect(tops()).toEqual([870 - ROOM.bottom])
  })
})
