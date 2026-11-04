// The tab's one scroller, shared by the bench and the Ear Report in turn
// (tab-scroll.ts): the report opens at its top, and the bench comes back
// where it stood when it opened the report, once.

import { afterEach, describe, expect, it } from 'vitest'
import { leaveBench, openAtTop, returnToBench, scrollerOf } from './tab-scroll'

function stage(): { scroller: HTMLDivElement; inside: HTMLDivElement } {
  const scroller = document.createElement('div')
  scroller.style.overflowY = 'auto'
  const inside = document.createElement('div')
  scroller.append(inside)
  document.body.append(scroller)
  return { scroller, inside }
}

afterEach(() => {
  document.body.replaceChildren()
  // Spend whatever a test left kept.
  returnToBench(undefined)
})

describe("the tab's scroller", () => {
  it('is the nearest ancestor that scrolls', () => {
    const { scroller, inside } = stage()
    const deeper = document.createElement('p')
    inside.append(deeper)
    expect(scrollerOf(deeper)).toBe(scroller)
    expect(scrollerOf(scroller)).toBeNull()
    expect(scrollerOf(undefined)).toBeNull()
  })

  it('opens the report at its top', () => {
    const { scroller, inside } = stage()
    scroller.scrollTop = 640
    openAtTop(inside)
    expect(scroller.scrollTop).toBe(0)
  })

  it('brings the bench back where it was left, once', () => {
    const { scroller, inside } = stage()
    scroller.scrollTop = 1180
    leaveBench(inside)
    scroller.scrollTop = 0
    returnToBench(inside)
    expect(scroller.scrollTop).toBe(1180)

    scroller.scrollTop = 12
    returnToBench(inside)
    expect(scroller.scrollTop).toBe(12)
  })

  it('leaves a bench that was not left for the report alone', () => {
    const { scroller, inside } = stage()
    scroller.scrollTop = 300
    returnToBench(inside)
    expect(scroller.scrollTop).toBe(300)
  })
})
