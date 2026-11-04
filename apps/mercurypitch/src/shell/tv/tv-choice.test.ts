// ============================================================
// The TV chooser's flow: connected, named, asked or shown, remembered
// ============================================================
//
// The plugin is a stateful fake that behaves as LyricsWindowPlugin.swift
// does (fake-tv.fixture.ts): the view switched on last goes up the moment a
// TV connects, and a choice is that view switched on, or both off. The
// sound's route is the real store, driven as the phone drives it; the
// memory is the real one.
//
// The rules: a TV with no remembered choice is asked about once its name
// is settled, and mirrors the phone meanwhile; a ticked answer is kept for
// that TV, an unticked one and Not now are not; a remembered TV shows its
// choice at once, unasked; a TV whose name never comes is asked about under
// the one key for such TVs; a TV that goes away takes its question with it;
// a phone with no plugin has no chooser; and the console never names a TV.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { FakeTv } from './fake-tv.fixture'
import { fakeTv } from './fake-tv.fixture'
import { changeTvChoice, chooseTv, installTvChoice, notNowTv, resetTvChoice, tvChoiceAsking, tvChoiceAvailable, tvChoiceUp, } from './tv-choice'
import { reloadTvMemoryForTests, rememberedChoice, rememberTv, } from './tv-memory'

const LG = 'LG webOS TV OLED48C24LA'
const SAMSUNG = '[TV] Samsung Q60 Series (55)'
const WAIT_MS = 500

let stop: (() => void) | null = null
let said: string[] = []

function install(tv: FakeTv): void {
  stop = installTvChoice(tv.device, { waitMs: WAIT_MS })
}

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
}

/**
 * A TV connects from the phone's speaker, and the sound's route moves to it
 * a moment later, naming it: the name is taken as the route moves.
 */
async function connectNamed(tv: FakeTv, name: string): Promise<void> {
  setAudioRouteForTests('speaker', 'Speaker')
  tv.connect()
  setAudioRouteForTests('airplay', name)
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  reloadTvMemoryForTests()
  setAudioRouteForTests('speaker', 'Speaker')
  said = []
  vi.spyOn(console, 'info').mockImplementation((line: unknown) => {
    said.push(String(line))
  })
})

afterEach(() => {
  stop?.()
  stop = null
  resetTvChoice()
  setAudioRouteForTests(null)
  localStorage.clear()
  reloadTvMemoryForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a TV with no remembered choice', () => {
  it('is asked about once its name comes, and mirrors the phone meanwhile', async () => {
    const tv = fakeTv({ last: 'stage' })
    install(tv)
    await settle()

    tv.connect()
    const upAtOnce = tv.screen()
    await settle(WAIT_MS / 5)
    setAudioRouteForTests('airplay', LG)
    await settle()

    expect(upAtOnce).toBe('stage')
    expect(tvChoiceAsking()).toEqual({ name: LG })
    expect(tv.screen()).toBe('mirror')
  })

  it('shows a ticked answer and keeps it for that TV', async () => {
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    chooseTv('stage', true)
    await settle()

    expect(tvChoiceUp()).toBe(false)
    expect(tv.screen()).toBe('stage')
    expect(rememberedChoice(LG)).toBe('stage')
  })

  it('shows an unticked answer for this connection only, and asks again on the next', async () => {
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    chooseTv('lyrics', false)
    await settle()
    const shownThisTime = tv.screen()
    tv.leave()
    await connectNamed(tv, LG)

    expect(shownThisTime).toBe('lyrics')
    expect(rememberedChoice(LG)).toBeNull()
    expect(tvChoiceAsking()).toEqual({ name: LG })
    expect(tv.screen()).toBe('mirror')
  })

  it('takes Not now as the mirror for this connection, kept for nothing', async () => {
    const tv = fakeTv({ last: 'lyrics' })
    install(tv)
    await connectNamed(tv, LG)

    notNowTv()
    await settle()
    const afterNotNow = tv.screen()
    tv.leave()
    await connectNamed(tv, LG)

    expect(afterNotNow).toBe('mirror')
    expect(rememberedChoice(LG)).toBeNull()
    expect(tvChoiceAsking()).toEqual({ name: LG })
  })

  it('keeps the mirror itself, chosen with the box ticked, and asks no more', async () => {
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    chooseTv('mirror', true)
    await settle()
    tv.leave()
    await connectNamed(tv, LG)

    expect(rememberedChoice(LG)).toBe('mirror')
    expect(tvChoiceUp()).toBe(false)
  })
})

