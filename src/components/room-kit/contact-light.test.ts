// ============================================================
// The contact light: on the path, off it, and the catch between
// ============================================================

import { describe, expect, it } from 'vitest'
import { CATCH_AFTER_OFF_SEC, CATCH_EVERY_SEC, createContactTracker, } from './contact-light'

describe('the catch', () => {
  it('rings once as the voice comes on after a spell off the path', () => {
    const tracker = createContactTracker()
    const frames: boolean[] = []
    // 60 fps: off for half a second, then on for half a second.
    for (let i = 0; i < 60; i++) {
      frames.push(tracker.step(i / 60, i < 30 ? 'off' : 'on'))
    }

    expect(frames.filter(Boolean)).toHaveLength(1)
    expect(frames.indexOf(true)).toBe(30)
  })

  it('does not ring for a flicker, for a start on the path, or too often', () => {
    const tracker = createContactTracker()
    // A wave starts with the voice on it: no catch.
    expect(tracker.step(0, 'hidden')).toBe(false)
    expect(tracker.step(0.02, 'on')).toBe(false)
    // One frame off and back (a tracker's flicker): no catch.
    expect(tracker.step(0.5, 'off')).toBe(false)
    expect(tracker.step(0.517, 'on')).toBe(false)
    // A real spell off: a catch.
    expect(tracker.step(1, 'off')).toBe(false)
    expect(tracker.step(1 + CATCH_AFTER_OFF_SEC, 'on')).toBe(true)
    // Off and on again soon after: no second ring yet.
    const caught = 1 + CATCH_AFTER_OFF_SEC
    expect(tracker.step(caught + 0.05, 'off')).toBe(false)
    expect(tracker.step(caught + CATCH_EVERY_SEC - 0.01, 'on')).toBe(false)
    // Later, it may ring again.
    expect(tracker.step(caught + 1, 'off')).toBe(false)
    expect(tracker.step(caught + 1.3, 'on')).toBe(true)
  })

  it('forgets a spell off across a landing and the rest', () => {
    const tracker = createContactTracker()
    tracker.step(0, 'off')
    tracker.step(1, 'hidden')
    // The next wave starts off and comes on at once: no catch.
    tracker.step(3, 'off')
    expect(tracker.step(3.05, 'on')).toBe(false)
  })

  it('starts over on reset', () => {
    const tracker = createContactTracker()
    tracker.step(0, 'off')
    tracker.reset()
    expect(tracker.step(0.5, 'on')).toBe(false)
  })
})
