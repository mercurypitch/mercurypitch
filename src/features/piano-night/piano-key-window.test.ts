// The keys and the notes that fall onto them must agree on where a key is.
// ============================================================
//
// The reported symptom was "when I change the octave the falling notes still
// show the same locations". They did: the fall stage divided MIDI by 87 across
// the whole instrument and never read the touch window at all, so on a phone
// a note sat roughly a key to the left of its own key and the arrows moved
// nothing. These pin the geometry both sides now share.

import { describe, expect, it } from 'vitest'
import { FULL_KEY_WINDOW, isInKeyWindow, keyCenterPercent, MOBILE_RANGE_STARTS, mobileKeyWindow, PIANO_FIRST_MIDI, PIANO_KEYS, PIANO_LAST_MIDI, } from './piano-key-window'

describe('the instrument', () => {
  it('is 88 keys, 52 of them white', () => {
    expect(PIANO_KEYS).toHaveLength(88)
    expect(PIANO_KEYS.filter((key) => !key.black)).toHaveLength(52)
    expect(PIANO_KEYS[0]?.midi).toBe(PIANO_FIRST_MIDI)
    expect(PIANO_KEYS.at(-1)?.midi).toBe(PIANO_LAST_MIDI)
  })

  it('starts on a white A0 and ends on a white C8', () => {
    expect(PIANO_KEYS[0]).toEqual({ midi: 21, whiteIndex: 0, black: false })
    expect(PIANO_KEYS.at(-1)).toEqual({
      midi: 108,
      whiteIndex: 51,
      black: false,
    })
  })

  it('gives a black key the index of the white key it fronts', () => {
    // A#0 straddles the boundary between A0 (0) and B0 (1).
    expect(PIANO_KEYS[1]).toEqual({ midi: 22, whiteIndex: 1, black: true })
  })
})

describe('the touch window', () => {
  it('spans two octaves from each range start', () => {
    for (const [index, start] of MOBILE_RANGE_STARTS.entries()) {
      expect(mobileKeyWindow(index)).toEqual({
        startMidi: start,
        endMidi: start + 24,
      })
    }
  })

  it('clamps a range index that is off either end', () => {
    expect(mobileKeyWindow(-4)).toEqual(mobileKeyWindow(0))
    expect(mobileKeyWindow(99)).toEqual(
      mobileKeyWindow(MOBILE_RANGE_STARTS.length - 1),
    )
  })

  it('holds both of its ends', () => {
    const window = mobileKeyWindow(1)
    expect(isInKeyWindow(window.startMidi, window)).toBe(true)
    expect(isInKeyWindow(window.endMidi, window)).toBe(true)
    expect(isInKeyWindow(window.startMidi - 1, window)).toBe(false)
    expect(isInKeyWindow(window.endMidi + 1, window)).toBe(false)
  })
})

describe('where a key sits', () => {
  it('centres each white key in its own equal share of the width', () => {
    // 52 white keys across the full board: C4 is the 24th, so its centre is
    // 23.5/52. The old fall-stage formula gave (60 - 21) / 87 = 44.83%.
    expect(keyCenterPercent(60, FULL_KEY_WINDOW)).toBeCloseTo(
      (23.5 / 52) * 100,
      6,
    )
    expect(keyCenterPercent(21, FULL_KEY_WINDOW)).toBeCloseTo(
      (0.5 / 52) * 100,
      6,
    )
    expect(keyCenterPercent(108, FULL_KEY_WINDOW)).toBeCloseTo(
      (51.5 / 52) * 100,
      6,
    )
  })

  it('centres a black key on the boundary it straddles', () => {
    // C#4 sits between C4 (white 23) and D4 (white 24), so on 24/52.
    expect(keyCenterPercent(61, FULL_KEY_WINDOW)).toBeCloseTo(
      (24 / 52) * 100,
      6,
    )
  })

  it('re-spreads the keys when the window narrows', () => {
    const window = mobileKeyWindow(1) // C3-C5, 15 white keys
    // C4 is the 8th white key of that window, so 7.5/15 — the middle.
    expect(keyCenterPercent(60, window)).toBeCloseTo(50, 6)
    expect(keyCenterPercent(48, window)).toBeCloseTo((0.5 / 15) * 100, 6)
    expect(keyCenterPercent(72, window)).toBeCloseTo((14.5 / 15) * 100, 6)
  })

  it('moves a key when the window steps, which is the whole point', () => {
    const low = keyCenterPercent(60, mobileKeyWindow(1))
    const high = keyCenterPercent(60, mobileKeyWindow(2))
    expect(low).not.toBeCloseTo(high ?? 0, 3)
    // C4 opens the C4-C6 window, so it moves from the middle to the left edge.
    expect(high).toBeCloseTo((0.5 / 15) * 100, 6)
  })

  it('has nowhere to put a note the window does not show', () => {
    expect(keyCenterPercent(36, mobileKeyWindow(2))).toBeNull()
    expect(keyCenterPercent(96, mobileKeyWindow(0))).toBeNull()
  })

  it('has nowhere to put a note that is not on the instrument', () => {
    expect(keyCenterPercent(20, FULL_KEY_WINDOW)).toBeNull()
    expect(keyCenterPercent(109, FULL_KEY_WINDOW)).toBeNull()
  })

  it('keeps every key inside the stage, in ascending order', () => {
    const window = mobileKeyWindow(1)
    let previous = -1
    for (const key of PIANO_KEYS) {
      const x = keyCenterPercent(key.midi, window)
      if (x === null) continue
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(100)
      expect(x).toBeGreaterThan(previous)
      previous = x
    }
  })
})
