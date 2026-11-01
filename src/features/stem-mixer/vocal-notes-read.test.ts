// ============================================================
// A song's notes read with no mixer up: what it keeps of a vocal
// ============================================================
//
// First note's read of a song runs this read whole, the walk and the whole
// decode with it (first-note/own-song-read.test.ts). Here, what the read
// keeps of the samples it is given.

import { describe, expect, it } from 'vitest'
import { keepNear } from './vocal-notes-read'

describe('keeping samples near a rate', () => {
  it('keeps the mean of a whole number of them', () => {
    const kept = keepNear(
      Float32Array.from([1, 3, 5, 7, 9, 11, 13]),
      48_000,
      16_000,
    )
    expect(kept.rate).toBe(16_000)
    expect(Array.from(kept.samples)).toEqual([3, 9])
    const same = Float32Array.from([1, 2])
    expect(keepNear(same, 22_050, 16_000).samples).toBe(same)
  })
})