describe('a TV with a remembered choice', () => {
  it('shows it at once, with no question', async () => {
    rememberTv(LG, 'lyrics')
    const tv = fakeTv({ last: 'stage' })
    install(tv)

    await connectNamed(tv, LG)

    expect(tvChoiceUp()).toBe(false)
    expect(tv.screen()).toBe('lyrics')
    expect(tv.shown).toEqual(['lyrics'])
  })

  it('is told apart from another TV by its name', async () => {
    rememberTv(LG, 'stage')
    const tv = fakeTv()
    install(tv)

    await connectNamed(tv, SAMSUNG)

    expect(tvChoiceAsking()).toEqual({ name: SAMSUNG })
    expect(tv.screen()).toBe('mirror')
  })
})

describe('a TV whose name never comes', () => {
  it('waits out the bound, then is asked about as a TV with no name', async () => {
    const tv = fakeTv()
    install(tv)
    await settle()

    tv.connect()
    await settle(WAIT_MS - 1)
    const askedEarly = tvChoiceUp()
    await settle(1)

    expect(askedEarly).toBe(false)
    expect(tvChoiceAsking()).toEqual({ name: null })
  })

  it('is kept under the one key for such TVs, which the next one shows', async () => {
    const tv = fakeTv()
    install(tv)
    tv.connect()
    await settle(WAIT_MS)
    chooseTv('stage', true)
    await settle()
    tv.leave()

    tv.connect()
    await settle(WAIT_MS)

    expect(rememberedChoice(null)).toBe('stage')
    expect(tvChoiceUp()).toBe(false)
    expect(tv.screen()).toBe('stage')
  })
})

describe('comings and goings', () => {
  it('takes the question down when the TV goes away', async () => {
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    tv.leave()

    expect(tvChoiceUp()).toBe(false)
    expect(rememberedChoice(LG)).toBeNull()
  })

  it('asks nothing about a TV that went away before its name came', async () => {
    const tv = fakeTv()
    install(tv)
    tv.connect()
    await settle(WAIT_MS / 2)

    tv.leave()
    await settle(WAIT_MS)

    expect(tvChoiceUp()).toBe(false)
    expect(tv.shown).toEqual([])
  })

  it('hears one connection, though both views say it', async () => {
    rememberTv(LG, 'stage')
    const tv = fakeTv()
    install(tv)

    await connectNamed(tv, LG)

    expect(tv.shown).toEqual(['stage'])
    expect(said.filter((line) => line.includes('a TV connected'))).toHaveLength(
      1,
    )
  })

  it('meets a TV that was connected before the app was', async () => {
    rememberTv(LG, 'lyrics')
    setAudioRouteForTests('airplay', LG)
    const tv = fakeTv({ connected: true, last: 'stage' })

    install(tv)
    await settle(WAIT_MS)

    expect(tvChoiceAvailable()).toBe(true)
    expect(tv.screen()).toBe('lyrics')
  })

  it('never says a TV’s name in the console', async () => {
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)
    chooseTv('stage', true)
    await settle()

    expect(said.length).toBeGreaterThan(2)
    expect(said.filter((line) => line.includes('LG'))).toEqual([])
  })
})

describe('a phone with no TV plugin', () => {
  it('has no chooser: nothing offered, nothing asked, nothing shown', async () => {
    const tv = fakeTv({ plugin: false })

    install(tv)
    await settle(WAIT_MS)

    expect(tvChoiceAvailable()).toBe(false)
    expect(tvChoiceUp()).toBe(false)
    expect(tv.shown).toEqual([])
  })
})

describe('a choice changed in Settings', () => {
  it('shows at once on the TV it is for, while it is connected', async () => {
    rememberTv(LG, 'stage')
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    changeTvChoice(LG, 'lyrics')
    await settle()

    expect(rememberedChoice(LG)).toBe('lyrics')
    expect(tv.screen()).toBe('lyrics')
  })

  it('leaves the connected TV alone when it is another TV’s', async () => {
    rememberTv(LG, 'stage')
    rememberTv(SAMSUNG, 'stage')
    const tv = fakeTv()
    install(tv)
    await connectNamed(tv, LG)

    changeTvChoice(SAMSUNG, 'mirror')
    await settle()

    expect(rememberedChoice(SAMSUNG)).toBe('mirror')
    expect(tv.screen()).toBe('stage')
  })
})
