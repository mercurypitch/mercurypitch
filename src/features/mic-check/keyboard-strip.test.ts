import { describe, expect, it } from 'vitest'
import { isBlackKey, KEYBOARD_HIGH, KEYBOARD_LOW, layoutKeys, pitchToX, } from './keyboard-strip'

describe('layoutKeys', () => {
  it('spreads C2 to C6 across the width, white keys first', () => {
    const keys = layoutKeys(290)
    const whites = keys.filter((key) => !key.black)
    const blacks = keys.filter((key) => key.black)
    expect(whites).toHaveLength(29)
    expect(blacks).toHaveLength(20)
    expect(keys.slice(0, whites.length).every((key) => !key.black)).toBe(true)
    expect(whites[0]).toMatchObject({ midi: KEYBOARD_LOW, x: 0, width: 10 })
    expect(whites[whites.length - 1]).toMatchObject({
      midi: KEYBOARD_HIGH,
      x: 280,
    })
  })

  it('centres each black key on the seam between its neighbours', () => {
    const keys = layoutKeys(290)
    const cSharp = keys.find((key) => key.midi === KEYBOARD_LOW + 1)
    expect(cSharp?.black).toBe(true)
    expect((cSharp?.x ?? 0) + (cSharp?.width ?? 0) / 2).toBeCloseTo(10, 6)
  })

  it('has nothing to lay out in no width', () => {
    expect(layoutKeys(0)).toEqual([])
  })
})

describe('pitchToX', () => {
  const keys = layoutKeys(290)

  it('puts a whole note on its key centre', () => {
    // C4 is the 15th white key from C2: x 140..150.
    expect(pitchToX(60, keys)).toBeCloseTo(145, 6)
  })

  it('slides a bent note between its two keys', () => {
    const c = pitchToX(60, keys)
    const cSharp = pitchToX(61, keys)
    expect(pitchToX(60.5, keys)).toBeCloseTo((c + cSharp) / 2, 6)
  })

  it('keeps notes off either end on the end keys', () => {
    expect(pitchToX(20, keys)).toBe(pitchToX(KEYBOARD_LOW, keys))
    expect(pitchToX(100, keys)).toBe(pitchToX(KEYBOARD_HIGH, keys))
  })

  it('knows the black keys', () => {
    expect([60, 61, 62, 63, 64, 65, 66].map(isBlackKey)).toEqual([
      false,
      true,
      false,
      true,
      false,
      false,
      true,
    ])
  })
})
