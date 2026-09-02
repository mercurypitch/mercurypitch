import { describe, expect, it } from 'vitest'
import { createSilenceWatch, FLOOR, GRACE_MS } from './silence-watch'

describe('createSilenceWatch', () => {
  it('says nothing during the grace period', () => {
    const watch = createSilenceWatch()
    expect(watch.sample(0, 0)).toBe(false)
    expect(watch.sample(0, GRACE_MS - 1)).toBe(false)
  })

  it('reports a dead input once the grace period is up', () => {
    // The silent interface channel that prompted all this read 0.0001.
    const watch = createSilenceWatch()
    watch.sample(0.0001, 0)
    expect(watch.sample(0.0001, GRACE_MS)).toBe(true)
  })

  it('measures the grace from the first sample, not from zero', () => {
    // The watch is created before the stream opens; the clock that
    // matters starts when readings do.
    const watch = createSilenceWatch()
    watch.sample(0, 10_000)
    expect(watch.sample(0, 10_000 + GRACE_MS - 1)).toBe(false)
    expect(watch.sample(0, 10_000 + GRACE_MS)).toBe(true)
  })

  it('treats a level exactly at the floor as silence', () => {
    // The floor is the lowest level that counts as sound, exclusive.
    const watch = createSilenceWatch()
    watch.sample(FLOOR, 0)
    expect(watch.sample(FLOOR, GRACE_MS)).toBe(true)
  })

  it('accepts a level just above the floor as sound', () => {
    const watch = createSilenceWatch()
    watch.sample(FLOOR * 1.01, 0)
    expect(watch.sample(0, GRACE_MS)).toBe(false)
  })

  it('never reports an input that has been heard, however quiet since', () => {
    // A held breath between phrases is not a broken microphone, and
    // saying so mid-song would be worse than saying nothing.
    const watch = createSilenceWatch()
    watch.sample(FLOOR * 2, 0)
    expect(watch.sample(0, GRACE_MS * 10)).toBe(false)
  })

  it('keeps reporting while the input stays dead', () => {
    const watch = createSilenceWatch()
    watch.sample(0, 0)
    expect(watch.sample(0, GRACE_MS)).toBe(true)
    expect(watch.sample(0, GRACE_MS * 2)).toBe(true)
  })

  it('starts over after a device switch', () => {
    const watch = createSilenceWatch()
    watch.sample(0, 0)
    expect(watch.sample(0, GRACE_MS)).toBe(true)
    watch.reset()
    expect(watch.sample(0, GRACE_MS * 2)).toBe(false)
  })

  it('forgets that it had heard something, so a dead new device reports', () => {
    // Switching from a working microphone to a silent one must be
    // catchable; without the reset clearing `heard`, it never would be.
    const watch = createSilenceWatch()
    watch.sample(FLOOR * 2, 0)
    watch.reset()
    watch.sample(0, 1000)
    expect(watch.sample(0, 1000 + GRACE_MS)).toBe(true)
  })

  it('honours a custom floor and grace', () => {
    const watch = createSilenceWatch(0.5, 100)
    watch.sample(0.4, 0)
    expect(watch.sample(0.4, 100)).toBe(true)
  })
})
