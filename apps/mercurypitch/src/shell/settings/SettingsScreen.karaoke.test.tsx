// ============================================================
// Settings' Karaoke row, where songs can be imported (plan S8 §9, mock 9a)
// ============================================================
//
// A build with Import says what the Karaoke screen now holds, and the songs
// left at a glance, as the server last said them. The store build's row is
// pinned in SettingsScreen.test.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import type * as VoiceTakeService from '@/db/services/voice-take-service'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type * as NativeBuild from '@/lib/native-build'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import type * as DeviceFactsModule from './device-facts'
import { SettingsScreen } from './SettingsScreen'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  IS_NATIVE_BUILD: true,
  KARAOKE_IMPORT: true,
}))
vi.mock('@/db/services/auth-me-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthMeService>()),
  readMe: vi.fn(),
}))
vi.mock('./device-facts', async (importOriginal) => ({
  ...(await importOriginal<typeof DeviceFactsModule>()),
  deviceFacts: () => null,
  loadDeviceFacts: vi.fn(async () => Promise.resolve(null)),
}))
vi.mock('@/db/services/voice-take-service', async (importOriginal) => ({
  ...(await importOriginal<typeof VoiceTakeService>()),
  getVoiceStorageSnapshot: vi.fn(),
}))

let view: RenderedShell | null = null

const karaokeRow = (): HTMLElement | null =>
  view?.container.querySelector<HTMLElement>(
    '[data-settings-row="rooms-karaoke"]',
  ) ?? null

beforeEach(() => {
  resetKaraokeSongsForTests()
})

afterEach(() => {
  view?.unmount()
  view = null
})

describe("Settings' Karaoke row, in a build with Import", () => {
  it('says what the screen holds, and the songs left', () => {
    resetKaraokeSongsForTests({
      left: 17,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    expect(karaokeRow()?.textContent).toBe(
      'KaraokeSubscription, songs on this phone, lyrics17 of 20 left',
    )
    karaokeRow()?.click()
    expect(onPush).toHaveBeenCalledWith('karaoke')
  })

  it('draws no count before the server has said one', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(karaokeRow()?.textContent).toBe(
      'KaraokeSubscription, songs on this phone, lyrics',
    )
  })
})
