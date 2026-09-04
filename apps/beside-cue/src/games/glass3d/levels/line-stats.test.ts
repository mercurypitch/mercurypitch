// Does a room keep its best run, and survive what storage hands back?
// ============================================================

import { describe, expect, it } from 'vitest'
import { keepBest, LINE_STATS_KEY, readStats } from './line-stats'

const run = (pct: number) => ({
  pct,
  overshootCents: 40,
  firstTry: 1,
  gates: 2,
  drops: 0,
})

describe('keeping the best', () => {
  it('keeps a better run and drops a worse one', () => {
    let s = keepBest({}, 'line-1', run(70))
    s = keepBest(s, 'line-1', run(90))
    expect(s['line-1']!.pct).toBe(90)
    s = keepBest(s, 'line-1', run(60))
    expect(s['line-1']!.pct).toBe(90)
  })

  it('keeps a tie, being the newer run', () => {
    const s = keepBest({ 'line-1': run(80) }, 'line-1', {
      ...run(80),
      drops: 3,
    })
    expect(s['line-1']!.drops).toBe(3)
  })

  it('does not touch other rooms', () => {
    const s = keepBest({ 'line-1': run(80) }, 'line-2', run(50))
    expect(s['line-1']!.pct).toBe(80)
    expect(s['line-2']!.pct).toBe(50)
  })
})

describe('reading', () => {
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

  it.each([
    ['not json'],
    ['null'],
    ['[]'],
    ['{"line-1":{"pct":"x"}}'],
    ['{"line-1":7}'],
  ])('survives %s', (raw) => {
    const store = useMapStorage()
    store.set(LINE_STATS_KEY, raw)
    expect(readStats()).toEqual({})
  })

  it('keeps only the rooms that are whole', () => {
    const store = useMapStorage()
    store.set(
      LINE_STATS_KEY,
      JSON.stringify({ 'line-1': run(80), 'line-2': { pct: 50 } }),
    )
    expect(Object.keys(readStats())).toEqual(['line-1'])
  })
})
