// A lesson's set of a drill's items: the five Season 2 asks resolve, each
// on a track of its own with the floor of the pads it shows, and anything
// that does not make a set opens the drill whole.

import { describe, expect, it } from 'vitest'
import { LEAP_BANK } from './banks'
import { GRAVITY_SET } from './item-bank'
import { countWord, listWords, narrowBank, narrowDegreeSet, resolveEarSubset, subsetAnswers, subsetLine, subsetRatingLine, } from './subsets'

const PERFECT_AND_TRITONE = ['leap:P4', 'leap:TT', 'leap:P5', 'leap:P8']

describe('resolveEarSubset', () => {
  it("takes Leap's four to a track of their own, with a floor of a quarter", () => {
    const subset = resolveEarSubset('leap', PERFECT_AND_TRITONE)

    expect(subset).toEqual({
      drillId: 'leap',
      itemIds: PERFECT_AND_TRITONE,
      trackId: 'leap:set:leap:P4,leap:TT,leap:P5,leap:P8',
      guessRate: 1 / 4,
    })
  })

  it("floors Subdivide's four bars on their two metres, not on the bars", () => {
    const subset = resolveEarSubset('subdivide', [
      'metre:3-4:a',
      'metre:3-4:b',
      'metre:6-8:a',
      'metre:6-8:b',
    ])

    expect(subset?.guessRate).toBe(1 / 2)
    expect(subset === null ? [] : subsetAnswers(subset)).toEqual(['3/4', '6/8'])
  })

  it('gives The Chart no floor: its answer is tapped back, not picked', () => {
    const subset = resolveEarSubset('chart', ['c-q3', 'c-e-and'])

    expect(subset?.guessRate).toBe(0)
  })

  it("lists a set in the bank's order, each item once", () => {
    const subset = resolveEarSubset('stack', [
      'stack:dom7',
      'stack:maj',
      'stack:dom7',
    ])

    expect(subset?.itemIds).toEqual(['stack:maj', 'stack:dom7'])
    expect(subset?.trackId).toBe('stack:set:stack:maj,stack:dom7')
  })

  it('opens the drill whole for anything that is not a set of it', () => {
    // No items, a drill no set narrows, an id the bank lacks, an id of
    // another drill's bank, one answer, and every item of the drill.
    const asks: Array<[string, readonly string[] | undefined]> = [
      ['leap', undefined],
      ['leap', []],
      ['hairline', ['leap:P4', 'leap:P5']],
      ['leap', ['leap:P4', 'leap:P11']],
      ['leap', ['stack:maj', 'leap:P5']],
      ['leap', ['leap:P4']],
      ['subdivide', ['metre:3-4:a', 'metre:3-4:b']],
      ['leap', LEAP_BANK.map((item) => item.itemId)],
      ['constructor', ['leap:P4', 'leap:P5']],
    ]

    expect(
      asks.map(([drill, items]) => resolveEarSubset(drill, items)),
    ).toEqual(asks.map(() => null))
  })

  it("never shares a track with the drill's own rating or another set's", () => {
    const tracks = [
      resolveEarSubset('leap', PERFECT_AND_TRITONE)?.trackId,
      resolveEarSubset('leap', ['leap:m2', 'leap:M2'])?.trackId,
      resolveEarSubset('gravity', ['gravity:deg-11', 'gravity:deg-12'])
        ?.trackId,
    ]

    expect(new Set(tracks).size).toBe(3)
    expect(tracks).not.toContain('leap')
    expect(tracks).not.toContain('gravity')
  })
})

describe('a set narrowed', () => {
  it("keeps a bank's items in the set, and the whole bank without one", () => {
    const subset = resolveEarSubset('leap', ['leap:P8', 'leap:P4'])

    expect(narrowBank(LEAP_BANK, subset).map((item) => item.label)).toEqual([
      'P4',
      'P8',
    ])
    expect(narrowBank(LEAP_BANK, null)).toBe(LEAP_BANK)
  })

  it("gives Gravity's Te and Ti two pads, the set's two tracks and the twelve whole", () => {
    const subset = resolveEarSubset('gravity', [
      'gravity:deg-11',
      'gravity:deg-12',
    ])
    if (subset === null) throw new Error('Te and Ti are a set')

    const set = narrowDegreeSet(GRAVITY_SET, subset)

    expect(set.degrees.map((degree) => degree.solfege)).toEqual(['Te', 'Ti'])
    expect(set.choices).toBe(2)
    expect(set.tapDrillId).toBe(subset.trackId)
    expect(set.micDrillId).toBe(`${subset.trackId}:sing`)
    expect(set.whole).toHaveLength(12)
    // The items keep the drill's ids, so a set reads their difficulties.
    expect(set.itemId(11)).toBe('gravity:deg-11')
  })
})

describe("the bench's words for a set", () => {
  it('says what the set asks, and what it leaves alone', () => {
    expect(subsetLine(['P4', 'TT', 'P5', 'P8'], 12)).toBe(
      'Only P4, TT, P5 and P8 this time, four of the twelve.',
    )
    expect(subsetLine(['3/4', '6/8'], 5, 'metres')).toBe(
      'Only 3/4 and 6/8 this time, two of the five metres.',
    )
    expect(subsetRatingLine('Leap')).toBe(
      'Rated on their own: your Leap rating stays as it is.',
    )
  })

  it('counts and lists in words', () => {
    expect([countWord(2), countWord(15), countWord(16)]).toEqual([
      'two',
      'fifteen',
      '16',
    ])
    expect(listWords(['triplets', 'sixteenths'], 'or')).toBe(
      'triplets or sixteenths',
    )
    expect(listWords(['one'])).toBe('one')
  })
})
