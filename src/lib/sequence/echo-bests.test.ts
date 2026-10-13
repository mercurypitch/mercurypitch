import { describe, expect, it } from 'vitest'
import type { EchoBest, EchoBestTable } from './echo-bests'
import { ECHO_BEST_LEVELS, echoBeats, isEchoBestTable, mergeEchoBestsOnPull, mergeEchoBestTables, } from './echo-bests'
import { ECHO_LEVELS } from './sequence-engine'

const run = (landed: number, accuracy: number | null, at = 1): EchoBest => ({
  landed,
  notes: 20,
  accuracy,
  at,
})

describe('ECHO_BEST_LEVELS', () => {
  it('names every level the engine has, and no other', () => {
    expect([...ECHO_BEST_LEVELS].sort()).toEqual(
      Object.keys(ECHO_LEVELS).sort(),
    )
  })
})

describe('echoBeats', () => {
  it('takes more notes landed over a higher accuracy', () => {
    expect(echoBeats(run(18, 70), run(17, 95))).toBe(true)
    expect(echoBeats(run(17, 95), run(18, 70))).toBe(false)
  })

  it('breaks a tie on landed notes by a whole point of accuracy', () => {
    expect(echoBeats(run(18, 90), run(18, 88.5))).toBe(true)
    expect(echoBeats(run(18, 89), run(18, 88.5))).toBe(false)
  })

  it('beats nothing on a first run', () => {
    expect(echoBeats(run(0, null), null)).toBe(true)
  })
})

describe('isEchoBestTable', () => {
  it('reads a table keyed by the tier ids', () => {
    expect(isEchoBestTable({ singer: run(18, 88) })).toBe(true)
    expect(isEchoBestTable({})).toBe(true)
  })

  it('refuses a level it does not know, a broken row and a non-object', () => {
    expect(isEchoBestTable({ beginner: run(3, 80) })).toBe(false)
    expect(isEchoBestTable({ singer: { ...run(3, 80), landed: 21 } })).toBe(
      false,
    )
    expect(isEchoBestTable({ singer: { ...run(3, 80), accuracy: 'x' } })).toBe(
      false,
    )
    expect(isEchoBestTable([run(3, 80)])).toBe(false)
    expect(isEchoBestTable(null)).toBe(false)
  })
})

describe('mergeEchoBestTables', () => {
  it('keeps every level from either side, each with the better best', () => {
    const mine: EchoBestTable = {
      singer: run(18, 80, 5),
      learning: run(12, 90),
    }
    const theirs: EchoBestTable = {
      singer: run(19, 70, 9),
      professional: run(20, 60),
    }
    expect(mergeEchoBestTables(mine, theirs)).toEqual({
      learning: run(12, 90),
      singer: run(19, 70, 9),
      professional: run(20, 60),
    })
  })

  it('keeps the earlier run on a tie, whichever side it came from', () => {
    const early = run(18, 80, 1)
    const late = run(18, 80, 2)
    expect(
      mergeEchoBestTables({ singer: late }, { singer: early }).singer,
    ).toBe(early)
    expect(
      mergeEchoBestTables({ singer: early }, { singer: late }).singer,
    ).toBe(early)
  })
})

describe('mergeEchoBestsOnPull', () => {
  it('returns the account side unchanged when it already holds the merge', () => {
    const cloud = JSON.stringify({ singer: run(19, 80) })
    expect(
      mergeEchoBestsOnPull(JSON.stringify({ singer: run(18, 90) }), cloud),
    ).toBe(cloud)
  })

  it('returns the device side unchanged when it holds the merge', () => {
    const local = JSON.stringify({ singer: run(19, 80), learning: run(12, 70) })
    expect(
      mergeEchoBestsOnPull(local, JSON.stringify({ singer: run(18, 90) })),
    ).toBe(local)
  })

  it('writes the merged table when each side has a level the other lacks', () => {
    const merged = mergeEchoBestsOnPull(
      JSON.stringify({ singer: run(19, 80) }),
      JSON.stringify({ professional: run(20, 60) }),
    )
    expect(JSON.parse(merged)).toEqual({
      singer: run(19, 80),
      professional: run(20, 60),
    })
  })

  it('gives way to the side that reads', () => {
    const cloud = JSON.stringify({ singer: run(19, 80) })
    expect(mergeEchoBestsOnPull('not json', cloud)).toBe(cloud)
    expect(mergeEchoBestsOnPull(null, cloud)).toBe(cloud)
    const local = JSON.stringify({ singer: run(19, 80) })
    expect(mergeEchoBestsOnPull(local, '{"singer":7}')).toBe(local)
  })
})
