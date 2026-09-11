// What each Top Shelf room keeps of its best run.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { ShelfStats } from '../sim/shelf-grade'
import { keepBest, readStats, SHELF_STATS_KEY, writeStats } from './shelf-stats'

const run = (pct: number, overshootCents = 0): ShelfStats => ({
  pct,
  overshootCents,
  firstTry: 1,
  shelves: 1,
})

/** Storage as a Map, as the Line's stats test stands it up: the test
 * window's own is not a whole Storage. */
const useMapStorage = (): Map<string, string> => {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  })
  return store
}

describe('keeping the best', () => {
  it('keeps a better run, drops a worse one, and a tie keeps the newer', () => {
    const had = keepBest({}, 'shelf-1', run(80, 20))
    expect(keepBest(had, 'shelf-1', run(70))).toBe(had)
    expect(keepBest(had, 'shelf-1', run(80, 5))['shelf-1']).toEqual(run(80, 5))
    expect(keepBest(had, 'shelf-1', run(90))['shelf-1']?.pct).toBe(90)
  })

  it('does not touch other rooms', () => {
    const s = keepBest({ 'shelf-1': run(80) }, 'shelf-2', run(50))
    expect(s['shelf-1']?.pct).toBe(80)
    expect(s['shelf-2']?.pct).toBe(50)
  })
})

describe('reading and writing', () => {
  it('comes back from storage as it went in', () => {
    useMapStorage()
    writeStats({ 'shelf-2': run(75, 30) })
    expect(readStats()).toEqual({ 'shelf-2': run(75, 30) })
  })

  it.each([['not json'], ['null'], ['[]'], ['{"shelf-1":{"pct":"x"}}']])(
    'survives %s',
    (raw) => {
      const store = useMapStorage()
      store.set(SHELF_STATS_KEY, raw)
      expect(readStats()).toEqual({})
    },
  )

  it('keeps only the rooms that are whole', () => {
    const store = useMapStorage()
    store.set(
      SHELF_STATS_KEY,
      JSON.stringify({ 'shelf-1': run(60), 'shelf-2': { pct: 50 } }),
    )
    expect(readStats()).toEqual({ 'shelf-1': run(60) })
  })
})
