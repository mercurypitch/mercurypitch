// The going train lights from the store and never gates: every orb has
// an instrument to open, the next one is simply the first dark orb.

import { describe, expect, it } from 'vitest'
import type { PathSnapshot } from './path'
import { earPath, nextOnPath, pathCount, REGULATION_DAYS } from './path'

function snapshot(overrides: Partial<PathSnapshot> = {}): PathSnapshot {
  return {
    attempted: new Set<string>(),
    seals: [],
    regulationDays: 0,
    ...overrides,
  }
}

describe('earPath', () => {
  it('starts with eleven dark orbs and points at the first reading', () => {
    const path = earPath(snapshot())
    expect(path).toHaveLength(11)
    expect(path.every((m) => !m.lit)).toBe(true)
    expect(pathCount(path)).toEqual({ lit: 0, of: 11 })
    expect(nextOnPath(path)?.id).toBe('first-reading')
    expect(nextOnPath(path)?.view).toBe('hairline')
    expect(new Set(path.map((m) => m.id)).size).toBe(11)
  })

  it('lights the first reading from any drill and moves on to the seal', () => {
    const path = earPath(snapshot({ attempted: new Set(['stack']) }))
    expect(path[0]?.lit).toBe(true)
    expect(nextOnPath(path)?.id).toBe('first-seal')
    expect(nextOnPath(path)?.view).toBe('calibration')
  })

  it('lights a faculty orb only from a seal that carried it', () => {
    const path = earPath(
      snapshot({
        attempted: new Set(['hairline']),
        seals: [['resolution', 'function']],
      }),
    )
    const lit = path.filter((m) => m.lit).map((m) => m.id)
    expect(lit).toEqual([
      'first-reading',
      'first-seal',
      'sealed-resolution',
      'sealed-function',
    ])
    expect(nextOnPath(path)?.id).toBe('sealed-shape')
    expect(nextOnPath(path)?.view).toBe('contour')
  })

  it('does not gate: later orbs light while earlier ones stay dark', () => {
    const path = earPath(
      snapshot({
        attempted: new Set(['desk-weight', 'wild-echo', 'subdivide']),
      }),
    )
    const byId = Object.fromEntries(path.map((m) => [m.id, m.lit]))
    expect(byId['first-reading']).toBe(true)
    expect(byId['first-seal']).toBe(false)
    expect(byId['first-rhythm']).toBe(true)
    expect(byId['first-wild']).toBe(true)
    expect(byId['first-desk']).toBe(true)
    expect(nextOnPath(path)?.id).toBe('first-seal')
  })

  it('counts the month of regulation and lights it at thirty', () => {
    const twelve = earPath(snapshot({ regulationDays: 12 }))
    const month = twelve[twelve.length - 1]
    expect(month?.id).toBe('regulation')
    expect(month?.lit).toBe(false)
    expect(month?.progress).toEqual({ done: 12, of: REGULATION_DAYS })

    const forty = earPath(snapshot({ regulationDays: 40 }))
    const done = forty[forty.length - 1]
    expect(done?.lit).toBe(true)
    expect(done?.progress).toEqual({
      done: REGULATION_DAYS,
      of: REGULATION_DAYS,
    })
  })

  it('has no next orb once the train is complete', () => {
    const path = earPath(
      snapshot({
        attempted: new Set(['hairline', 'pulse', 'wild-home', 'desk-colour']),
        seals: [['resolution', 'function', 'shape', 'colour', 'time']],
        regulationDays: 30,
      }),
    )
    expect(pathCount(path)).toEqual({ lit: 11, of: 11 })
    expect(nextOnPath(path)).toBeNull()
  })
})
