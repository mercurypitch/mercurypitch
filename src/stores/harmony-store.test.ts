import { beforeEach, describe, expect, it } from 'vitest'
import { HARMONY_BESTS_KEY, HARMONY_WAY_KEY, harmonyBeats, harmonyBest, harmonyWay, isHarmonyBestTable, recordHarmonyBest, resetHarmonyStoreForTests, setHarmonyWay, } from './harmony-store'

const best = (inHarmony: number, notesLanded: number) => ({
  inHarmony,
  lines: 6,
  notesLanded,
  notes: 24,
  at: 1,
})

describe("Harmony's records", () => {
  beforeEach(() => {
    localStorage.removeItem(HARMONY_BESTS_KEY)
    localStorage.removeItem(HARMONY_WAY_KEY)
    resetHarmonyStoreForTests()
  })

  it('beats on more lines in harmony, then on more notes', () => {
    expect(harmonyBeats(best(0, 0), null)).toBe(false)
    expect(harmonyBeats(best(0, 3), null)).toBe(true)
    expect(harmonyBeats(best(4, 20), best(3, 23))).toBe(true)
    expect(harmonyBeats(best(4, 21), best(4, 20))).toBe(true)
    expect(harmonyBeats(best(4, 20), best(4, 20))).toBe(false)
  })

  it('keeps a best per level, and says when it improved', () => {
    expect(recordHarmonyBest('singer', best(3, 18))).toEqual({
      previous: null,
      improved: false,
    })
    expect(recordHarmonyBest('singer', best(4, 20)).improved).toBe(true)
    expect(recordHarmonyBest('singer', best(2, 23)).improved).toBe(false)
    expect(harmonyBest('singer')?.inHarmony).toBe(4)
    expect(harmonyBest('learning')).toBeNull()
  })

  it('reads back only a table it would write', () => {
    expect(isHarmonyBestTable({ singer: best(3, 20) })).toBe(true)
    expect(isHarmonyBestTable({ maestro: best(3, 20) })).toBe(false)
    expect(
      isHarmonyBestTable({ singer: { ...best(3, 20), inHarmony: 9 } }),
    ).toBe(false)
    expect(
      isHarmonyBestTable({ singer: { ...best(3, 20), notesLanded: 30 } }),
    ).toBe(false)
    expect(isHarmonyBestTable([])).toBe(false)
  })

  it('keeps the way the singer sings, taking turns until they choose', () => {
    expect(harmonyWay()).toBe('turns')
    setHarmonyWay('together')
    resetHarmonyStoreForTests()
    expect(harmonyWay()).toBe('together')
  })
})
