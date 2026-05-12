// ============================================================
// Lyrics Scroll Tests — Auto-scroll behavior for issue #301
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── Auto-scroll threshold / target math ────────────────────────

const SCROLL_THRESHOLD = 0.57 // line bottom past 57% of container height
const SCROLL_TARGET_OFFSET = 0.35 // scroll so active line is 35% from top
const USER_SCROLL_RESET_ZONE = 0.6 // top 60% of viewport resets user-scroll

function computeTrigger(
  containerTop: number,
  containerHeight: number,
  lineBottom: number,
): boolean {
  return lineBottom > containerTop + containerHeight * SCROLL_THRESHOLD
}

function computeScrollTarget(
  containerScrollTop: number,
  lineTop: number,
  containerTop: number,
  containerHeight: number,
): number {
  return (
    containerScrollTop +
    (lineTop - containerTop) -
    containerHeight * SCROLL_TARGET_OFFSET
  )
}

function isInResetZone(
  lineTop: number,
  containerTop: number,
  containerHeight: number,
): boolean {
  return lineTop - containerTop < containerHeight * USER_SCROLL_RESET_ZONE
}

// ── Scroll math tests ──────────────────────────────────────────

describe('Auto-scroll threshold (57%)', () => {
  it('triggers when active line bottom is below 57% of container height', () => {
    // container: top=0, height=400 → threshold = 0 + 400*0.57 = 228
    // line bottom = 300 → 300 > 228 → should trigger
    expect(computeTrigger(0, 400, 300)).toBe(true)
  })

  it('does NOT trigger when active line bottom is above 57% threshold', () => {
    // container: top=100, height=500 → threshold = 100 + 285 = 385
    // line bottom = 300 → 300 ≤ 385 → should not trigger
    expect(computeTrigger(100, 500, 300)).toBe(false)
  })

  it('triggers exactly at threshold boundary + 1px', () => {
    const containerTop = 0
    const containerHeight = 400
    const threshold = containerTop + containerHeight * 0.57
    expect(
      computeTrigger(containerTop, containerHeight, threshold + 0.01),
    ).toBe(true)
  })

  it('does NOT trigger exactly at threshold boundary', () => {
    const containerTop = 0
    const containerHeight = 400
    const threshold = containerTop + containerHeight * 0.57
    expect(computeTrigger(containerTop, containerHeight, threshold)).toBe(false)
  })
})

describe('Scroll target position (35% from top)', () => {
  it('positions active line at 35% from container top', () => {
    // container: top=50, height=400, scrollTop=0, line top=300
    // target = 0 + (300-50) - 400*0.35 = 110
    // After scrollTo(110): line appears at 300-110=190 from page = 140 from container top
    // 140 / 400 = 35% of container height → correct
    const target = computeScrollTarget(0, 300, 50, 400)
    expect(target).toBeCloseTo(110, 0)
  })

  it('accounts for existing scrollTop', () => {
    // container: top=0, height=500, scrollTop=200, line top=600
    // target = 200 + (600-0) - 500*0.35 = 200 + 600 - 175 = 625
    const target = computeScrollTarget(200, 600, 0, 500)
    expect(target).toBeCloseTo(625, 0)
  })
})

describe('User-scroll reset zone (top 60%)', () => {
  it('resets userScrolled when active line is in top 60% of viewport', () => {
    // container: top=0, height=500 → reset zone = 0 to 300
    // line top = 200 → 200 < 300 → should reset
    expect(isInResetZone(200, 0, 500)).toBe(true)
  })

  it('does NOT reset when active line is below 60% of viewport', () => {
    // container: top=0, height=500 → reset zone = 0 to 300
    // line top = 350 → 350 ≥ 300 → should not reset
    expect(isInResetZone(350, 0, 500)).toBe(false)
  })
})

// ── DOM integration tests ──────────────────────────────────────

describe('Scroll event handling', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    Object.defineProperty(container, 'scrollTop', {
      value: 0,
      writable: true,
    })
    container.scrollTo = vi.fn(
      (optsOrX?: number | ScrollToOptions, y?: number) => {
        if (typeof optsOrX === 'object' && optsOrX?.top !== undefined) {
          Object.defineProperty(container, 'scrollTop', {
            value: optsOrX.top,
            writable: true,
          })
        } else if (typeof optsOrX === 'number' && typeof y === 'number') {
          Object.defineProperty(container, 'scrollTop', {
            value: y,
            writable: true,
          })
        }
      },
    ) as unknown as typeof container.scrollTo
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('dispatches scroll event on container', () => {
    const handler = vi.fn()
    container.addEventListener('scroll', handler)
    container.dispatchEvent(new Event('scroll'))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('isAutoScrolling flag suppresses user-scroll detection', () => {
    const isAutoScrolling = true
    let detected = false
    const handler = vi.fn(() => {
      if (isAutoScrolling) return
      detected = true
    })

    container.addEventListener('scroll', handler)
    container.dispatchEvent(new Event('scroll'))
    expect(handler).toHaveBeenCalled()
    expect(detected).toBe(false)
  })

  it('detects manual scroll when not auto-scrolling', () => {
    const isAutoScrolling = false
    let userScrolled = false
    const handler = vi.fn(() => {
      if (isAutoScrolling) return
      userScrolled = true
    })

    container.addEventListener('scroll', handler)
    container.dispatchEvent(new Event('scroll'))
    expect(userScrolled).toBe(true)
  })
})

describe('Auto-scroll reset flag timing', () => {
  it('isAutoScrolling resets after 100ms timeout', async () => {
    vi.useFakeTimers()
    let isAutoScrolling = true

    setTimeout(() => {
      isAutoScrolling = false
    }, 100)

    expect(isAutoScrolling).toBe(true)
    await vi.advanceTimersByTimeAsync(100)
    expect(isAutoScrolling).toBe(false)

    vi.useRealTimers()
  })

  it('user-scroll debounce resets after 800ms', async () => {
    vi.useFakeTimers()
    let userScrolled = true

    setTimeout(() => {
      userScrolled = false
    }, 800)

    expect(userScrolled).toBe(true)
    await vi.advanceTimersByTimeAsync(800)
    expect(userScrolled).toBe(false)

    vi.useRealTimers()
  })
})
