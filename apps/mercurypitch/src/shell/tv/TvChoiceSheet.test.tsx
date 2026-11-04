// ============================================================
// The TV chooser's sheet, as the singer meets it
// ============================================================
//
// A TV with no remembered choice connects, and the sheet asks what it
// shows: the stage first and recommended, then the lyrics, a box to
// remember for that TV, ticked, and the plain mirror. Each answer is shown
// on the TV at a tap; the box decides whether it is kept; Not now and
// Escape are the mirror for this connection, kept for nothing. The chooser
// runs for real, against a stand-in plugin (fake-tv.fixture.ts) and the
// real route store and memory.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import type { FakeTv } from './fake-tv.fixture'
import { fakeTv } from './fake-tv.fixture'
import { installTvChoice, resetTvChoice } from './tv-choice'
import { reloadTvMemoryForTests, rememberedChoice } from './tv-memory'
import { TvChoiceSheet } from './TvChoiceSheet'

const LG = 'LG webOS TV OLED48C24LA'
const WAIT_MS = 500

let view: RenderedShell | null = null
let stop: (() => void) | null = null
let tv: FakeTv

const settle = async (ms = 0): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
}

/**
 * The sheet up for a TV: it connects from the phone's speaker, and the
 * sound's route moves to it and names it, or never does.
 */
async function connect(name: string | null): Promise<void> {
  setAudioRouteForTests('speaker', 'Speaker')
  tv.connect()
  if (name !== null) setAudioRouteForTests('airplay', name)
  await settle(name === null ? WAIT_MS : 0)
}

function sheet(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-testid="tv-choice"]')
}

function inSheet<T extends Element>(selector: string): T {
  const found = sheet()?.querySelector<T>(selector)
  if (found === null || found === undefined) throw new Error(selector)
  return found
}

const answer = (choice: string): HTMLButtonElement =>
  inSheet<HTMLButtonElement>(`[data-tv-choice="${choice}"]`)
const box = (): HTMLInputElement =>
  inSheet<HTMLInputElement>('[data-testid="tv-choice-remember"]')

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  reloadTvMemoryForTests()
  setAudioRouteForTests('speaker', 'Speaker')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  tv = fakeTv({ last: 'stage' })
  stop = installTvChoice(tv.device, { waitMs: WAIT_MS })
  view = renderShell(() => <TvChoiceSheet />)
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

describe('the TV sheet', () => {
  it('asks what the TV shows, by its name, the stage first and recommended', async () => {
    await connect(LG)

    const choices = [...(sheet()?.querySelectorAll('[data-tv-choice]') ?? [])]
    expect(sheet()?.querySelector('h2')?.textContent).toBe('Show on the TV')
    expect(sheet()?.textContent).toContain(`${LG} is connected.`)
    expect(choices.map((el) => el.getAttribute('data-tv-choice'))).toEqual([
      'stage',
      'lyrics',
      'mirror',
    ])
    expect(answer('stage').textContent).toBe(
      'StageRecommendedYour pitch and the lyrics',
    )
    expect(answer('lyrics').textContent).toBe('LyricsThe words, full screen')
    expect(answer('mirror').textContent).toBe('Keep mirroring my phone')
    expect(box().checked).toBe(true)
    expect(box().closest('label')?.textContent).toBe(`Remember for ${LG}`)
  })

  it('shows the stage at a tap, and keeps it for the TV with the box ticked', async () => {
    await connect(LG)

    answer('stage').click()
    await settle()

    expect(sheet()).toBeNull()
    expect(tv.screen()).toBe('stage')
    expect(rememberedChoice(LG)).toBe('stage')
  })

  it('shows the lyrics for this connection only with the box unticked', async () => {
    await connect(LG)

    box().click()
    answer('lyrics').click()
    await settle()

    expect(tv.screen()).toBe('lyrics')
    expect(rememberedChoice(LG)).toBeNull()
  })

  it('keeps the plain mirror for the TV from its quiet button', async () => {
    await connect(LG)

    answer('mirror').click()
    await settle()

    expect(sheet()).toBeNull()
    expect(tv.screen()).toBe('mirror')
    expect(rememberedChoice(LG)).toBe('mirror')
  })

  it('takes Not now as the mirror for now, and keeps nothing, box ticked or not', async () => {
    await connect(LG)

    inSheet<HTMLButtonElement>('[data-testid="tv-choice-not-now"]').click()
    await settle()

    expect(sheet()).toBeNull()
    expect(tv.screen()).toBe('mirror')
    expect(rememberedChoice(LG)).toBeNull()
  })

  it('takes Escape as Not now: the sheet traps nobody', async () => {
    await connect(LG)

    inSheet<HTMLElement>('h2')
      .closest('[role="dialog"]')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      )
    await settle()

    expect(sheet()).toBeNull()
    expect(tv.screen()).toBe('mirror')
    expect(rememberedChoice(LG)).toBeNull()
  })

  it('asks about a TV whose name never came as this TV', async () => {
    await connect(null)

    expect(sheet()?.textContent).toContain('A TV is connected.')
    expect(box().closest('label')?.textContent).toBe('Remember for this TV')
  })

  it('starts every question ticked, whatever the last one was left at', async () => {
    await connect(LG)
    box().click()
    inSheet<HTMLButtonElement>('[data-testid="tv-choice-not-now"]').click()
    tv.leave()

    await connect(LG)

    expect(box().checked).toBe(true)
  })

  it('goes when the TV does, and keeps nothing', async () => {
    await connect(LG)

    tv.leave()
    await settle()

    expect(sheet()).toBeNull()
    expect(rememberedChoice(LG)).toBeNull()
  })
})
