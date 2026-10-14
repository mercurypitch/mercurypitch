import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { echoBest, echoDemoAutoPlays, echoDemoSeen, markEchoDemoSeen, recordEchoBest, rememberEchoRoot, rememberedEchoRoot, resetEchoStoreForTests, } from './echo-store'

const run = (landed: number, accuracy: number | null, at = 1) => ({
  landed,
  notes: 20,
  accuracy,
  at,
})

beforeEach(() => {
  localStorage.clear()
  resetEchoStoreForTests()
})
afterEach(() => {
  localStorage.clear()
  resetEchoStoreForTests()
})

describe('Echo bests', () => {
  it('keeps a first run as the best, without calling it an improvement', () => {
    expect(recordEchoBest('singer', run(15, 80))).toEqual({
      previous: null,
      improved: false,
    })
    expect(echoBest('singer')).toEqual(run(15, 80))
  })

  it('cheers a run that lands more notes, and keeps the old best otherwise', () => {
    recordEchoBest('singer', run(15, 80))
    expect(recordEchoBest('singer', run(14, 99)).improved).toBe(false)
    expect(echoBest('singer')).toEqual(run(15, 80))
    expect(recordEchoBest('singer', run(17, 70, 2)).improved).toBe(true)
    expect(echoBest('singer')).toEqual(run(17, 70, 2))
  })

  it('keeps each level apart', () => {
    recordEchoBest('singer', run(17, 70))
    recordEchoBest('learning', run(12, 90))
    expect(echoBest('singer')?.landed).toBe(17)
    expect(echoBest('learning')?.landed).toBe(12)
    expect(echoBest('professional')).toBeNull()
  })

  it('reads the table back from storage on a fresh start', () => {
    recordEchoBest('professional', run(20, 60))
    resetEchoStoreForTests()
    expect(echoBest('professional')).toEqual(run(20, 60))
  })
})

describe("Echo's remembered root", () => {
  it('remembers a note in the hold range and refuses one outside it', () => {
    expect(rememberedEchoRoot()).toBeNull()
    rememberEchoRoot(57)
    expect(rememberedEchoRoot()).toBe(57)
    rememberEchoRoot(5)
    expect(rememberedEchoRoot()).toBe(57)
    resetEchoStoreForTests()
    expect(rememberedEchoRoot()).toBe(57)
  })
})

describe("Echo's demo", () => {
  it('plays by itself on a first visit only: unseen, no root kept, no best', () => {
    expect(echoDemoAutoPlays()).toBe(true)
    rememberEchoRoot(57)
    expect(echoDemoAutoPlays()).toBe(false)
  })

  it('does not play by itself once any level has a best', () => {
    recordEchoBest('professional', run(3, 70))
    expect(echoDemoAutoPlays()).toBe(false)
  })

  it('is seen once marked, on this device, under an mp_ key', () => {
    expect(echoDemoSeen()).toBe(false)
    markEchoDemoSeen()
    expect(echoDemoSeen()).toBe(true)
    expect(echoDemoAutoPlays()).toBe(false)
    expect(localStorage.getItem('mp_echo_demo_seen')).toBe('true')
    resetEchoStoreForTests()
    expect(echoDemoSeen()).toBe(true)
  })
})
