// Render catalog contract — recipes resolve to actual delivered GLB nodes.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BREAKABLE_RENDER_CATALOG, getBreakableRenderRecipe, getPlatformRenderRecipe, } from './catalog'
import { getMuseumSceneRecipe } from './scene-catalog'

describe('data-driven exhibit recipes', () => {
  it('resolves every authored intact and matching shard prefix in the asset bundles', () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL(
          '../../../../apps/beside-cue/public/games/adventure-v3/manifest.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      assets: {
        id: string
        file: string
        sha256: string
        intactNode?: string
        shardPrefix?: string
        shardCount?: number
        node?: string
      }[]
    }
    const files: Record<string, string> = {
      vessels: 'adventure/vessels.glb',
      'vessels-v2': 'adventure-v2/vessels.glb',
      'legend-slab': 'adventure/legend-slab.glb',
      ...Object.fromEntries(
        manifest.assets.map((asset) => [
          asset.id,
          `adventure-v3/${asset.file}`,
        ]),
      ),
    }
    const read = (id: string) => {
      const bytes = readFileSync(
        new URL(
          `../../../../apps/beside-cue/public/games/${files[id]}`,
          import.meta.url,
        ),
      )
      const receipt = manifest.assets.find((asset) => asset.id === id)
      if (receipt)
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          receipt.sha256,
        )
      return JSON.parse(
        bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
      ) as { nodes: { name?: string }[] }
    }
    for (const recipe of Object.values(BREAKABLE_RENDER_CATALOG)) {
      if (recipe.bundle === undefined) continue
      const resolved =
        getMuseumSceneRecipe('glassworks').preferredBundles?.[recipe.bundle] ??
        recipe.bundle
      const gltf = read(resolved)
      expect(gltf.nodes.some((node) => node.name === recipe.intactNode)).toBe(
        true,
      )
      const count = recipe.bundleShardCounts?.[resolved] ?? recipe.shardCount
      for (let i = 0; i < count; i++)
        expect(
          gltf.nodes.filter(
            (node) =>
              node.name ===
              `${recipe.shardPrefix}${String(i).padStart(3, '0')}`,
          ),
        ).toHaveLength(1)
      expect(
        gltf.nodes.filter(
          (node) =>
            node.name?.startsWith(recipe.shardPrefix ?? 'never') === true,
        ),
      ).toHaveLength(count)
      const receipt = manifest.assets.find((asset) => asset.id === resolved)
      if (receipt) {
        expect(receipt.intactNode).toBe(recipe.intactNode)
        expect(receipt.shardPrefix).toBe(recipe.shardPrefix)
        expect(receipt.shardCount).toBe(count)
      }
    }
    for (const asset of manifest.assets.filter(
      (asset) => asset.node !== undefined,
    ))
      expect(
        read(asset.id).nodes.some((node) => node.name === asset.node),
      ).toBe(true)
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
