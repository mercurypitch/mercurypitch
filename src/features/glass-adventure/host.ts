// Glassworks web host — keeps museum storage and assets isolated from every other room.

import type { GlassGameHost } from '@irchiinnuss/glass-game'
import { glassGameAssetUrl } from '@irchiinnuss/glass-game/assets'
import { createBrowserGlassHost } from '@irchiinnuss/glass-game/browser'

export const MERCURY_GLASS_STORAGE_PREFIX =
  'mercurypitch:glass-adventure' as const

export function createMercuryGlassHost(onExit: () => void): GlassGameHost {
  return createBrowserGlassHost({
    storagePrefix: MERCURY_GLASS_STORAGE_PREFIX,
    assetUrl: (id) => glassGameAssetUrl(id, '/glass-game-assets/'),
    onExit,
  })
}
