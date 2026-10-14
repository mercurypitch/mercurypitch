import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIP_NOTE_KEY, lipBest, recordLipBest, rememberedLipNote, rememberLipNote, resetLipStoreForTests, } from './lip-roll-store'

beforeEach(() => {
  localStorage.clear()
  resetLipStoreForTests()
})
afterEach(() => {
  localStorage.clear()
  resetLipStoreForTests()
})

const best = (lit: number) => ({ lit, arches: 3, jumps: 0, at: 1 })

describe("Lip roll's records", () => {
  it('keeps a best per level, and says when a run beat one', () => {
    expect(lipBest('singer')).toBeNull()

    expect(recordLipBest('singer', best(70))).toEqual({
      previous: null,
      improved: false,
    })
    expect(recordLipBest('singer', best(60)).improved).toBe(false)
    expect(recordLipBest('singer', best(88))).toEqual({
      previous: best(70),
      improved: true,
    })
    expect(lipBest('singer')).toEqual(best(88))
    expect(lipBest('learning')).toBeNull()
  })

  it('remembers the easy note on this account, and refuses one out of range', () => {
    rememberLipNote(52)
    expect(rememberedLipNote()).toBe(52)
    expect(localStorage.getItem(LIP_NOTE_KEY)).toBe('52')
    expect(LIP_NOTE_KEY.startsWith('pitchperfect_')).toBe(true)

    rememberLipNote(5)
    expect(rememberedLipNote()).toBe(52)
  })

  it('reads what storage holds afresh after a reset', () => {
    rememberLipNote(55)
    resetLipStoreForTests()
    expect(rememberedLipNote()).toBe(55)
  })
})
