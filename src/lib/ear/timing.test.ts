// Compare's one shape: the answer, the breath, the pick, and no further
// once silenced. The drills' own tests hear it end to end
// (compare.room.test.tsx); this holds the shape itself.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPARE_TIMING, compareSequence } from './timing'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('compareSequence', () => {
  it('sounds the answer, waits the breath, then sounds the pick', async () => {
    const heard: string[] = []
    const done = compareSequence(
      async () => {
        heard.push('answer')
      },
      async () => {
        heard.push('pick')
      },
      () => true,
    )

    await vi.advanceTimersByTimeAsync(COMPARE_TIMING.gapMs - 1)
    expect(heard).toEqual(['answer'])
    await vi.advanceTimersByTimeAsync(1)
    await done
    expect(heard).toEqual(['answer', 'pick'])
  })

  it('goes no further after an answer that did not sound out', async () => {
    const pick = vi.fn(async () => undefined)

    const done = compareSequence(
      async () => false,
      pick,
      () => true,
    )
    await vi.advanceTimersByTimeAsync(COMPARE_TIMING.gapMs)
    await done

    expect(pick).not.toHaveBeenCalled()
  })

  it('goes no further once silenced in the breath', async () => {
    let live = true
    const pick = vi.fn(async () => undefined)

    const done = compareSequence(
      async () => true,
      pick,
      () => live,
    )
    await vi.advanceTimersByTimeAsync(COMPARE_TIMING.gapMs / 2)
    live = false
    await vi.advanceTimersByTimeAsync(COMPARE_TIMING.gapMs)
    await done

    expect(pick).not.toHaveBeenCalled()
  })
})
