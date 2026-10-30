// The room's pad layouts, as the mock-ups lay them out: the big pair
// for "The first" and "The second", The Grid's four in one row, rows of
// three and grids of two or three centred, and the keys on their own.

import { describe, expect, it } from 'vitest'
import { padsCentred, padShape } from './skin'

describe("The room's pads", () => {
  it('stands The Grid four in one row and a row of three as three', () => {
    expect(padShape(4, false)).toEqual({ shape: 'row4', cols: 4 })
    expect(padShape(3, false)).toEqual({ shape: 'three', cols: 3 })
    expect(padShape(2, false)).toEqual({ shape: 'two', cols: 2 })
    expect(padShape(6, false)).toEqual({ shape: 'grid34', cols: 4 })
    expect(padShape(7, false).shape).toBe('ladder')
    expect(padShape(3, true).shape).toBe('ladder')
  })

  it('centres every pad but the big pair and the keys', () => {
    expect(padsCentred('two', 2)).toBe(false)
    expect(padsCentred('two', 4)).toBe(true)
    expect(padsCentred('three', 3)).toBe(true)
    expect(padsCentred('three', 6)).toBe(true)
    expect(padsCentred('row4', 4)).toBe(true)
    expect(padsCentred('grid34', 12)).toBe(false)
    expect(padsCentred('ladder', 8)).toBe(false)
  })
})
