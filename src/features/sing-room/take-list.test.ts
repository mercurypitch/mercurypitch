// ============================================================
// The takes list is the store's order, reversed exactly once
// ============================================================

import { describe, expect, it } from 'vitest'
import type { SingTake } from '@/stores/sing-takes-store'
import { singTakeRow, singTakeRows } from './take-list'

function take(overrides: Partial<SingTake> = {}): SingTake {
  return {
    id: 'take-1',
    startedAt: new Date(2026, 8, 2, 9, 38).getTime(),
    endedAt: new Date(2026, 8, 2, 9, 41).getTime(),
    durationMs: 182_000,
    takeNumber: 1,
    lowNote: 'D3',
    highNote: 'A4',
    heldWithinCents: 12,
    ...overrides,
  }
}

describe('a take row', () => {
  it('dates it, times it, and says the same four numbers the card did', () => {
    const row = singTakeRow(take())
    expect(row.when).toBe('2 September 2026, 9:41')
    expect(row.duration).toBe('3 min')
    expect(row.range).toBe('D3 to A4')
    expect(row.held).toBe('12 cents')
  })

  it('says a dash for a take that held nothing long enough', () => {
    const row = singTakeRow(take({ lowNote: null, highNote: null }))
    expect(row.range).toBe('—')
    // …and the spoken line simply leaves the clause out rather than reading
    // an em dash aloud.
    expect(row.announce).toBe('2 September 2026, 9:41, 3 min, held within 12 cents')
  })

  it("carries the store's id, because that is what Remove is called with", () => {
    expect(singTakeRow(take({ id: 'abc-2' })).id).toBe('abc-2')
  })

  it('survives a broken timestamp rather than showing NaN', () => {
    expect(singTakeRow(take({ endedAt: Number.NaN })).when).toBe('')
  })
})

describe('the list', () => {
  it('is newest first — the store keeps them the other way round', () => {
    const rows = singTakeRows([
      take({ id: 'first' }),
      take({ id: 'second' }),
      take({ id: 'third' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['third', 'second', 'first'])
  })

  it('does not mutate what it was handed', () => {
    const takes = [take({ id: 'a' }), take({ id: 'b' })]
    singTakeRows(takes)
    expect(takes.map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('is empty for an empty store', () => {
    expect(singTakeRows([])).toEqual([])
  })
})
