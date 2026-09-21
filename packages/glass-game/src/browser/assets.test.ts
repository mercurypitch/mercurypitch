// ============================================================
// Glassworks asset contract tests — keep hosts and offline packages on one map
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES, GLASS_GAME_REQUIRED_FILES, glassGameAssetPath, glassGameAssetUrl, } from './assets'

describe('Glassworks asset contract', () => {
  it('resolves the same authored ID beneath any host-owned base', () => {
    expect(glassGameAssetUrl('museum-window-v4', '/glass-game-assets')).toBe(
      '/glass-game-assets/adventure-v4/museum-window-bay.glb',
    )
    expect(glassGameAssetUrl('museum-window-v4', 'games/')).toBe(
      'games/adventure-v4/museum-window-bay.glb',
    )
  })

  it('preserves the authored fallback for development-only assets', () => {
    expect(glassGameAssetPath('fixture-vessel')).toBe(
      'adventure/fixture-vessel',
    )
  })

  it('includes every mapped campaign byte once in the offline allowlist', () => {
    const required = new Set(GLASS_GAME_REQUIRED_FILES)

    expect(required.size).toBe(GLASS_GAME_REQUIRED_FILES.length)
    for (const path of Object.values(GLASS_GAME_ASSET_FILES))
      expect(required.has(path), path).toBe(true)
    expect(required.has('adventure-v6/manifest.json')).toBe(true)
    expect(required.has('adventure-v6/amber-cadence-urn.glb')).toBe(true)
    expect(required.has('adventure-v7/manifest.json')).toBe(true)
    expect(required.has('adventure-v7/listening-garden.webp')).toBe(true)
    expect(required.has('adventure-v7/wave-keeper.webp')).toBe(true)
    expect(required.has('journey-map-v1/floating-museum-map-kit-v1.glb')).toBe(
      true,
    )
    expect(required.has('journey-map-v1/manifest.json')).toBe(true)
    expect(required.has('adventure-voice-v2/manifest.json')).toBe(true)
  })
})
