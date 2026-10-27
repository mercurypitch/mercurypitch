import { beforeEach, describe, expect, it } from 'vitest'
import type { HomeNoteBest } from './home-note-store'
import { HOME_NOTE_BESTS_KEY, homeNoteBeats, homeNoteBest, isHomeNoteBestTable, recordHomeNoteBest, resetHomeNoteStoreForTests, } from './home-note-store'

function best(found: number, seconds: number, at = 1): HomeNoteBest {
  return { found, rounds: 6, seconds, at }
}

describe("Home note's bests", () => {
  beforeEach(() => {
    localStorage.clear()
    resetHomeNoteStoreForTests()
  })

  it('ranks more keys found first, then the quicker run', () => {
    expect(homeNoteBeats(best(4, 3), null)).toBe(true)
    expect(homeNoteBeats(best(5, 3), best(4, 1))).toBe(true)
    expect(homeNoteBeats(best(4, 1), best(5, 3))).toBe(false)
    expect(homeNoteBeats(best(4, 1.5), best(4, 2))).toBe(true)
    expect(homeNoteBeats(best(4, 2), best(4, 2))).toBe(false)
    // A run that found nothing is never a best.
    expect(homeNoteBeats(best(0, 0), null)).toBe(false)
  })

  it('keeps a best per level, on this device', () => {
    expect(recordHomeNoteBest('singer', best(3, 2))).toEqual({
      previous: null,
      improved: false,
    })
    expect(recordHomeNoteBest('singer', best(5, 2.5, 2))).toEqual({
      previous: best(3, 2),
      improved: true,
    })
    expect(homeNoteBest('learning')).toBeNull()
    expect(JSON.parse(localStorage.getItem(HOME_NOTE_BESTS_KEY) ?? '')).toEqual(
      { singer: best(5, 2.5, 2) },
    )
    resetHomeNoteStoreForTests()
    expect(homeNoteBest('singer')).toEqual(best(5, 2.5, 2))
  })

  it('reads a table it does not trust as empty', () => {
    expect(isHomeNoteBestTable({ singer: best(3, 2) })).toBe(true)
    expect(isHomeNoteBestTable({ expert: best(3, 2) })).toBe(false)
    expect(isHomeNoteBestTable({ singer: { ...best(3, 2), found: 7 } })).toBe(
      false,
    )
    expect(isHomeNoteBestTable([])).toBe(false)
    localStorage.setItem(HOME_NOTE_BESTS_KEY, '{"singer":{"found":"lots"}}')
    resetHomeNoteStoreForTests()
    expect(homeNoteBest('singer')).toBeNull()
  })
})
