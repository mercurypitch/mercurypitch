import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markNgDemoSeen, NG_DEMO_SEEN_KEY, ngDemoAutoPlays, ngDemoSeen, recordNgBest, rememberNgNote, resetNgStoreForTests, } from './ng-slides-store'

beforeEach(() => {
  localStorage.clear()
  resetNgStoreForTests()
})
afterEach(() => {
  localStorage.clear()
  resetNgStoreForTests()
})

describe("Ng slides' demo", () => {
  it('plays by itself on a first visit: unseen, no note kept, no best', () => {
    expect(ngDemoSeen()).toBe(false)
    expect(ngDemoAutoPlays()).toBe(true)
  })

  it('stops playing by itself once it is seen, and remembers that on this device', () => {
    markNgDemoSeen()
    expect(ngDemoSeen()).toBe(true)
    expect(ngDemoAutoPlays()).toBe(false)
    expect(localStorage.getItem('mp_ng_demo_seen')).toBe('true')
    resetNgStoreForTests()
    expect(ngDemoSeen()).toBe(true)
  })

  it('keeps its flag out of the settings sync: an mp_ key, not pitchperfect_', () => {
    expect(NG_DEMO_SEEN_KEY).toBe('mp_ng_demo_seen')
    expect(NG_DEMO_SEEN_KEY.startsWith('pitchperfect_')).toBe(false)
  })

  it('does not play by itself once a run has been kept: a note or a best', () => {
    rememberNgNote(57)
    expect(ngDemoAutoPlays()).toBe(false)

    localStorage.clear()
    resetNgStoreForTests()
    recordNgBest('professional', { lit: 40, arches: 1, jumps: 2, at: 1 })
    expect(ngDemoAutoPlays()).toBe(false)
  })
})
