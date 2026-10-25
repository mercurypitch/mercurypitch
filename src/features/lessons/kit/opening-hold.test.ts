// ============================================================
// Lesson opening hold tests — the page held still while Merc and Tavi land, and every way it lifts
// ============================================================
//
// Each test loads the gate and the hold afresh (`vi.resetModules`): whether
// the page has started a first visit's tour is the gate's own state, set
// once per page. jsdom lays nothing out, so Merc and Tavi's stage is drawn
// by hand, as the tour's own tests draw it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import './browser-doubles.test-fixtures'
import type * as Hold from './opening-hold'
import type * as Gate from './tour-gate'

let hold: typeof Hold
let gate: typeof Gate

/** Merc and Tavi's stage, drawn, so the tour has a step to show. */
function stage(): void {
  document.body.innerHTML = '<div id="heroStage"></div>'
  const el = document.getElementById('heroStage') as HTMLElement
  const box = { x: 0, y: 100, width: 300, height: 200 } as DOMRect
  el.getBoundingClientRect = () => box
  el.getClientRects = () => [box] as unknown as DOMRectList
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
}

const held = (): boolean =>
  document.documentElement.classList.contains('tour-wait')
const tourUp = (): boolean => document.querySelector('.tour') !== null

/** The tour's chunk loaded, and every promise waiting on it run. */
async function settled(): Promise<void> {
  await vi.dynamicImportSettled()
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

/** An opening still playing, and the call that ends it. */
function opening(): { ended: Promise<void>; end: () => void } {
  let end = (): void => undefined
  const ended = new Promise<void>((resolve) => {
    end = resolve
  })
  return { ended, end }
}

/** A first visit at the top of Lesson 1: the masthead starts the tour, then the opening asks to hold. */
async function firstVisit(ended: Promise<unknown>): Promise<void> {
  gate.startTour(1, false)
  hold.holdForOpening(ended)
  await settled()
}

beforeEach(async () => {
  vi.resetModules()
  gate = await import('./tour-gate')
  hold = await import('./opening-hold')
  stage()
})

afterEach(() => {
  document.querySelector<HTMLElement>('.tour-x')?.click()
  document.documentElement.classList.remove('touring', 'tour-wait')
  document.getElementById('tourSheet')?.remove()
  document.body.textContent = ''
  localStorage.clear()
  vi.doUnmock('./tour')
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('holdForOpening: when it holds', () => {
  it('holds the page still on the visit that offers the tour, and the tour back, until the opening ends', async () => {
    // Arrange
    const { ended, end } = opening()
    await firstVisit(ended)
    const during = [held(), tourUp()]

    // Act
    end()
    await settled()

    // Assert: the tour opens as the opening ends, and the page is let go
    expect(during).toEqual([true, false])
    expect([held(), tourUp()]).toEqual([false, true])
  })

  it('holds nothing, and keeps nothing back, on a visit that offers no tour', async () => {
    // Arrange: a return visit, whose masthead starts no tour
    const { ended } = opening()

    // Act
    hold.holdForOpening(ended)
    await settled()

    // Assert
    expect(held()).toBe(false)
  })

  it('holds nothing for a replay, which opens at once', async () => {
    // Arrange: the question mark pressed as the opening plays on a return visit
    const { ended } = opening()
    gate.startTour(1, true)

    // Act
    hold.holdForOpening(ended)
    const asked = held()
    await settled()

    // Assert
    expect(asked).toBe(false)
    expect([held(), tourUp()]).toEqual([false, true])
  })
})

describe('holdForOpening: every way the hold lifts', () => {
  it('lifts 6 s after the page started, however far the opening has got, and the tour opens', async () => {
    // Arrange: an opening that never ends, as a stalled one does
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockReturnValue(1500)
    await firstVisit(new Promise(() => undefined))
    await vi.advanceTimersByTimeAsync(hold.HOLD_CAP - 1500 - 1)
    const before = [held(), tourUp()]

    // Act
    await vi.advanceTimersByTimeAsync(1)
    await settled()

    // Assert
    expect(hold.HOLD_CAP).toBe(6000)
    expect(before).toEqual([true, false])
    expect([held(), tourUp()]).toEqual([false, true])
  })

  it('lets the tour open when the opening fails, as a cancelled animation does', async () => {
    // Arrange
    await firstVisit(Promise.reject(new Error('cancelled')))

    // Assert
    expect([held(), tourUp()]).toEqual([false, true])
  })

  it("lifts at once when the tour's chunk fails to load, as it does offline", async () => {
    // Arrange: a chunk that cannot load, and an opening still playing
    vi.doMock('./tour', () => {
      throw new Error('Failed to fetch dynamically imported module')
    })
    const { ended } = opening()

    // Act
    await firstVisit(ended)

    // Assert
    expect([held(), tourUp()]).toEqual([false, false])
  })

  const ways: ReadonlyArray<[string, () => void]> = [
    [
      'a dialog opens, as the lesson menu does',
      () => {
        const menu = document.createElement('dialog')
        document.body.appendChild(menu)
        menu.setAttribute('open', '')
      },
    ],
    [
      'a film plays',
      () => {
        const film = document.createElement('video')
        document.body.appendChild(film)
        film.dispatchEvent(new Event('play'))
      },
    ],
    [
      'anything goes full screen',
      () => document.dispatchEvent(new Event('fullscreenchange')),
    ],
    [
      'the page moves, as a section link moves it',
      () => window.dispatchEvent(new Event('scroll')),
    ],
    [
      'the page is hidden',
      () => {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
        document.dispatchEvent(new Event('visibilitychange'))
      },
    ],
  ]

  for (const [way, act] of ways) {
    it(`lifts when ${way}, the tour still waiting for the opening`, async () => {
      // Arrange
      const { ended } = opening()
      await firstVisit(ended)
      const before = held()

      // Act
      act()
      await settled()

      // Assert
      expect(before).toBe(true)
      expect([held(), tourUp()]).toEqual([false, false])
    })
  }

  it('stays when a box inside the page scrolls, or the page is shown again', async () => {
    // Arrange
    const { ended } = opening()
    await firstVisit(ended)
    const box = document.createElement('div')
    document.body.appendChild(box)

    // Act
    box.dispatchEvent(new Event('scroll'))
    document.dispatchEvent(new Event('visibilitychange'))
    await settled()

    // Assert
    expect(held()).toBe(true)
  })
})
