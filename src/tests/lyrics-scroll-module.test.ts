// ============================================================
// lyrics-scroll module tests
// ============================================================
//
// Companion to lyrics-scroll.test.ts, which predates the extraction and
// asserts the same arithmetic against *local copies* of the constants. These
// exercise the shipped module, so the two can no longer drift apart silently.

import { describe, expect, it } from 'vitest'
import { ANCHOR_RATIO, isBackOnActiveLine, scrollTargetFor, TOP_RATIO, } from '@/features/stem-mixer/lyrics-scroll'

/** A 400px-tall container starting at viewport y=100. */
const CONTAINER = { top: 100, bottom: 500, height: 400 }
const at = (top: number, height = 20) => ({ top, bottom: top + height, height })

describe('scrollTargetFor', () => {
  it('leaves a line alone while it sits inside the band', () => {
    // Band for bottomRatio 0.57 is y=160 (top 15%) to y=328 (bottom 57%).
    expect(scrollTargetFor(CONTAINER, at(200), 0, 0.57)).toBeNull()
    expect(scrollTargetFor(CONTAINER, at(300), 0, 0.57)).toBeNull()
  })

  it('scrolls when the line drops below the bottom threshold', () => {
    expect(scrollTargetFor(CONTAINER, at(320), 0, 0.57)).not.toBeNull()
  })

  it('scrolls when the line rises above the top threshold', () => {
    // 130 is above the 15% line at y=160.
    expect(scrollTargetFor(CONTAINER, at(130), 0, 0.57)).not.toBeNull()
  })

  it('parks the line at the anchor, measured from current scrollTop', () => {
    // line.top - container.top = 260; anchor = 400 * 0.35 = 140.
    expect(scrollTargetFor(CONTAINER, at(360), 1000, 0.57)).toBe(
      1000 + 260 - 140,
    )
  })

  it('honours a looser bottom threshold', () => {
    // y=330 is out of band at 0.57 (=328) but inside it at 0.6 (=340).
    expect(scrollTargetFor(CONTAINER, at(330, 5), 0, 0.57)).not.toBeNull()
    expect(scrollTargetFor(CONTAINER, at(330, 5), 0, 0.6)).toBeNull()
  })

  it('can return a negative target near the top of a scrolled list', () => {
    // Clamping is the DOM's job; inventing a floor here would silently
    // refuse to scroll a list that legitimately starts above the fold.
    expect(scrollTargetFor(CONTAINER, at(110), 0, 0.57)).toBeLessThan(0)
  })

  it('exposes the ratios it uses so callers cannot drift from them', () => {
    expect(ANCHOR_RATIO).toBe(0.35)
    expect(TOP_RATIO).toBe(0.15)
  })
})

describe('isBackOnActiveLine', () => {
  it('is true once the active line is back in the upper part of the view', () => {
    expect(isBackOnActiveLine(CONTAINER, at(200))).toBe(true)
  })

  it('is false while the user has scrolled the line low or away', () => {
    // 0.6 of 400 = 240px below the container top, i.e. y=340.
    expect(isBackOnActiveLine(CONTAINER, at(360))).toBe(false)
  })

  it('is more forgiving than the follow band, so reading ahead is not fought', () => {
    // A line at y=330 is outside the 0.57 follow band but still counts as
    // settled — otherwise following would re-arm and yank the list back
    // from under someone who scrolled ahead to read.
    expect(scrollTargetFor(CONTAINER, at(330, 5), 0, 0.57)).not.toBeNull()
    expect(isBackOnActiveLine(CONTAINER, at(330, 5))).toBe(true)
  })
})
