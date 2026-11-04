// ============================================================
// Settings, Karaoke, TV: the TVs this phone remembers
// ============================================================
//
// The group sits in the Karaoke room's settings, on a phone with the TV
// plugin and nowhere else. Before any TV is remembered it says, in a line,
// what happens when one connects; after, each TV has a card with its name,
// its choice checked, the other two to change to, and Forget. A change
// shows at once on that TV while it is connected, and keeps the card (and
// the focus in it) where it was; Forget makes the next connection ask
// again. The chooser runs for real, against a stand-in plugin.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { KaraokeSettingsScreen } from '../settings/KaraokeSettingsScreen'
import type { FakeTv } from './fake-tv.fixture'
import { fakeTv } from './fake-tv.fixture'
import { installTvChoice, resetTvChoice, tvChoiceAsking } from './tv-choice'
import { reloadTvMemoryForTests, rememberedChoice, rememberTv, } from './tv-memory'

const LG = 'LG webOS TV OLED48C24LA'

let view: RenderedShell | null = null
let stop: (() => void) | null = null

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
}

async function open(tv: FakeTv): Promise<HTMLElement> {
  stop = installTvChoice(tv.device, { waitMs: 500 })
  view = renderShell(() => <KaraokeSettingsScreen />)
  await settle()
  return view.container
}

const groups = (root: HTMLElement): (string | null)[] =>
  [...root.querySelectorAll('section')].map((group) =>
    group.getAttribute('aria-label'),
  )

function tvGroup(root: HTMLElement): HTMLElement {
  const found = root.querySelector<HTMLElement>('section[aria-label="TV"]')
  if (found === null) throw new Error('no TV group')
  return found
}

function card(root: HTMLElement, name: string | null): HTMLElement {
  const found = tvGroup(root).querySelector<HTMLElement>(
    `[data-tv="${name ?? ''}"]`,
  )
  if (found === null) throw new Error(`no card for ${String(name)}`)
  return found
}

const checked = (where: HTMLElement): string | null =>
  where
    .querySelector('[role="radio"][aria-checked="true"]')
    ?.getAttribute('data-choice') ?? null

const radio = (where: HTMLElement, choice: string): HTMLButtonElement => {
  const found = where.querySelector<HTMLButtonElement>(
    `[role="radio"][data-choice="${choice}"]`,
  )
  if (found === null) throw new Error(choice)
  return found
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  reloadTvMemoryForTests()
  setAudioRouteForTests('speaker', 'Speaker')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  view?.unmount()
  view = null
  stop?.()
  stop = null
  resetTvChoice()
  setAudioRouteForTests(null)
  localStorage.clear()
  reloadTvMemoryForTests()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the TV group in Settings, Karaoke', () => {
  it('is not there on a phone with no TV plugin', async () => {
    rememberTv(LG, 'stage')

    const root = await open(fakeTv({ plugin: false }))

    expect(groups(root)).not.toContain('TV')
    expect(root.textContent).not.toContain(LG)
  })

  it('says what happens when a TV connects, before any is remembered', async () => {
    const root = await open(fakeTv())

    expect(groups(root)).toEqual([
      'Lyrics',
      'Playback',
      'TV',
      'Find by singing',
    ])
    expect(tvGroup(root).textContent).toBe(
      'TVWhen a TV mirrors this phone, you choose what it shows: the stage, the lyrics or the phone.',
    )
  })

  it('lists each remembered TV with its choice checked', async () => {
    rememberTv(LG, 'stage')
    rememberTv(null, 'lyrics')

    const root = await open(fakeTv())

    const names = [
      ...tvGroup(root).querySelectorAll('[data-settings-row="tv-name"]'),
    ].map((row) => row.textContent)
    expect(names).toEqual([`${LG}Forget`, 'A TV with no nameForget'])
    expect(checked(card(root, LG))).toBe('stage')
    expect(checked(card(root, null))).toBe('lyrics')
    expect(
      [...card(root, LG).querySelectorAll('[role="radio"]')].map(
        (one) => one.textContent,
      ),
    ).toEqual([
      'StageYour pitch and the lyrics',
      'LyricsThe words, full screen',
      'MirrorThe TV shows the phone',
    ])
  })

  it('changes a TV’s choice, shows it on that TV at once, and keeps the card', async () => {
    rememberTv(LG, 'stage')
    const tv = fakeTv()
    const root = await open(tv)
    tv.connect()
    setAudioRouteForTests('airplay', LG)
    await settle()
    const pressed = radio(card(root, LG), 'lyrics')

    pressed.click()
    await settle()

    expect(rememberedChoice(LG)).toBe('lyrics')
    expect(tv.screen()).toBe('lyrics')
    expect(checked(card(root, LG))).toBe('lyrics')
    // The same element, still in the page: the focus on it stays.
    expect(pressed.isConnected).toBe(true)
  })

  it('forgets a TV: its card goes, and the next time it connects it is asked about', async () => {
    rememberTv(LG, 'stage')
    const tv = fakeTv()
    const root = await open(tv)

    card(root, LG)
      .querySelector<HTMLButtonElement>('[data-testid="tv-forget"]')
      ?.click()
    tv.connect()
    setAudioRouteForTests('airplay', LG)
    await settle()

    expect(rememberedChoice(LG)).toBeNull()
    expect(tvGroup(root).querySelector('[data-tv]')).toBeNull()
    expect(tvGroup(root).textContent).toContain('When a TV mirrors this phone')
    expect(tvChoiceAsking()).toEqual({ name: LG })
  })

  it('names what Forget forgets, for a screen reader', async () => {
    rememberTv(LG, 'stage')

    const root = await open(fakeTv())

    expect(
      card(root, LG)
        .querySelector('[data-testid="tv-forget"]')
        ?.getAttribute('aria-label'),
    ).toBe(`Forget ${LG}`)
    expect(
      card(root, LG)
        .querySelector('[role="radiogroup"]')
        ?.getAttribute('aria-label'),
    ).toBe(`What ${LG} shows`)
  })
})
