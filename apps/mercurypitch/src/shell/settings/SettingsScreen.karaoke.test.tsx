// ============================================================
// Settings where songs can be imported: Cloud, then the Karaoke row
// ============================================================
//
// A build with Import has Mercury Pitch Cloud's standing group above the
// rooms (S7b §5; CloudGroup.test.tsx says what it does), and the Karaoke
// row says what its screen holds now: the songs on this phone and the
// lyrics. The store build's rows are pinned in SettingsScreen.test.tsx.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthMeService from '@/db/services/auth-me-service'
import type * as VoiceTakeService from '@/db/services/voice-take-service'
import { resetKaraokeSongsForTests } from '@/features/karaoke-room/karaoke-songs'
import type * as NativeBuild from '@/lib/native-build'
import { actAsIpad } from '@/tests/helpers/ipad-navigator'
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

describe('Settings, in a build with Import', () => {
  it('puts Mercury Pitch Cloud above the rooms, with the songs left', () => {
    resetKaraokeSongsForTests({
      left: 17,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)
    const groups = [...view.container.querySelectorAll('section')].map(
      (group) => group.getAttribute('aria-label'),
    )

    expect(groups.indexOf('Mercury Pitch Cloud')).toBe(
      groups.indexOf('Rooms') - 1,
    )
    expect(
      view.container.querySelector('[data-settings-row="cloud-songs-left"]')
        ?.textContent,
    ).toBe('Songs this month17 of 20 left')
  })

  it("says what Karaoke's screen holds, with no count of its own, and pushes it", () => {
    resetKaraokeSongsForTests({
      left: 17,
      subscribed: true,
      renewsAt: '2026-10-27T10:00:00.000Z',
      perPeriod: 20,
    })
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    expect(karaokeRow()?.textContent).toBe('KaraokeSongs on this phone, lyrics')
    karaokeRow()?.click()
    expect(onPush).toHaveBeenCalledWith('karaoke')
  })
})

describe("Settings' Karaoke row, on an iPad", () => {
  it('says the songs are on this iPad', () => {
    const restore = actAsIpad()
    try {
      view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

      expect(karaokeRow()?.textContent).toBe(
        'KaraokeSongs on this iPad, lyrics',
      )
    } finally {
      restore()
    }
  })
})
