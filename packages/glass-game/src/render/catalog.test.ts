// Render catalog contract — recipes resolve to actual delivered GLB nodes.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BREAKABLE_RENDER_CATALOG, getBreakableRenderRecipe, getPlatformRenderRecipe, } from './catalog'
import { getMuseumSceneRecipe } from './scene-catalog'

describe('data-driven exhibit recipes', () => {
  it('resolves every authored intact and matching shard prefix in the asset bundles', () => {
    const files: Record<string, string> = {
      vessels: 'vessels.glb',
      'legend-slab': 'legend-slab.glb',
    }
    for (const recipe of Object.values(BREAKABLE_RENDER_CATALOG)) {
      if (recipe.bundle === undefined) continue
      const bytes = readFileSync(
        new URL(
          `../../../../apps/beside-cue/public/games/adventure/${files[recipe.bundle]}`,
          import.meta.url,
        ),
      )
      const jsonLength = bytes.readUInt32LE(12)
      const gltf = JSON.parse(
        bytes.subarray(20, 20 + jsonLength).toString(),
      ) as { nodes: { name?: string }[] }
      expect(gltf.nodes.some((node) => node.name === recipe.intactNode)).toBe(
        true,
      )
      const shards = gltf.nodes.filter(
        (node) => node.name?.startsWith(recipe.shardPrefix ?? 'never') === true,
      )
      expect(shards.length).toBeGreaterThan(0)
      expect(shards.length).toBeLessThanOrEqual(24)
    }
  })
  it('rejects unknown visual IDs instead of silently replacing their design', () => {
    expect(() => getBreakableRenderRecipe('missing-legend')).toThrow(
      'Unknown glass exhibit',
    )
    expect(() => getPlatformRenderRecipe('missing-floor')).toThrow(
      'Unknown museum platform',
    )
  })
  it('does not attach Glassworks landmarks to a newly authored level', () => {
    const scene = getMuseumSceneRecipe('another-level')
    expect(scene.archPlatforms).toEqual([])
    expect(scene.planterPlatforms).toEqual([])
    expect(scene.kitDecorations).toEqual([])
    expect(scene.observatories).toEqual([])
    expect(scene.skyTexture).toBeUndefined()
    expect(
      getMuseumSceneRecipe('glassworks').kitDecorations.length,
    ).toBeGreaterThan(0)
  })
})
