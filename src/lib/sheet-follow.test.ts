// ============================================================
// sheet-follow — where a staff's scrollers go to keep the cursor in sight
// ============================================================

import { describe, expect, it } from 'vitest'
import { CURSOR_EDGE_PX, cursorFollowLeft, revealShift, systemFollowOffset, } from './sheet-follow'

// A staff view 180 px tall over 726 px of systems, 130 px apart, each
// stave 60 px tall: the Notes view's own numbers at 1280 x 816.
const VIEW = { offset: 0, size: 180, extent: 726 }
const system = (index: number) => ({
  start: 68 + index * 130,
  end: 128 + index * 130,
})

describe('systemFollowOffset', () => {
  it('leaves a system alone while it sits in the upper half of the view', () => {
    expect(systemFollowOffset(VIEW, { start: 20, end: 80 })).toBeNull()
  })

  it('parks the next system in the top quarter once the cursor reaches it', () => {
    // Rows 1 and 2 of the staff: the cursor moves down a system each time.
    const first = systemFollowOffset(VIEW, system(1))
    expect(first).toBe(198 - 45)
    // Parked, the same system asks for nothing more.
    expect(systemFollowOffset({ ...VIEW, offset: first! }, system(1))).toBe(
      null,
    )
    const second = systemFollowOffset({ ...VIEW, offset: first! }, system(2))
    expect(second).toBe(328 - 45)
  })

  it('brings a system back when the cursor jumps above the view', () => {
    expect(systemFollowOffset({ ...VIEW, offset: 400 }, system(0))).toBe(23)
  })

  it('stops at the end of the staff, and asks for nothing more there', () => {
    const short = { offset: 300, size: 180, extent: 600 }
    expect(systemFollowOffset(short, system(4))).toBe(420)
    expect(systemFollowOffset({ ...short, offset: 420 }, system(4))).toBeNull()
  })

  it('keeps at least 16 px above a system in a short view', () => {
    expect(
      systemFollowOffset({ offset: 0, size: 40, extent: 726 }, system(1)),
    ).toBe(198 - 16)
  })
})

describe('cursorFollowLeft', () => {
  const across = { offset: 0, size: 356, extent: 460 }

  it('keeps the cursor clear of the right edge as it runs on', () => {
    expect(cursorFollowLeft(across, 300)).toBe(300 - 356 + CURSOR_EDGE_PX)
  })

  it('goes back to the left edge for the next system', () => {
    expect(cursorFollowLeft({ ...across, offset: 104 }, 70)).toBe(0)
  })

  it('never asks for the offset the staff already has', () => {
    // A scroll to where the staff stands still stops a glide in Chromium,
    // so the cursor at a system's start, with the staff already at 0, asks
    // for nothing.
    expect(cursorFollowLeft(across, 70)).toBeNull()
    expect(cursorFollowLeft({ ...across, offset: 104 }, 460)).toBeNull()
  })

  it('leaves a staff that fits its view alone', () => {
    expect(cursorFollowLeft({ offset: 0, size: 900, extent: 900 }, 880)).toBe(
      null,
    )
  })
})

describe('revealShift', () => {
  const view = { start: 653, end: 744 }

  it('scrolls down just far enough to show a stave below the view', () => {
    expect(revealShift(view, { start: 795, end: 855 }, 12)).toBe(855 + 12 - 744)
  })

  it('scrolls up to show a stave above the view', () => {
    expect(revealShift(view, { start: 600, end: 660 }, 12)).toBe(600 - 12 - 653)
  })

  it('leaves a stave that already shows', () => {
    expect(revealShift(view, { start: 670, end: 730 }, 12)).toBe(0)
  })

  it('lines up the top of a stave taller than the view', () => {
    expect(
      revealShift({ start: 0, end: 50 }, { start: 100, end: 160 }, 12),
    ).toBe(88)
  })
})
