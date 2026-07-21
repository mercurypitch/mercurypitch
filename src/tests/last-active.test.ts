// ============================================================
// Last-active throttle — pure-helper tests
// ============================================================
// Imports the dependency-free worker module directly (no D1/auth), so the
// getAuth throttle decision is covered by the main suite.

import { describe, expect, it } from 'vitest'
import { ACTIVE_THROTTLE_MS, shouldTouchLastActive, } from '../../workers/db-worker/src/last-active'

const NOW = Date.parse('2026-07-21T12:00:00.000Z')
const iso = (ms: number) => new Date(ms).toISOString()

describe('ACTIVE_THROTTLE_MS', () => {
  it('is 15 minutes', () => {
    expect(ACTIVE_THROTTLE_MS).toBe(15 * 60 * 1000)
  })
})

describe('shouldTouchLastActive', () => {
  it('touches when never set (null / undefined / empty)', () => {
    expect(shouldTouchLastActive(null, NOW)).toBe(true)
    expect(shouldTouchLastActive(undefined, NOW)).toBe(true)
    expect(shouldTouchLastActive('', NOW)).toBe(true)
  })

  it('skips while inside the throttle window', () => {
    // 1ms ago, and just under the window — both still fresh.
    expect(shouldTouchLastActive(iso(NOW - 1), NOW)).toBe(false)
    expect(
      shouldTouchLastActive(iso(NOW - (ACTIVE_THROTTLE_MS - 1)), NOW),
    ).toBe(false)
  })

  it('skips exactly at the window boundary (strict >)', () => {
    expect(shouldTouchLastActive(iso(NOW - ACTIVE_THROTTLE_MS), NOW)).toBe(
      false,
    )
  })

  it('touches once past the window', () => {
    expect(
      shouldTouchLastActive(iso(NOW - (ACTIVE_THROTTLE_MS + 1)), NOW),
    ).toBe(true)
    expect(shouldTouchLastActive(iso(NOW - 60 * 60 * 1000), NOW)).toBe(true)
  })

  it('self-heals an unparseable timestamp by touching', () => {
    expect(shouldTouchLastActive('not-a-date', NOW)).toBe(true)
    expect(shouldTouchLastActive('garbage', NOW)).toBe(true)
  })

  it('does not touch for a future timestamp (clock skew is not "stale")', () => {
    expect(shouldTouchLastActive(iso(NOW + 60 * 60 * 1000), NOW)).toBe(false)
  })

  it('honours a custom throttle window', () => {
    const oneMin = 60 * 1000
    expect(shouldTouchLastActive(iso(NOW - 30 * 1000), NOW, oneMin)).toBe(false)
    expect(shouldTouchLastActive(iso(NOW - 90 * 1000), NOW, oneMin)).toBe(true)
  })
})
