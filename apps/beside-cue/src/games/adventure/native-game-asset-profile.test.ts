// Native game asset profile tests — web keeps both tiers while packages stay mobile-only.

import { describe, expect, it } from 'vitest'
import { nativeGameAssetProfile } from './native-game-asset-profile'

describe('native game asset profile', () => {
  it.each(['android', 'ios'])(
    'selects mobile assets for %s-specific builds',
    (platform) => {
      expect(nativeGameAssetProfile(platform, 'web')).toBe('mobile')
    },
  )

  it.each(['android', 'ios'])(
    'selects mobile assets when a prebuilt web bundle runs on %s',
    (platform) => {
      expect(nativeGameAssetProfile(undefined, platform)).toBe('mobile')
    },
  )

  it.each([undefined, '', 'web', 'android-preview'])(
    'leaves an ordinary web runtime adaptive for build marker %s',
    (platform) => {
      expect(nativeGameAssetProfile(platform, 'web')).toBeUndefined()
    },
  )
})
