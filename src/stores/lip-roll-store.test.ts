import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LIP_DEMO_SEEN_KEY, LIP_NOTE_KEY, lipBest, lipDemoAutoPlays, lipDemoSeen, markLipDemoSeen, recordLipBest, rememberedLipNote, rememberLipNote, resetLipStoreForTests, } from './lip-roll-store'

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

describe("Lip roll's demo", () => {
  it('plays by itself on a first visit: unseen, no note kept, no best', () => {
    expect(lipDemoSeen()).toBe(false)
    expect(lipDemoAutoPlays()).toBe(true)
  })

  it('stops playing by itself once it is seen, and remembers that on this device', () => {
    markLipDemoSeen()
    expect(lipDemoSeen()).toBe(true)
    expect(lipDemoAutoPlays()).toBe(false)
    expect(localStorage.getItem('mp_lip_demo_seen')).toBe('true')
    resetLipStoreForTests()
    expect(lipDemoSeen()).toBe(true)
  })

  it('keeps its flag out of the settings sync: an mp_ key, not pitchperfect_', () => {
    expect(LIP_DEMO_SEEN_KEY).toBe('mp_lip_demo_seen')
    expect(LIP_DEMO_SEEN_KEY.startsWith('pitchperfect_')).toBe(false)
  })

  it('does not play by itself once a run has been kept: a note or a best', () => {
    rememberLipNote(57)
    expect(lipDemoAutoPlays()).toBe(false)

    localStorage.clear()
    resetLipStoreForTests()
    recordLipBest('professional', best(40))
    expect(lipDemoAutoPlays()).toBe(false)
  })
})
