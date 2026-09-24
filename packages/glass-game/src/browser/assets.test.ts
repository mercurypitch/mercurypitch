// ============================================================
// Glassworks asset contract tests — keep hosts and offline packages on one map
// ============================================================

import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES, GLASS_GAME_ON_DEMAND_ASSET_IDS, GLASS_GAME_REQUIRED_FILES, glassGameAssetPath, glassGameAssetUrl, } from './assets'

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

  it('includes every cold campaign byte once in the offline allowlist', () => {
    const required = new Set(GLASS_GAME_REQUIRED_FILES)
    const onDemand = new Set<string>(GLASS_GAME_ON_DEMAND_ASSET_IDS)

    expect(required.size).toBe(GLASS_GAME_REQUIRED_FILES.length)
    for (const [id, path] of Object.entries(GLASS_GAME_ASSET_FILES))
      expect(required.has(path), path).toBe(!onDemand.has(id))
    expect(required.has('adventure-v6/manifest.json')).toBe(true)
    expect(required.has('adventure-v6/amber-cadence-urn-qa-v2.glb')).toBe(true)
    expect(
      required.has('adventure-v6/celadon-lark-decanter-fracture-v4.glb'),
    ).toBe(true)
    expect(required.has('adventure-v7/manifest.json')).toBe(true)
    expect(required.has('adventure-v7/listening-garden.webp')).toBe(true)
    expect(required.has('adventure-v7/wave-keeper.webp')).toBe(true)
    expect(required.has('journey-map-v1/floating-museum-map-kit-v1.glb')).toBe(
      true,
    )
    expect(required.has('journey-map-v1/manifest.json')).toBe(true)
    expect(
      required.has('journey-map-v8/floating-museum-architecture-kit-v8.glb'),
    ).toBe(true)
    expect(required.has('journey-map-v8/manifest.json')).toBe(true)
    expect(
      required.has('journey-map-v10/floating-museum-botanical-kit-v10.glb'),
    ).toBe(true)
    expect(required.has('journey-map-v10/manifest.json')).toBe(true)
    expect(required.has('journey-map-v4/manifest.json')).toBe(false)
    expect(required.has('journey-map-v7/manifest.json')).toBe(false)
    expect(required.has('cloudway-v7/cloudway-platform-kit-v7.glb')).toBe(true)
    expect(required.has('cloudway-v7/manifest.json')).toBe(true)
    expect(required.has('cloudway-v6/cloudway-platform-kit-v6.glb')).toBe(false)
    expect(required.has('cloudway-v6/manifest.json')).toBe(false)
    expect(required.has('cloudway-v3/cloudway-platform-kit-v3.glb')).toBe(false)
    expect(required.has('cloudway-v3/cloudway-ribbon-preview.webp')).toBe(true)
    expect(required.has('cloudway-v3/manifest.json')).toBe(true)
    expect(required.has('adventure-voice-v2/manifest.json')).toBe(true)
    expect(glassGameAssetPath('merc-encore-light-v5')).toBe(
      'adventure-voice/merc-encore-light-v5.mp3',
    )
    expect(glassGameAssetPath('merc-encore-home-v5')).toBe(
      'adventure-voice/merc-encore-home-v5.mp3',
    )
  })
})
