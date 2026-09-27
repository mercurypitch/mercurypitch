// ============================================================
// The Karaoke room's picture in the app (plan S8 decision D7 A)
// ============================================================
//
// On the web the Broadway Theater is a supporter room, delivered from the
// server. In the app it is the Karaoke room's own picture: free, packaged in
// both orientations, and the room's default. One identity in both builds, so
// a singer who picks it keeps the same id; the server's copy of it is not
// listed a second time as a room to unlock.

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  IS_NATIVE_BUILD: true,
}))

import { defaultBackground, getBackgroundDefinition, listBackgrounds, } from './background-catalog'
import type { PremiumBackgroundCatalogState } from './background-catalog-store'
import type { PremiumBackgroundAsset } from './background-runtime'
import { listRuntimeBackgrounds } from './background-surface'

const serverAsset = (
  id: PremiumBackgroundAsset['id'],
  title: string,
): PremiumBackgroundAsset => ({
  id,
  title,
  description: '',
  surface: 'karaoke',
  activeVersion: 1,
  variants: [],
})

const state = (
  assets: readonly PremiumBackgroundAsset[],
): PremiumBackgroundCatalogState => ({
  assets,
  unlockedIds: [],
  authenticated: false,
  activeSupporter: false,
  accessExpiresAt: null,
  loading: false,
  ready: true,
  lastCheckedAt: null,
  error: null,
  revision: 1,
})

describe('the Broadway Theater, in the app', () => {
  it("is the Karaoke room's default", () => {
    expect(defaultBackground('karaoke').id).toBe('karaoke-broadway-theater')
  })

  it('is free, packaged, and drawn in both orientations', () => {
    const broadway = getBackgroundDefinition('karaoke-broadway-theater')
    expect(broadway?.access).toEqual({ kind: 'free' })
    expect(broadway?.delivery).toBe('shipped')
    expect(broadway?.assetSource).toEqual({
      kind: 'public',
      landscape: '/karaoke/broadway-theater-landscape.webp',
      portrait: '/karaoke/broadway-theater-portrait.webp',
    })
    expect(broadway?.label).toBe('Broadway Theater')
  })

  it('is one of the free rooms the picker offers, beside the others', () => {
    expect(listBackgrounds('karaoke').map((room) => room.id)).toEqual([
      'karaoke-theatre',
      'karaoke-tokyo-cyber',
      'karaoke-broadway-theater',
    ])
  })

  it('is listed once, not again as a supporter room from the server', () => {
    const rooms = listRuntimeBackgrounds(
      'karaoke',
      state([
        serverAsset('karaoke-broadway-theater', 'Broadway Theater'),
        serverAsset('karaoke-jazz-club', 'Jazz Club'),
      ]),
      1,
      'portrait',
    )

    expect(
      rooms.filter((room) => room.id === 'karaoke-broadway-theater'),
    ).toEqual([
      expect.objectContaining({
        access: 'free',
        publicUrl: '/karaoke/broadway-theater-portrait.webp',
      }),
    ])
    expect(rooms.find((room) => room.id === 'karaoke-jazz-club')?.access).toBe(
      'locked',
    )
  })
})
