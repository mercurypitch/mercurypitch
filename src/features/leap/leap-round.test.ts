import { describe, expect, it } from 'vitest'
import { AUDIBLE_HIGH, AUDIBLE_LOW, leapOrder, pickFrom, planRounds, roundWindow, } from './leap-round'
import type { LeapKind } from './leap-rules'
import { LEAP_LEVELS, LEAP_ROUNDS, leapName, leapSong, sameLeap, } from './leap-rules'

/** A seeded random source, the same run on every test. */
function seeded(seed = 7): () => number {
  let state = seed
  return () => {
    state = (state * 16807) % 2147483647
    return (state - 1) / 2147483646
  }
}

const up = (size: LeapKind['size']): LeapKind => ({ size, up: true })
const down = (size: LeapKind['size']): LeapKind => ({ size, up: false })

describe("Leap's rounds", () => {
  it('takes the singer window, held to what a phone carries', () => {
    expect(roundWindow({ low: 45.4, high: 70.6 })).toEqual({
      low: 48,
      high: 70,
    })
    expect(roundWindow({ low: 60, high: 90 })).toEqual({
      low: 60,
      high: AUDIBLE_HIGH,
    })
    // Nothing known of the singer: F3 to F4.
    expect(roundWindow(null)).toEqual({ low: 53, high: 65 })
    expect(roundWindow({ low: Number.NaN, high: 60 })).toEqual({
      low: 53,
      high: 65,
    })
  })

  it('puts both notes of a leap in the window', () => {
    const random = seeded()
    const window = { low: 55, high: 67 }
    for (const kind of [up(5), up(7), up(9), down(7), down(12), up(12)]) {
      for (let i = 0; i < 40; i++) {
        const from = pickFrom(kind, window, null, random)
        const to = from + (kind.up ? kind.size : -kind.size)
        expect(Math.min(from, to)).toBeGreaterThanOrEqual(window.low)
        expect(Math.max(from, to)).toBeLessThanOrEqual(window.high)
      }
    }
  })

  it('never repeats the note before it while the window leaves a choice', () => {
    const random = seeded(3)
    const window = { low: 55, high: 67 }
    let previous = 58
    for (let i = 0; i < 60; i++) {
      const from = pickFrom(up(5), window, previous, random)
      expect(from).not.toBe(previous)
      previous = from
    }
  })

  it('places a leap wider than the window about its middle, on audible notes', () => {
    const window = { low: 57, high: 62 }
    const from = pickFrom(up(12), window, null, seeded())
    expect(from).toBe(54)
    expect(from + 12).toBe(66)
    // At the band's top, a leap up still fits under it.
    const high = pickFrom(up(12), { low: 74, high: 76 }, null, seeded())
    expect(high + 12).toBeLessThanOrEqual(AUDIBLE_HIGH)
    const low = pickFrom(down(12), { low: 48, high: 50 }, null, seeded())
    expect(low - 12).toBeGreaterThanOrEqual(AUDIBLE_LOW)
  })

  it('asks for each of the level leaps as often as the others, never twice running', () => {
    const order = leapOrder(LEAP_LEVELS.singer.leaps, LEAP_ROUNDS, seeded(5))
    expect(order).toHaveLength(LEAP_ROUNDS)
    for (const kind of LEAP_LEVELS.singer.leaps) {
      expect(order.filter((k) => sameLeap(k, kind))).toHaveLength(2)
    }
    for (let i = 1; i < order.length; i++) {
      expect(sameLeap(order[i], order[i - 1])).toBe(false)
    }
    // Learning's two leaps, three times each.
    const learning = leapOrder(LEAP_LEVELS.learning.leaps, 6, seeded(9))
    expect(learning.filter((k) => k.size === 5)).toHaveLength(3)
    expect(learning.filter((k) => k.size === 7)).toHaveLength(3)
  })

  it('draws six of Professional fourteen leaps, all different', () => {
    const order = leapOrder(LEAP_LEVELS.professional.leaps, 6, seeded(11))
    expect(order).toHaveLength(6)
    const names = new Set(order.map((kind) => leapName(kind)))
    expect(names.size).toBe(6)
  })

  it('plans a run of rounds at the level, each leap its own size', () => {
    const rounds = planRounds(
      LEAP_ROUNDS,
      { low: 52, high: 68 },
      LEAP_LEVELS.learning,
      seeded(),
    )
    expect(rounds.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5])
    for (const round of rounds) {
      expect(round.kind.up).toBe(true)
      expect([5, 7]).toContain(round.kind.size)
      expect(round.to - round.from).toBe(round.kind.size)
    }
  })

  it('names leaps and their songs as Merc does', () => {
    expect(leapName(up(7))).toBe('Up a fifth')
    expect(leapName(down(12))).toBe('Down an octave')
    expect(leapName(up(3))).toBe('Up a minor third')
    expect(leapSong(up(5))?.title).toBe('Here Comes the Bride')
    expect(leapSong(up(7))?.short).toBe('Twinkle, Twinkle')
    expect(leapSong(up(9))?.title).toBe('My Bonnie Lies over the Ocean')
    // A leap down, or a size with no song: none.
    expect(leapSong(down(7))).toBeNull()
    expect(leapSong(up(3))).toBeNull()
  })
})
