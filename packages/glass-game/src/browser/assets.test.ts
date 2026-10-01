// ============================================================
// Glassworks asset contract tests — keep hosts and offline packages on one map
// ============================================================

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES, GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS, GLASS_GAME_ON_DEMAND_ASSET_IDS, GLASS_GAME_REQUIRED_FILES, glassGameAssetPath, glassGameAssetUrl, } from './assets'

describe('Glassworks asset contract', () => {
  it('loads the same inventory directly in Node for native and web packaging', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '--input-type=module',
        '--eval',
        `import { GLASS_GAME_REQUIRED_FILES } from '@irchiinnuss/glass-game/assets';
         process.stdout.write(JSON.stringify(GLASS_GAME_REQUIRED_FILES));`,
      ],
      {
        cwd: fileURLToPath(new URL('../../', import.meta.url)),
        encoding: 'utf8',
        timeout: 10_000,
      },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(GLASS_GAME_REQUIRED_FILES)
  })

  it('resolves the same authored ID beneath any host-owned base', () => {
    expect(glassGameAssetUrl('merc', '/games')).toBe(
      '/games/glass3d/merc-v2.glb',
    )
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

  it('delivers every named asset and dependency once, including on-demand examples', () => {
    const required = new Set(GLASS_GAME_REQUIRED_FILES)

    expect(required.size).toBe(GLASS_GAME_REQUIRED_FILES.length)
    for (const path of Object.values(GLASS_GAME_ASSET_FILES))
      expect(required.has(path), path).toBe(true)
    for (const id of GLASS_GAME_ON_DEMAND_ASSET_IDS)
      expect(required.has(glassGameAssetPath(id)), id).toBe(true)
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
    expect(required.has('cloudway-v7/cloudway-platform-kit-v7.gltf')).toBe(true)
    expect(required.has('cloudway-v7/cloudway-platform-kit-v7.glb')).toBe(false)
    for (const part of ['01', '02', '03', '04'])
      expect(
        required.has(`cloudway-v7/cloudway-platform-kit-v7-part-${part}.bin`),
      ).toBe(true)
    expect(required.has('cloudway-v7/manifest.json')).toBe(true)
    expect(required.has('cloudway-v6/cloudway-platform-kit-v6.glb')).toBe(false)
    expect(required.has('cloudway-v6/manifest.json')).toBe(false)
    expect(required.has('cloudway-v3/cloudway-platform-kit-v3.glb')).toBe(false)
    expect(required.has('cloudway-v3/cloudway-ribbon-preview.webp')).toBe(true)
    expect(required.has('cloudway-v3/manifest.json')).toBe(true)
    expect(required.has('adventure-voice-v2/manifest.json')).toBe(true)
    expect(required.has('glassware-trio-v1/manifest.json')).toBe(true)
    for (const id of [
      'g01-sunlit-diadem',
      'g14-tidal-wave-carafe',
      'g22-aurora-lotus-bowl',
    ]) {
      expect(glassGameAssetPath(id)).toBe(`glassware-trio-v1/${id}.glb`)
      expect(required.has(glassGameAssetPath(id))).toBe(true)
    }
    expect(
      GLASS_GAME_REQUIRED_FILES.some((path) =>
        path.includes('adventure-voice/merc-encore-'),
      ),
    ).toBe(false)
    expect(glassGameAssetPath('living-crystal-platform-v2')).toBe(
      'crystal-interiors-v2/living-crystal-platform-v2.glb',
    )
    expect(glassGameAssetPath('cloudway-lab-rose-hex-crumble-mobile-v3')).toBe(
      'cloudway-laboratory-v1/optional-platforms/rose-crystal-hex-crumble/rose-crystal-hex-crumble-mobile-v3.glb',
    )
    expect(glassGameAssetPath('cloudway-lab-frost-gold-arch-desktop-v1')).toBe(
      'cloudway-laboratory-v1/optional-exhibits/frost-gold-arch-breakwall-a/frost-gold-arch-breakwall-a-desktop-v1.glb',
    )
    expect(glassGameAssetPath('results-singing-medal-v1')).toBe(
      'results-ui-v1/singing-medal.webp',
    )
    expect(glassGameAssetPath('results-discovery-medal-v1')).toBe(
      'results-ui-v1/discovery-medal.webp',
    )
  })

  it('pairs every native-excluded desktop GLB with a distinct shipped mobile GLB', () => {
    expect(GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS).toHaveLength(3)
    for (const pair of GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS) {
      expect(pair.desktop).toMatch(/-desktop-v\d+\.glb$/u)
      expect(pair.mobile).toMatch(/-mobile-v\d+\.glb$/u)
      expect(pair.mobile).not.toBe(pair.desktop)
      expect(GLASS_GAME_REQUIRED_FILES).toContain(pair.desktop)
      expect(GLASS_GAME_REQUIRED_FILES).toContain(pair.mobile)
    }
  })
})
