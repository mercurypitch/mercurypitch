// ============================================================
// Lesson 2 keys geometry tests — the phone stage DECISIONS 83 measures
// ============================================================

import { describe, expect, it } from 'vitest'
import { LO, WHITE } from '@/features/lessons/kit/spiral-keys'
import type { Rect } from './keys-geometry'
import { A3_S, A4_S, B3_S, F4_S, glideRect, keyRect, keysLayout, keyTarget, phonePanMax, phoneWhites, TARGET, tileRect, tileRow, tilesTakeTaps, } from './keys-geometry'

/** The phone figure at 390 x 844: the card's inner width, Lesson 1's tall canvas. */
const PHONE_W = 356
const PHONE_H = 308

/** The black keys of A3 to A4, as semitones from A2: A♯3, C♯4, D♯4, F♯4, G♯4. */
const BLACKS = [13, 16, 18, 21, 23]

describe('the phone keyboard', () => {
  const kb = keysLayout(PHONE_W, PHONE_H, true, 0)

  it('lays the octave A3 to A4 edge to edge: eight white keys of 44.5 px', () => {
    expect(kb.ww).toBe(44.5)
    expect(kb.xOfW(WHITE.indexOf(A3_S))).toBe(0)
    expect(kb.xOfW(WHITE.indexOf(A4_S)) + kb.ww).toBe(PHONE_W)
  })

  it("draws the keys in Lesson 1's proportions, from y 111 to y 246", () => {
    expect(kb.kbTop).toBeCloseTo(110.9, 1)
    expect(kb.kbTop + kb.kbH).toBeCloseTo(246.4, 1)
    expect(kb.bH).toBeCloseTo(84, 0)
    expect(kb.bW).toBeCloseTo(27.6, 1)
  })

  it('gives every black key a 44 px zone, its full depth, with 0.5 px clear between neighbours', () => {
    const zones = BLACKS.map((s) => keyTarget(kb, s, TARGET))
    for (const z of zones) {
      expect(z.w).toBe(44)
      expect(z.white).toBe(false)
      // the kit's tap test reaches KEY_SLOP past each end: the zone ends exactly at the key
      expect(z.y - 10).toBeCloseTo(kb.kbTop, 6)
      expect(z.y + z.h + 10).toBeCloseTo(kb.kbTop + kb.bH, 6)
    }
    // C♯4 and D♯4, and F♯4 and G♯4, sit one white key apart
    expect(zones[2].x - (zones[1].x + zones[1].w)).toBeCloseTo(0.5, 6)
    expect(zones[4].x - (zones[3].x + zones[3].w)).toBeCloseTo(0.5, 6)
  })

  it('gives every white key its full width and depth', () => {
    const c4 = keyTarget(kb, 15, TARGET)
    expect(c4).toMatchObject({ white: true, w: 44.5, y: kb.kbTop, h: kb.kbH })
  })

  it('shows as many white keys as fit at 44 px on a narrower phone, and pans the rest', () => {
    expect(phoneWhites(PHONE_W)).toBe(8)
    expect(phonePanMax(PHONE_W)).toBe(0)
    expect(phoneWhites(342)).toBe(7)
    expect(phonePanMax(342)).toBe(1)
    expect(keysLayout(342, PHONE_H, true, 0).ww).toBeGreaterThanOrEqual(TARGET)
  })
})

describe('the tile row', () => {
  it('puts thirteen equal tiles across the phone figure, 27.4 px each, which take no taps', () => {
    const row = tileRow(PHONE_W, PHONE_H, A3_S, A4_S, 0)
    expect(row.tileW).toBeCloseTo(27.4, 1)
    expect(tilesTakeTaps(row)).toBe(false)
  })

  it('closes up on B3 to F4 for step 5: seven tiles of 50.9 px, each a target, and still 44 px from a 342 px phone', () => {
    const row = tileRow(PHONE_W, PHONE_H, B3_S, F4_S, 0)
    expect(row.tileW).toBeCloseTo(50.9, 1)
    expect(tilesTakeTaps(row)).toBe(true)
    expect(tilesTakeTaps(tileRow(342, PHONE_H, B3_S, F4_S, 0))).toBe(true)
  })

  it('takes taps on the desktop stage, where the octave tiles are about 48 px', () => {
    // the stage's canvas at 1440 x 900 is 650 px wide; the row keeps 12 px each side
    const row = tileRow(650, 378, A3_S, A4_S, 12)
    expect(row.tileW).toBeCloseTo(48, 0)
    expect(tilesTakeTaps(row)).toBe(true)
  })

  it('glides each key from its place on the keyboard to its tile', () => {
    const kb = keysLayout(PHONE_W, PHONE_H, true, 0)
    const row = tileRow(PHONE_W, PHONE_H, A3_S, A4_S, 0)
    const cSharp = 61 - LO
    const same = (a: Rect, b: Rect): void => {
      for (const k of ['x', 'y', 'w', 'h'] as const)
        expect(a[k]).toBeCloseTo(b[k], 9)
    }
    same(glideRect(kb, row, cSharp, 0), keyRect(kb, cSharp))
    same(glideRect(kb, row, cSharp, 1), tileRect(row, cSharp))
    // halfway, a black key is as deep as halfway between its key and its tile
    const half = glideRect(kb, row, cSharp, 0.5)
    expect(half.h).toBeCloseTo((kb.bH + row.h) / 2, 6)
  })
})
