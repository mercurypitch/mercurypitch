// ============================================================
// The room's stage on a TV connected to an iPhone, as the page reaches it
// ============================================================
//
// The app's own plugin (LyricsWindowPlugin.swift, under the name
// `PictureInPicture`) is faked behind registerPlugin. The rules: the stage's
// switch and state reach the names the Swift side answers; a message goes
// across as JSON with its kind beside it; a build without the stage reads as
// no TV rather than throwing; and Android and the web register nothing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as PictureInPictureModule from './picture-in-picture'

const capacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => 'ios'),
}))
const plugin = vi.hoisted(() => ({
  setTvStage: vi.fn(async () => undefined),
  getTvStage: vi.fn(),
  pushTvStage: vi.fn(async () => undefined),
  addListener: vi.fn(),
}))
const registerPlugin = vi.hoisted(() => vi.fn((_name: string) => plugin))

vi.mock('@capacitor/core', () => ({ Capacitor: capacitor, registerPlugin }))

type Module = typeof PictureInPictureModule

async function load(platform: 'ios' | 'android' | 'web'): Promise<Module> {
  capacitor.isNativePlatform.mockReturnValue(platform !== 'web')
  capacitor.getPlatform.mockReturnValue(platform)
  vi.resetModules()
  return import('./picture-in-picture')
}

const settle = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

beforeEach(() => {
  plugin.addListener.mockResolvedValue({ remove: vi.fn(async () => undefined) })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('the stage on a TV connected to an iPhone', () => {
  it('turns the stage on, and reads the TV as the plugin says', async () => {
    const pip = await load('ios')
    plugin.getTvStage.mockResolvedValueOnce({
      enabled: true,
      connected: true,
      showing: 'yes',
    })

    await pip.setTvStageEnabled(true)
    const state = await pip.readTvStage()

    expect(registerPlugin.mock.calls[0]).toEqual(['PictureInPicture'])
    expect(plugin.setTvStage.mock.calls).toEqual([[{ enabled: true }]])
    expect(state).toEqual({ enabled: true, connected: true, showing: false })
  })

  it('sends a message as JSON, with its kind beside it', async () => {
    const pip = await load('ios')
    const message = { v: 1, kind: 'frame', at: 5, position: 1.5 }

    await pip.sendTvStage(message)

    expect(plugin.pushTvStage.mock.calls).toEqual([
      [{ kind: 'frame', json: JSON.stringify(message) }],
    ])
  })

  it('hears the stage go up and down, and stops hearing it', async () => {
    const pip = await load('ios')
    const handle = { remove: vi.fn(async () => undefined) }
    plugin.addListener.mockResolvedValue(handle)
    const handler = vi.fn()

    const stop = pip.onTvStage(handler)
    await settle()
    const heard = plugin.addListener.mock.calls.find(
      ([name]) => name === 'tvStageChange',
    ) as unknown as [string, (state: Record<string, unknown>) => void]
    heard[1]({ connected: true, showing: true })
    heard[1]({ connected: false })
    stop()
    await settle()

    expect(handler.mock.calls).toEqual([
      [{ connected: true, showing: true }],
      [{ connected: false, showing: false }],
    ])
    expect(handle.remove).toHaveBeenCalled()
  })

  it('reads no TV from a build whose plugin has no stage', async () => {
    const pip = await load('ios')
    plugin.getTvStage.mockRejectedValueOnce(
      new Error('"PictureInPicture.getTvStage()" is not implemented on ios'),
    )

    await expect(pip.readTvStage()).resolves.toBeNull()
  })

  it.each(['android', 'web'] as const)(
    'has no stage on %s, and registers nothing for one',
    async (platform) => {
      const pip = await load(platform)

      await pip.setTvStageEnabled(true)
      await pip.sendTvStage({ kind: 'idle' })
      const state = await pip.readTvStage()
      const stop = pip.onTvStage(vi.fn())
      stop()

      expect(state).toBeNull()
      expect(registerPlugin).not.toHaveBeenCalled()
    },
  )
})
