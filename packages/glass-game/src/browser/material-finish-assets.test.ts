// Material delivery proof — recipes resolve to hash-verified maps included in native bundles.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MATERIAL_FINISH_FILES, MATERIAL_FINISH_RECIPES, } from '../content/material-finishes'
import { GLASS_GAME_REQUIRED_FILES, glassGameAssetPath } from './assets'

const root = fileURLToPath(
  new URL('../../../../apps/beside-cue/public/games/', import.meta.url),
)

describe('material finish delivery', () => {
  it('ships every recipe map with matching provenance and bounded image dimensions', () => {
    const manifestPath = 'material-finish-v1/manifest.json'
    const manifest = JSON.parse(
      readFileSync(`${root}${manifestPath}`, 'utf8'),
    ) as {
      textures: {
        assetId: string
        path: string
        bytes: number
        sha256: string
        width: number
        height: number
      }[]
    }
    expect(GLASS_GAME_REQUIRED_FILES).toContain(manifestPath)
    const recipeIds = new Set(
      Object.values(MATERIAL_FINISH_RECIPES).flatMap((recipe) =>
        Object.values(recipe.maps).map((map) => map.assetId),
      ),
    )
    expect(new Set(Object.keys(MATERIAL_FINISH_FILES))).toEqual(recipeIds)
    expect(new Set(manifest.textures.map((file) => file.assetId))).toEqual(
      recipeIds,
    )
    let totalBytes = 0
    for (const file of manifest.textures) {
      const path = `material-finish-v1/${file.path}`
      expect(glassGameAssetPath(file.assetId)).toBe(path)
      expect(GLASS_GAME_REQUIRED_FILES).toContain(path)
      const bytes = readFileSync(`${root}${path}`)
      expect(bytes.length).toBe(file.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(bytes.readUInt32BE(16)).toBe(file.width)
      expect(bytes.readUInt32BE(20)).toBe(file.height)
      expect(file.width).toBeLessThanOrEqual(512)
      expect(file.height).toBeLessThanOrEqual(512)
      totalBytes += bytes.length
    }
    expect(totalBytes).toBeLessThan(600_000)
  })
})
