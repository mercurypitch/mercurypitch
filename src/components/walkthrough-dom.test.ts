// @vitest-environment jsdom
// ============================================================
// walkthrough-dom — where the spotlight scrolls a target to
// ============================================================
//
// A target has to show clear of what is pinned over the page. On a phone the
// tab bar covers the foot of the scroller and Path's view switch sticks over
// its top: Home's Ascent card sat under the tab bar, and a tall Path card
// scrolled to the top slid under the switch. jsdom has no layout, so the
// boxes, styles and hit tests here are the phone's, measured at 390x844.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openBand, scrollBand, scrollTargetIntoView } from './walkthrough-dom'

interface Box {
  top: number
  bottom: number
  left?: number
  right?: number
}

const boxes = new Map<Element, Box>()
const styles = new Map<Element, Partial<CSSStyleDeclaration>>()
/** Topmost first at a point, as elementsFromPoint answers. */
let layers: { el: Element; box: Box }[] = []

function place(el: Element, box: Box): void {
  boxes.set(el, box)
  el.getBoundingClientRect = (): DOMRect => {
    const b = boxes.get(el) ?? box
    const left = b.left ?? 0
    const right = b.right ?? 390
    return {
      top: b.top,
      bottom: b.bottom,
      left,
      right,
      width: right - left,
      height: b.bottom - b.top,
      x: left,
      y: b.top,
      toJSON: () => ({}),
    }
  }
}

function add<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  parent: Element,
  box: Box,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  parent.appendChild(el)
  place(el, box)
  styles.set(el, style)
  return el
}

/** The phone's app: a scroller under the header, the tab bar over its foot. */
function phone(): { main: HTMLElement; tabbar: HTMLElement } {
  const main = add(
    'main',
    document.body,
    { top: 50, bottom: 844 },
    {
      overflowY: 'auto',
    },
  )
  const tabbar = add(
    'nav',
    document.body,
    { top: 782, bottom: 836 },
    {
      position: 'fixed',
    },
  )
  return { main, tabbar }
}

/** A card in `main` that elementsFromPoint finds wherever it is not covered. */
function card(main: HTMLElement, box: Box): HTMLElement {
  const el = add('section', main, box)
  el.scrollIntoView = vi.fn()
  return el
}

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', {
    value: 844,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: 390,
    configurable: true,
  })
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    (el) =>
      ({
        overflowX: 'visible',
        overflowY: 'visible',
        position: 'static',
        ...styles.get(el),
      }) as CSSStyleDeclaration,
  )
  document.elementsFromPoint = (x: number, y: number): Element[] =>
    layers
      .filter(
        ({ box }) =>
          y >= box.top &&
          y < box.bottom &&
          x >= (box.left ?? 0) &&
          x < (box.right ?? 390),
      )
      .map(({ el }) => el)
})

afterEach(() => {
  vi.restoreAllMocks()
  boxes.clear()
  styles.clear()
  layers = []
  document.body.innerHTML = ''
})

describe('the band a target can be seen in', () => {
  it('is the scroller cut to the window, less the tab bar over its foot', () => {
    const { main, tabbar } = phone()
    const ascent = card(main, { top: 785, bottom: 875 })
    layers = [
      { el: tabbar, box: boxes.get(tabbar)! },
      { el: ascent, box: boxes.get(ascent)! },
      { el: main, box: boxes.get(main)! },
    ]

    const view = scrollBand(ascent)
    expect(view).toEqual({ top: 50, bottom: 844 })
    expect(openBand(ascent, view)).toEqual({ top: 50, bottom: 782 })
  })

  it('does not count the tour layer, or a pinned box that holds the target', () => {
    const { main, tabbar } = phone()
    const tab = add('button', tabbar, { top: 790, bottom: 830 })
    const overlay = add('div', document.body, { top: 0, bottom: 844 })
    overlay.setAttribute('data-tour-layer', '')
    layers = [
      { el: overlay, box: boxes.get(overlay)! },
      { el: tab, box: boxes.get(tab)! },
      { el: tabbar, box: boxes.get(tabbar)! },
      { el: main, box: boxes.get(main)! },
    ]

    expect(openBand(tab, scrollBand(tab))).toEqual({ top: 0, bottom: 844 })
  })
})

describe('scrolling a target into view', () => {
  it('lifts a card from under the tab bar, then puts its margins back', () => {
    const { main, tabbar } = phone()
    const ascent = card(main, { top: 785, bottom: 875 })
    layers = [
      { el: tabbar, box: boxes.get(tabbar)! },
      { el: ascent, box: boxes.get(ascent)! },
    ]
    let margins: string[] = []
    vi.mocked(ascent.scrollIntoView).mockImplementation(() => {
      margins = [ascent.style.scrollMarginTop, ascent.style.scrollMarginBottom]
    })

    expect(scrollTargetIntoView(ascent)).toBe(true)

    expect(ascent.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'center',
    })
    // 844 - 782 of tab bar, and room for the ring.
    expect(margins).toEqual(['', '70px'])
    expect(ascent.style.scrollMarginBottom).toBe('')
  })

  it('brings a card in that the old 80 px allowance left mostly hidden', () => {
    const { main, tabbar } = phone()
    // Its bottom 70 px past the tab bar's top, 6 px inside the window.
    const strip = card(main, { top: 762, bottom: 838 })
    layers = [{ el: tabbar, box: boxes.get(tabbar)! }]

    expect(scrollTargetIntoView(strip)).toBe(true)
  })

  it('tops a tall card below a view switch stuck over the scroller', () => {
    const { main } = phone()
    const page = add('div', main, { top: 50, bottom: 2000 })
    const viewSwitch = add(
      'div',
      page,
      { top: 62, bottom: 110 },
      {
        position: 'sticky',
      },
    )
    // Where the old top alignment left it: its top 60 px under the switch.
    const week = card(main, { top: 50, bottom: 809 })
    layers = [{ el: viewSwitch, box: boxes.get(viewSwitch)! }]
    let margins: string[] = []
    vi.mocked(week.scrollIntoView).mockImplementation(() => {
      margins = [week.style.scrollMarginTop, week.style.scrollMarginBottom]
    })

    expect(scrollTargetIntoView(week)).toBe(true)

    expect(week.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
      inline: 'center',
    })
    // The switch reaches 60 px into the scroller (110 - 50), and the ring.
    expect(margins).toEqual(['68px', ''])
  })

  it('leaves a card alone that shows whole, clear of the bars', () => {
    const { main, tabbar } = phone()
    const shown = card(main, { top: 300, bottom: 420 })
    layers = [{ el: tabbar, box: boxes.get(tabbar)! }]

    expect(scrollTargetIntoView(shown)).toBe(false)
    expect(shown.scrollIntoView).not.toHaveBeenCalled()
  })
})
