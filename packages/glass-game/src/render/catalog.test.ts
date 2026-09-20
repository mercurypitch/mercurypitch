// Render catalog contract — recipes resolve to actual delivered GLB nodes.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GLASSWORKS } from '../content/glassworks'
import type { LevelDefinition } from '../contracts'
import { BREAKABLE_RENDER_CATALOG, getBreakableRenderRecipe, getPlatformRenderRecipe, } from './catalog'
import { getRoomDecorationRecipe } from './room-decoration-catalog'
import { getMuseumSceneFrame, getMuseumSceneRecipe, getMuseumVisualRecipe, } from './scene-catalog'

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
        getMuseumSceneRecipe(GLASSWORKS).preferredBundles?.[recipe.bundle] ??
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
    expect(() => getMuseumVisualRecipe('missing-landmark')).toThrow(
      'Unknown museum visual',
    )
    expect(() => getRoomDecorationRecipe('missing-decoration')).toThrow(
      'Unknown room decoration',
    )
  })
  it('resolves the enclosed museum visuals to the delivered V4 roots', () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL(
          '../../../../apps/beside-cue/public/games/adventure-v4/manifest.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      assets: { id: string; file: string; node: string; sha256: string }[]
    }

    for (const asset of manifest.assets) {
      const recipe = getMuseumVisualRecipe(asset.id)
      const bytes = readFileSync(
        new URL(
          `../../../../apps/beside-cue/public/games/adventure-v4/${asset.file}`,
          import.meta.url,
        ),
      )
      const gltf = JSON.parse(
        bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
      ) as { nodes: { name?: string }[] }
      expect(recipe).toMatchObject({
        bundle: asset.id,
        node: asset.node,
        scale: 1,
      })
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        asset.sha256,
      )
      expect(gltf.nodes.some((node) => node.name === asset.node)).toBe(true)
    }
  })
  it('does not attach Glassworks landmarks to a newly authored level', () => {
    const scene = getMuseumSceneRecipe({
      ...GLASSWORKS,
      id: 'another-level',
    })
    expect(scene.archPlatforms).toEqual([])
    expect(scene.planterPlatforms).toEqual([])
    expect(scene.kitDecorations).toEqual([])
    expect(scene.observatories).toEqual([])
    expect(scene.skyTexture).toBeUndefined()
    expect(
      getMuseumSceneRecipe(GLASSWORKS).kitDecorations.length,
    ).toBeGreaterThan(0)
  })

  it('themes and frames translated authored rooms from presentation bounds', () => {
    const level: LevelDefinition = {
      ...GLASSWORKS,
      id: 'translated-quarter-turn',
      spawn: {
        position: { x: 103, y: 0, z: -45 },
        facingYaw: Math.PI / 2,
      },
      presentation: {
        worldBounds: {
          minX: 100,
          maxX: 112,
          minY: -2,
          maxY: 4,
          minZ: -48,
          maxZ: -38,
        },
        lightBounds: {
          minX: 102,
          maxX: 110,
          minY: -1,
          maxY: 5,
          minZ: -47,
          maxZ: -39,
        },
        rooms: [],
        audioRegions: [],
        visuals: [],
        assetRecipeIds: ['deck', 'goblet'],
      },
    }
    const scene = getMuseumSceneRecipe(level)
    expect(scene.skyTexture).toBe('museum-sky')
    expect(scene.environment).toBe('museum-environment-v2')
    expect(scene.preferredBundles).toMatchObject({
      'museum-kit': 'museum-kit-v2',
      vessels: 'vessels-v2',
    })
    expect(scene.atmosphereOrigin).toEqual({ x: 106, y: 1, z: -43 })
    expect(scene.reflectionProbe).toEqual({ x: 103, y: 1.15, z: -45 })
    expect(scene.kitDecorations).toEqual([])

    const frame = getMuseumSceneFrame(level)
    expect(frame.lightTarget).toEqual({ x: 106, y: 2, z: -43 })
    expect(frame.keyPosition.x).toBeGreaterThan(90)
    expect(frame.rimPosition.z).toBeLessThan(-43)
    expect(frame.shadowExtent).toBeGreaterThan(5)
    expect(frame.shadowExtent).toBeLessThan(10)
    const worldRadius = Math.hypot(12, 6, 10) / 2
    expect(frame.cameraFar).toBeGreaterThan(
      (scene.skyRadius ?? 0) + worldRadius + 6.5,
    )
    expect(frame.cameraFar).toBeLessThan(70)
  })
})
