// ============================================================
// Back with the TV's question up
// ============================================================
//
// A TV that connects with no remembered choice raises the TV sheet over
// whatever is on screen, a pushed Settings screen or a room. Back is for
// the sheet first, as its Not now: the TV mirrors the phone for this
// connection, nothing is kept, and nothing under the sheet moves. With no
// question up, Back goes where it went before. The chooser runs for real,
// against a stand-in plugin (tv/fake-tv.fixture.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { registerRunControls } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { performBack, resolveBack } from './shell-navigation'
import type { FakeTv } from './tv/fake-tv.fixture'
import { fakeTv } from './tv/fake-tv.fixture'
import { installTvChoice, resetTvChoice, tvChoiceUp } from './tv/tv-choice'
import { reloadTvMemoryForTests, rememberedChoice } from './tv/tv-memory'

const LG = 'LG webOS TV OLED48C24LA'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

let stop: (() => void) | null = null
let unregister: Array<() => void> = []
let tv: FakeTv

/** A TV with no remembered choice connects, and its sound names it. */
async function raiseQuestion(): Promise<void> {
  tv.connect()
  setAudioRouteForTests('airplay', LG)
  await vi.advanceTimersByTimeAsync(0)
  expect(tvChoiceUp()).toBe(true)
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  reloadTvMemoryForTests()
  setAudioRouteForTests('speaker', 'Speaker')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  setActiveTab(TAB_SINGING)
  resetRunShell()
  tv = fakeTv({ last: 'stage' })
  stop = installTvChoice(tv.device, { waitMs: 500 })
})

afterEach(() => {
  for (const off of unregister) off()
  unregister = []
  stop?.()
  stop = null
  resetTvChoice()
  resetRunShell()
  setAudioRouteForTests(null)
  localStorage.clear()
  reloadTvMemoryForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Back with the TV’s question up', () => {
  it('is for the sheet', async () => {
    await raiseQuestion()

    expect(resolveBack(true)).toBe('sheet')
  })

  it('answers Not now over a Settings screen, which stays', async () => {
    pushSettingsScreen('karaoke')
    await raiseQuestion()
    const back = host()

    const outcome = performBack(back)
    await vi.advanceTimersByTimeAsync(0)

    expect(outcome).toBe('sheet')
    expect(tvChoiceUp()).toBe(false)
    expect(tv.screen()).toBe('mirror')
    expect(rememberedChoice(LG)).toBeNull()
    expect(pushed()).toBe('karaoke')
    expect(back.back).not.toHaveBeenCalled()
  })

  it('comes before the room under it and its overlay', async () => {
    const closeRoomOverlay = vi.fn(() => true)
    unregister.push(
      registerRunControls({
        tab: TAB_SINGING,
        roomLabel: 'Sing',
        isPlaying: () => false,
        isPaused: () => false,
        pause: vi.fn(),
        resume: vi.fn(),
        stop: vi.fn(),
        park: vi.fn(),
        closeRoomOverlay,
      }),
    )
    await raiseQuestion()

    expect(performBack(host())).toBe('sheet')
    expect(closeRoomOverlay).not.toHaveBeenCalled()
    expect(tvChoiceUp()).toBe(false)
  })
})

describe('Back with no TV question up', () => {
  it('goes to the screen under it, as before', async () => {
    pushSettingsScreen('karaoke')
    tv.connect()
    await vi.advanceTimersByTimeAsync(100)

    expect(tvChoiceUp()).toBe(false)
    expect(performBack(host())).toBe('pushed')
    expect(pushed()).toBe('settings')
  })
})
