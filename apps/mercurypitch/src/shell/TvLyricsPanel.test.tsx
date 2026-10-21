// The Developer screen's TV section, read the way a tester reads it: a
// switch that puts the Karaoke room's lyrics on a connected TV in place of
// the mirror, and rows that say whether a TV is connected and what it shows.
// The plugin is mocked at the platform module, as the app's other native
// panels are; a phone without it reads as having no TV.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderedShell } from './render-for-test'
import { renderShell } from './render-for-test'
import { TvLyricsPanel } from './TvLyricsPanel'

type TvState = { enabled: boolean; connected: boolean; showing: boolean }

const platform = vi.hoisted(() => ({
  readTvLyrics: vi.fn(
    async (): Promise<TvState | null> => Promise.resolve(null),
  ),
  onTvLyrics: vi.fn(
    (_handler: (state: { connected: boolean; showing: boolean }) => void) =>
      vi.fn(),
  ),
  setTvLyricsEnabled: vi.fn(async (_on: boolean) => Promise.resolve()),
}))
vi.mock('@irchiinnuss/mobile-runtime/platform', () => platform)

let view: RenderedShell | null = null

function open(): void {
  view = renderShell(() => <TvLyricsPanel />)
}

function el<T extends Element>(selector: string): T {
  const found = view?.container.querySelector<T>(selector)
  if (found === null || found === undefined) throw new Error(selector)
  return found
}

const row = (id: string): string =>
  el(`[data-tv-row="${id}"] dd`).textContent ?? ''
const toggle = () =>
  el<HTMLButtonElement>('[data-testid="dev-tv-lyrics-switch"]')
const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

beforeEach(() => {
  platform.readTvLyrics.mockResolvedValue({
    enabled: false,
    connected: false,
    showing: false,
  })
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.clearAllMocks()
})

describe('the TV section', () => {
  it('says there is no TV until one connects, and then what it shows', async () => {
    open()
    await settle()
    expect(row('tv')).toBe('none')
    expect(row('shows')).toBe('nothing')

    platform.onTvLyrics.mock.calls[0]?.[0]({ connected: true, showing: false })
    expect(row('tv')).toBe('connected')
    expect(row('shows')).toBe('the phone, mirrored')

    platform.onTvLyrics.mock.calls[0]?.[0]({ connected: true, showing: true })
    expect(row('shows')).toBe('the lyrics')
  })

  it('turns the lyrics on the TV on, then reads the TV again', async () => {
    open()
    await settle()
    platform.readTvLyrics.mockResolvedValue({
      enabled: true,
      connected: true,
      showing: true,
    })

    toggle().click()
    await settle()

    expect(platform.setTvLyricsEnabled.mock.calls).toEqual([[true]])
    expect(platform.readTvLyrics).toHaveBeenCalledTimes(2)
    expect(row('shows')).toBe('the lyrics')
  })

  it('stops listening for a TV when the section closes', async () => {
    const stop = vi.fn()
    platform.onTvLyrics.mockReturnValueOnce(stop)
    open()
    await settle()

    view?.unmount()
    view = null

    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('has no switch to turn on where the phone has no TV to give', async () => {
    platform.readTvLyrics.mockResolvedValue(null)
    open()
    await settle()

    expect(row('tv')).toBe('none on this phone')
    expect(toggle().disabled).toBe(true)
  })
})
