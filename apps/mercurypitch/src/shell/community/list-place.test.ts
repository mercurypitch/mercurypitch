// ============================================================
// List place: how far to scroll so a row stands whole in the clear part
// ============================================================

import { describe, expect, it } from 'vitest'
import { revealBy } from './list-place'

/** The scroller's clear part: under the bar, above the dock. */
const VIEW = { top: 100, bottom: 500 }

describe('bringing a row into view', () => {
  it('leaves a row that already stands whole where it is', () => {
    expect(revealBy({ top: 200, bottom: 256 }, VIEW)).toBe(0)
    expect(revealBy({ top: 100, bottom: 500 }, VIEW)).toBe(0)
  })

  it('scrolls a row under the dock up just clear of it', () => {
    expect(revealBy({ top: 470, bottom: 526 }, VIEW)).toBe(26)
    expect(revealBy({ top: 1130, bottom: 1258 }, VIEW)).toBe(758)
  })

  it('scrolls a row under the bar down to its top', () => {
    expect(revealBy({ top: 60, bottom: 116 }, VIEW)).toBe(-40)
  })

  it('shows the top of a row taller than the clear part', () => {
    expect(revealBy({ top: 300, bottom: 800 }, VIEW)).toBe(200)
  })
})
