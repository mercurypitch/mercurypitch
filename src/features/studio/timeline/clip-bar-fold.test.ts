import { afterEach, describe, expect, it } from 'vitest'
import { fitClipBar } from './clip-bar-fold'

/** A timeline foot: zoom and the bar side by side, laid out as the numbers say. */
function foot(layout: {
  zoomLeft: number
  zoomWidth?: number
  barLeft: number
  /** The bar's width with its commands' names in, and folded to icons. */
  named: number
  icons: number
}): { bar: HTMLElement } {
  const parent = document.createElement('div')
  const zoom = document.createElement('div')
  zoom.setAttribute('data-studio-zoom', '')
  const bar = document.createElement('div')
  parent.append(zoom, bar)
  document.body.append(parent)
  Object.defineProperties(zoom, {
    offsetLeft: { get: () => layout.zoomLeft },
    offsetWidth: { get: () => layout.zoomWidth ?? 102 },
  })
  Object.defineProperties(bar, {
    offsetLeft: { get: () => layout.barLeft },
    offsetWidth: {
      get: () =>
        bar.hasAttribute('data-folded') ? layout.icons : layout.named,
    },
  })
  return { bar }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('the floating clip bar beside zoom', () => {
  it('folds to icons when its names would run within 16 px of zoom', () => {
    // A loop take's bar under a long lane name, at a 1100 px window.
    const { bar } = foot({
      zoomLeft: 946,
      barLeft: 252,
      named: 700,
      icons: 303,
    })
    fitClipBar(bar)
    expect(bar.hasAttribute('data-folded')).toBe(true)
  })

  it('keeps its names, or takes them back, while the whole bar fits', () => {
    const { bar } = foot({
      zoomLeft: 866,
      barLeft: 252,
      named: 593,
      icons: 303,
    })
    bar.setAttribute('data-folded', '')
    fitClipBar(bar)
    // 252 + 593 + 16 = 861: five px to spare.
    expect(bar.hasAttribute('data-folded')).toBe(false)
  })

  it("measures with the names in, so a folded bar does not unfold on its icons' width", () => {
    const { bar } = foot({
      zoomLeft: 700,
      barLeft: 252,
      named: 506,
      icons: 246,
    })
    bar.setAttribute('data-folded', '')
    fitClipBar(bar)
    expect(bar.hasAttribute('data-folded')).toBe(true)
    const wide = foot({ zoomLeft: 900, barLeft: 252, named: 506, icons: 246 })
    wide.bar.setAttribute('data-folded', '')
    fitClipBar(wide.bar)
    expect(wide.bar.hasAttribute('data-folded')).toBe(false)
  })

  it('leaves the bar be where nothing is laid out, or zoom is not beside it', () => {
    const { bar } = foot({
      zoomLeft: 0,
      zoomWidth: 0,
      barLeft: 0,
      named: 0,
      icons: 0,
    })
    fitClipBar(bar)
    expect(bar.hasAttribute('data-folded')).toBe(false)
    const lone = document.createElement('div')
    document.body.append(lone)
    fitClipBar(lone)
    expect(lone.hasAttribute('data-folded')).toBe(false)
  })
})
