import { describe, expect, it } from 'vitest'
import type { BestTable } from './hold-bests'
import { mergeBestsOnPull, mergeBestTables } from './hold-bests'

const best = (inBandSeconds: number, steadiness: number, at: number) => ({
  inBandSeconds,
  steadiness,
  at,
})

describe('mergeBestTables', () => {
  it('keeps every note from either side, each with its better best', () => {
    const phone: BestTable = { 57: best(20, 80, 1), 52: best(6, 60, 5) }
    const tablet: BestTable = { 57: best(12, 90, 2), 60: best(15, 70, 3) }
    expect(mergeBestTables(phone, tablet)).toEqual({
      52: best(6, 60, 5),
      57: best(20, 80, 1),
      60: best(15, 70, 3),
    })
  })

  it('lands on the same table whichever side is the device', () => {
    const tables: BestTable[] = [
      { 57: best(10.02, 80, 1) },
      // A tie on the shown tenth: steadiness decides.
      { 57: best(10.04, 85, 2) },
      // A full tie: the earlier run stands.
      { 57: best(10.04, 85, 1) },
      { 57: best(9, 99, 3), 59: best(4, 50, 3) },
      {},
    ]
    for (const a of tables) {
      for (const b of tables) {
        expect(JSON.stringify(mergeBestTables(a, b))).toBe(
          JSON.stringify(mergeBestTables(b, a)),
        )
      }
    }
    expect(mergeBestTables(tables[1], tables[2])[57]).toEqual(
      best(10.04, 85, 1),
    )
  })
})

describe('mergeBestsOnPull', () => {
  const phone = JSON.stringify({ 57: best(20, 80, 1) })
  const account = JSON.stringify({ 57: best(12, 90, 2), 60: best(15, 70, 3) })

  it('returns a side unchanged when it already holds the merge', () => {
    const behind = JSON.stringify({ 57: best(8, 80, 1) })
    expect(mergeBestsOnPull(behind, account)).toBe(account)
    expect(mergeBestsOnPull(account, behind)).toBe(account)
    expect(mergeBestsOnPull(null, account)).toBe(account)
  })

  it('writes the merge when each side has a best the other lacks', () => {
    expect(JSON.parse(mergeBestsOnPull(phone, account))).toEqual({
      57: best(20, 80, 1),
      60: best(15, 70, 3),
    })
  })

  it('gives way to the side that reads, the account when neither does', () => {
    expect(mergeBestsOnPull('not json', account)).toBe(account)
    expect(mergeBestsOnPull(phone, '[1]')).toBe(phone)
    expect(mergeBestsOnPull('{', '[1]')).toBe('[1]')
  })
})
