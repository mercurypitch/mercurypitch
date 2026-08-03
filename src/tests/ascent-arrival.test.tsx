// Arriving on the Ascent — what the trail does before you touch it.
//
// The orb view used to load with nothing expanded, so every visit cost a tap
// before you could read what the week asked of you, and the one scroll it did
// run fired in the same tick the orbs were inserted. These pin the arrival
// behaviour: the week you are actually on is open, and it is the current
// week rather than week 1.

import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAYS_PER_WEEK } from '@/features/path/path-content'
import { pathProgress, recordPathPracticeDay, resetAscent, setPathFreeRoam, startAscent, } from '@/features/path/path-progress'
import { setPathView } from '@/features/path/path-view'
import PathPage from '@/pages/PathPage'

beforeEach(() => {
  // jsdom has no layout, so scrollIntoView is absent on Element.
  Element.prototype.scrollIntoView = vi.fn()
  // setup.ts stubs requestAnimationFrame to hand back an id and never call
  // back, which is fine for the animation loops it was written for but would
  // swallow the deferred scroll this file is here to assert. Run it now.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  // jsdom ships no matchMedia. Stub it rather than lean on its absence, so a
  // failure here is the arrival behaviour and not a missing browser API.
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  localStorage.clear()
  resetAscent()
  setPathFreeRoam(false)
  setPathView('ascent')
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The orb button for a week, found by the label the page already exposes. */
function orbFor(container: HTMLElement, order: number): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'),
  ].find(
    (el) =>
      el.getAttribute('aria-label')?.startsWith(`Week ${order}:`) === true,
  )
  if (button === undefined) throw new Error(`no orb for week ${order}`)
  return button
}

function openOrders(container: HTMLElement): string[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      'button[aria-expanded="true"]',
    ),
  ].map((el) => el.getAttribute('aria-label') ?? '')
}

describe('arriving on the Ascent', () => {
  it('opens week 1 before the climb has begun', () => {
    const { container } = render(() => <PathPage />)

    expect(orbFor(container, 1).getAttribute('aria-expanded')).toBe('true')
    expect(openOrders(container)).toHaveLength(1)
  })

  it('opens the week the singer is actually on, not week 1', () => {
    startAscent()
    // Distinct dates, because a practice day is idempotent per local date.
    // More than a week's worth, so progress rolls off week 1.
    for (let day = 1; day <= DAYS_PER_WEEK + 2; day++) {
      recordPathPracticeDay(`2026-03-${String(day).padStart(2, '0')}`)
    }

    const order = pathProgress()?.currentWeek ?? 1
    // Guard on the guard: still on week 1 and this test proves nothing.
    expect(order).toBeGreaterThan(1)

    const { container } = render(() => <PathPage />)

    expect(orbFor(container, order).getAttribute('aria-expanded')).toBe('true')
    expect(orbFor(container, 1).getAttribute('aria-expanded')).toBe('false')
    expect(openOrders(container)).toHaveLength(1)
  })

  it('still closes when the open orb is tapped', () => {
    const { container } = render(() => <PathPage />)
    const orb = orbFor(container, 1)

    fireEvent.click(orb)

    expect(orb.getAttribute('aria-expanded')).toBe('false')
    expect(openOrders(container)).toHaveLength(0)
  })

  // Only that a scroll is issued and aimed at the orb's centre. jsdom has no
  // layout, so the half of this fix that matters — deferring until the trail
  // has a measurable height — cannot be proved here; this is the guard
  // against the call disappearing altogether.
  it('aims a scroll at the current orb', () => {
    render(() => <PathPage />)

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
      expect.objectContaining({ block: 'center' }),
    )
  })
})
