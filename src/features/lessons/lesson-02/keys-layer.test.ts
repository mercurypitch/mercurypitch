// ============================================================
// Lesson 2 keys layer tests — Straighten, Lift out the five and the arrows
// ============================================================
//
// Under the test doubles reduced motion is on, so every change lands in its
// end state on the next frame (`advance`), as it does for a viewer who asks
// for less motion.

import { describe, expect, it } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { signName } from '@/features/lessons/kit/notes'
import { advance, clearNames, isStraight, keysModel, keysRange, liftFive, sendArrow, } from './keys-layer'
import { arrowFrom } from './names-arrows'

const C_SHARP_4 = 61

function octave() {
  return keysModel({ tiles: [12, 24], phoneTiles: [14, 20], pairs: true })
}

describe('keysModel', () => {
  it('straightens at once under reduced motion, and keeps the selection on the row', () => {
    const m = octave()
    expect(keysRange(m)).toEqual([45, 81])
    m.straightTo = 1
    advance(m, 16)
    expect(m.straight).toBe(1)
    expect(isStraight(m)).toBe(true)
    expect(keysRange(m)).toEqual([57, 69])
    m.narrow = true
    expect(keysRange(m)).toEqual([59, 65])
  })

  it('lifts exactly the five dark tiles of the octave, and sums them once they are back', () => {
    const m = octave()
    liftFive(m, true, 0)
    advance(m, 16)
    expect([...m.lifts.keys()].map((s) => 45 + s)).toEqual([58, 61, 63, 66, 68])
    expect([...m.lifts.values()].every((l) => l.v === 1)).toBe(true)
    expect(m.sumAt).toBeNull()
    // back down (one by one with motion, at once without), and the sum once the last is home
    liftFive(m, false, 100)
    advance(m, 116)
    expect([...m.lifts.values()].every((l) => l.v === 0)).toBe(true)
    expect(m.sumAt).toBe(116)
    // an arrow's labels take the lines under the row: the sum steps aside
    const up = arrowFrom(60, 'sharp')
    if (up === null) throw new Error('no arrow')
    sendArrow(m, up, 200)
    expect(m.sumAt).toBeNull()
  })

  it("writes an arrow's name as it lands, and rings the key once it has two", () => {
    const m = octave()
    const up = arrowFrom(60, 'sharp')
    const down = arrowFrom(62, 'flat')
    if (up === null || down === null) throw new Error('no arrow')
    sendArrow(m, up, 1000)
    advance(m, 1000)
    expect(m.written.on(C_SHARP_4).map((n) => signName(n))).toEqual(['C♯4'])
    expect(m.rings.has(C_SHARP_4)).toBe(false)
    sendArrow(m, down, 1100)
    advance(m, 1100)
    expect(m.written.on(C_SHARP_4).map((n) => signName(n))).toEqual([
      'C♯4',
      'D♭4',
    ])
    expect(m.rings.has(C_SHARP_4)).toBe(true)
    clearNames(m)
    expect(m.written.on(C_SHARP_4)).toEqual([])
    expect(m.rings.size).toBe(0)
  })
})
