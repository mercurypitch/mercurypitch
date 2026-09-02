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

  it('never reports an input that has been heard, however quiet since', () => {
    // A held breath between phrases is not a broken microphone.
    const watch = createSilenceWatch()
    watch.sample(FLOOR * 2, 0)
    expect(watch.sample(0, GRACE_MS * 10)).toBe(false)
  })

  it('starts over after a device switch', () => {
    const watch = createSilenceWatch()
    watch.sample(0, 0)
    expect(watch.sample(0, GRACE_MS)).toBe(true)
    watch.reset()
    expect(watch.sample(0, GRACE_MS * 2)).toBe(false)
  })
})
