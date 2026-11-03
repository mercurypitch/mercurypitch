import { beforeEach, describe, expect, it } from 'vitest'
import type { FirstNoteBest } from './first-note-store'
import { FIRST_NOTE_BESTS_KEY, FIRST_NOTE_DEMO_SEEN_KEY, firstNoteBeats, firstNoteBest, firstNoteDemoAutoPlays, firstNoteDemoSeen, isFirstNoteBestTable, markFirstNoteDemoSeen, recordFirstNoteBest, resetFirstNoteStoreForTests, } from './first-note-store'

function best(
  onNote: number,
  found: number,
  cents: number,
  rounds = 6,
): FirstNoteBest {
  return { onNote, found, rounds, cents, at: 1 }
}

beforeEach(() => {
  localStorage.removeItem(FIRST_NOTE_BESTS_KEY)
  resetFirstNoteStoreForTests()
})

describe("First note's bests", () => {
  it('ranks more entries on the note first, then more found, then closer', () => {
    expect(firstNoteBeats(best(3, 4, 80), best(2, 6, 10))).toBe(true)
    expect(firstNoteBeats(best(3, 5, 80), best(3, 4, 10))).toBe(true)
    expect(firstNoteBeats(best(3, 4, 20), best(3, 4, 40))).toBe(true)
    expect(firstNoteBeats(best(3, 4, 40), best(3, 4, 20))).toBe(false)
  })

  it('never keeps a run that came in on nothing and found nothing', () => {
    expect(firstNoteBeats(best(0, 0, 200), null)).toBe(false)
    expect(firstNoteBeats(best(0, 1, 200), null)).toBe(true)
  })

  it("keeps each level's best apart, and says when one improved", () => {
    expect(recordFirstNoteBest('singer', best(2, 4, 60))).toEqual({
      previous: null,
      improved: false,
    })
    expect(recordFirstNoteBest('singer', best(1, 6, 10)).improved).toBe(false)
    expect(recordFirstNoteBest('singer', best(4, 5, 30)).improved).toBe(true)
    expect(firstNoteBest('singer')?.onNote).toBe(4)
    expect(firstNoteBest('learning')).toBeNull()
  })

  it('reads back only a table it can trust', () => {
    expect(isFirstNoteBestTable({ singer: best(2, 4, 30) })).toBe(true)
    expect(isFirstNoteBestTable({ singer: best(7, 4, 30) })).toBe(false)
    expect(isFirstNoteBestTable({ choir: best(2, 4, 30) })).toBe(false)
    expect(isFirstNoteBestTable([])).toBe(false)
  })
})

describe("First note's demo, seen or not", () => {
  beforeEach(() => {
    localStorage.removeItem(FIRST_NOTE_BESTS_KEY)
    localStorage.removeItem(FIRST_NOTE_DEMO_SEEN_KEY)
    resetFirstNoteStoreForTests()
  })

  it('plays by itself on a first visit, the demo unseen and no run kept', () => {
    expect(firstNoteDemoSeen()).toBe(false)
    expect(firstNoteDemoAutoPlays()).toBe(true)
  })

  it('stops playing by itself once seen, on this device', () => {
    markFirstNoteDemoSeen()
    expect(firstNoteDemoAutoPlays()).toBe(false)
    resetFirstNoteStoreForTests()
    expect(firstNoteDemoSeen()).toBe(true)
  })

  it('stops playing by itself once a run has kept a best, at any level', () => {
    recordFirstNoteBest('professional', best(2, 3, 20))
    expect(firstNoteDemoSeen()).toBe(false)
    expect(firstNoteDemoAutoPlays()).toBe(false)
  })
})
