import { describe, expect, it } from 'vitest'
import { NG_SLIDES_LEVELS } from './glide-presets'
import type { NgBest, NgBestTable } from './ng-bests'
import { isNgBestTable, mergeNgBestsOnPull, mergeNgBestTables, NG_BEST_LEVELS, ngBeats, } from './ng-bests'

const run = (lit: number, jumps = 0, at = 1): NgBest => ({
  lit,
  arches: 3,
  jumps,
  at,
})

describe('NG_BEST_LEVELS', () => {
  it('names every level the presets have, and no other', () => {
    expect([...NG_BEST_LEVELS].sort()).toEqual(
      Object.keys(NG_SLIDES_LEVELS).sort(),
    )
  })
})

describe('ngBeats', () => {
  it('takes more of the bridge lit over fewer jumps', () => {
    expect(ngBeats(run(80, 3), run(79, 0))).toBe(true)
    expect(ngBeats(run(79, 0), run(80, 3))).toBe(false)
  })

  it('breaks a tie on the lit share by fewer jumps', () => {
    expect(ngBeats(run(80, 1), run(80, 2))).toBe(true)
    expect(ngBeats(run(80, 2), run(80, 2))).toBe(false)
  })

  it('beats nothing on a first run', () => {
    expect(ngBeats(run(0, 4), null)).toBe(true)
  })
})

describe('isNgBestTable', () => {
  it('reads a table keyed by the tier ids', () => {
    expect(isNgBestTable({ singer: run(88) })).toBe(true)
    expect(isNgBestTable({})).toBe(true)
  })

  it('refuses another key, a share over 100 and a fractional count', () => {
    expect(isNgBestTable({ beginner: run(50) })).toBe(false)
    expect(isNgBestTable({ singer: run(101) })).toBe(false)
    expect(isNgBestTable({ singer: { ...run(50), jumps: 1.5 } })).toBe(false)
    expect(isNgBestTable([run(50)])).toBe(false)
    expect(isNgBestTable(null)).toBe(false)
  })
})

describe('mergeNgBestTables', () => {
  it('keeps every level from either side, each with its better best', () => {
    const mine: NgBestTable = { learning: run(70), singer: run(60, 0, 5) }
    const theirs: NgBestTable = { singer: run(64, 2, 9), professional: run(40) }
    expect(mergeNgBestTables(mine, theirs)).toEqual({
      learning: run(70),
      singer: run(64, 2, 9),
      professional: run(40),
    })
  })

  it('gives the same table whichever side each came from', () => {
    const a: NgBestTable = { singer: run(64, 1, 3) }
    const b: NgBestTable = { singer: run(64, 1, 2) }
    expect(mergeNgBestTables(a, b)).toEqual(mergeNgBestTables(b, a))
    expect(mergeNgBestTables(a, b).singer?.at).toBe(2)
  })
})

describe('mergeNgBestsOnPull', () => {
  it('sends back an unchanged side as its own string', () => {
    const cloud = JSON.stringify({ singer: run(70) })
    const local = JSON.stringify({ singer: run(60) })
    expect(mergeNgBestsOnPull(local, cloud)).toBe(cloud)
    expect(mergeNgBestsOnPull(cloud, local)).toBe(cloud)
  })

  it('writes the merge when each side holds a level the other lacks', () => {
    const local = JSON.stringify({ learning: run(50) })
    const cloud = JSON.stringify({ singer: run(70) })
    expect(JSON.parse(mergeNgBestsOnPull(local, cloud))).toEqual({
      learning: run(50),
      singer: run(70),
    })
  })

  it('gives way to the side that reads', () => {
    const good = JSON.stringify({ singer: run(70) })
    expect(mergeNgBestsOnPull(null, good)).toBe(good)
    expect(mergeNgBestsOnPull('not json', good)).toBe(good)
    expect(mergeNgBestsOnPull(good, '{"singer":1}')).toBe(good)
  })
})
