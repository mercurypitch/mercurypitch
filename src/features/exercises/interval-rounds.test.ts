// ============================================================
// The draw of a launch's own intervals, one per round
// ============================================================
//
// Interval Trainer and Drone Intonation deal a launch's list with this one
// draw. The list sets the run's intervals, not its length: two intervals
// still make a run as long as the difficulty asks for, so they repeat, but
// never one twice running, and a run at least as long as the list plays
// every one of them.
//
// The draw is random, so the properties are checked over many fixed seeds
// (seededRandom), never over Math.random's luck: a failure names its seed
// and replays exactly.

import { describe, expect, it } from 'vitest'
import { seededRandom } from '@/lib/sequence/phrase-bank'
import { drawIntervalRounds } from './interval-rounds'

/** Lesson 9's leaps: minor and major thirds, the fifth, the fourth, the octave. */
const LEAP_LADDER = [3, 4, 7, 5, 12]
/** Lesson 6's proposed fourths and fifths. */
const FOURTH_AND_FIFTH = [5, 7]
const LISTS = [FOURTH_AND_FIFTH, [3, 4, 12], LEAP_LADDER]
const SEEDS = Array.from({ length: 200 }, (_unused, i) => i + 1)

/** Every place a draw deals the same interval twice running. */
function repeatsIn(drawn: readonly number[]): number[] {
  return drawn.flatMap((s, i) => (i > 0 && s === drawn[i - 1] ? [i] : []))
}

describe('drawIntervalRounds', () => {
  it('deals the run its exact length from the list', () => {
    const drawn = drawIntervalRounds(LEAP_LADDER, 8, seededRandom(1))

    expect(drawn).toHaveLength(8)
    expect(drawn.every((s) => LEAP_LADDER.includes(s))).toBe(true)
  })

  it('deals a fractional round count as its whole rounds, and returns', () => {
    // Looping to 2.5 itself never ended: the run can only ever hold 2 or 3.
    const drawn = drawIntervalRounds(FOURTH_AND_FIFTH, 2.5, seededRandom(1))

    expect(drawn).toHaveLength(2)
  })

  it('plays every interval of the list when the run is at least as long as the list', () => {
    const misses: string[] = []
    for (const list of LISTS) {
      for (let rounds = list.length; rounds <= 3 * list.length; rounds++) {
        for (const seed of SEEDS) {
          const dealt = new Set(
            drawIntervalRounds(list, rounds, seededRandom(seed)),
          )
          if (dealt.size !== list.length) {
            misses.push(`${list.join(',')} x${rounds} seed ${seed}`)
          }
        }
      }
    }

    expect(misses).toEqual([])
  })

  it('never deals the same interval twice running', () => {
    const repeats: string[] = []
    for (const list of LISTS) {
      for (let rounds = 2; rounds <= 20; rounds++) {
        for (const seed of SEEDS) {
          const drawn = drawIntervalRounds(list, rounds, seededRandom(seed))
          if (repeatsIn(drawn).length > 0) {
            repeats.push(`${list.join(',')} x${rounds} seed ${seed}`)
          }
        }
      }
    }

    expect(repeats).toEqual([])
  })

  it('spreads the repeats evenly, no interval a third time before every one has come twice', () => {
    const uneven: string[] = []
    for (const list of LISTS) {
      for (let rounds = 1; rounds <= 20; rounds++) {
        for (const seed of SEEDS) {
          const drawn = drawIntervalRounds(list, rounds, seededRandom(seed))
          const counts = list.map((s) => drawn.filter((d) => d === s).length)
          if (Math.max(...counts) - Math.min(...counts) > 1) {
            uneven.push(`${list.join(',')} x${rounds} seed ${seed}`)
          }
        }
      }
    }

    expect(uneven).toEqual([])
  })

  it('moves an opener that would repeat to either later place of its bag, as often as not', () => {
    // The first bag of [3, 4, 12] is rounds 0-2; the next bag cannot open on
    // round 2's interval, so that interval lands in its place 1 or 2. Every
    // valid order is as likely as any other, so each place takes half of the
    // runs. Always trading with place 1 still reaches place 2 (from bags
    // that never needed the trade), but leans to place 1, two runs in three.
    const places = SEEDS.map((seed) => {
      const drawn = drawIntervalRounds([3, 4, 12], 6, seededRandom(seed))
      return drawn.slice(3).indexOf(drawn[2])
    })

    const inPlace1 = places.filter((p) => p === 1).length
    const inPlace2 = places.filter((p) => p === 2).length

    expect(inPlace1 + inPlace2).toBe(SEEDS.length)
    expect(inPlace1 / SEEDS.length).toBeGreaterThan(0.4)
    expect(inPlace2 / SEEDS.length).toBeGreaterThan(0.4)
  })

  it('deals a run shorter than the list from distinct intervals', () => {
    const drawn = drawIntervalRounds(LEAP_LADDER, 4, seededRandom(7))

    expect(new Set(drawn).size).toBe(4)
    expect(drawn.every((s) => LEAP_LADDER.includes(s))).toBe(true)
  })

  it('treats a repeated entry in the list as one interval', () => {
    const repeats: number[] = []
    for (const seed of SEEDS) {
      repeats.push(
        ...repeatsIn(drawIntervalRounds([5, 5, 7], 12, seededRandom(seed))),
      )
    }

    expect(repeats).toEqual([])
  })

  it('plays a one-interval list every round, having nothing to alternate with', () => {
    const drawn = drawIntervalRounds([12], 6, seededRandom(3))

    expect(drawn).toEqual([12, 12, 12, 12, 12, 12])
  })

  it('deals nothing from an empty list', () => {
    const drawn = drawIntervalRounds([], 6, seededRandom(3))

    expect(drawn).toEqual([])
  })
})
