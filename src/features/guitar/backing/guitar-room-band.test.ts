// Room-band tests pin the click's beat map, especially when it repeats a span.
// ============================================================

import { describe, expect, it } from 'vitest'
import { resolveBandLoop } from './guitar-room-band'

describe('resolveBandLoop', () => {
  it('keeps a loop the exercise actually contains', () => {
    expect(resolveBandLoop({ start: 4, end: 8 }, 16)).toEqual({
      start: 4,
      end: 8,
    })
  })

  it('trims a loop that runs off the end of the exercise', () => {
    expect(resolveBandLoop({ start: 12, end: 40 }, 16)).toEqual({
      start: 12,
      end: 16,
    })
  })

  it('refuses a loop that starts past the exercise', () => {
    expect(resolveBandLoop({ start: 20, end: 24 }, 16)).toBeNull()
  })

  it('refuses a loop shorter than one beat, which the pulse cannot express', () => {
    expect(resolveBandLoop({ start: 4, end: 4.5 }, 16)).toBeNull()
  })

  it('is absent when nothing was asked for', () => {
    expect(resolveBandLoop(null, 16)).toBeNull()
    expect(resolveBandLoop(undefined, 16)).toBeNull()
  })
})
