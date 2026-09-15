// Real exhibit imports — indexed material regions and complete closed fragments survive the runtime adapter.
import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh, MeshPhysicalMaterial, Object3D, } from 'three'
import { Box3, Matrix4, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'

async function load(file: string) {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${file}`,
      import.meta.url,
    ),
  )
  return (
    await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene
}

function volume(geometry: BufferGeometry) {
  const p = geometry.getAttribute('position'),
    index = geometry.index!
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3()
  let result = 0
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(p, index.getX(i))
    b.fromBufferAttribute(p, index.getX(i + 1))
    c.fromBufferAttribute(p, index.getX(i + 2))
    result += a.dot(b.cross(c)) / 6
  }
  return result
}

function triangles(node: Object3D) {
  let count = 0
  node.traverse((child) => {
    const mesh = child as Mesh
    if (mesh.isMesh)
      count +=
        (mesh.geometry.index?.count ??
          mesh.geometry.getAttribute('position').count) / 3
  })
  return count
}

describe('complete indexed exhibit assets', () => {
  it.each([
    ['fluted', 'fluted-carafe'],
    ['amphora', 'moon-amphora'],
    ['coupe', 'aurora-coupe'],
    ['decanter', 'cut-crystal-decanter'],
  ])(
    'preserves real %s geometry, physical materials and all 23 fragments',
    async (id, file) => {
      const scene = await load(`adventure-v3/${file}.glb`)
      const recipe = getBreakableRenderRecipe(id)
      const source = scene.getObjectByName(recipe.intactNode!)!
      if (id === 'decanter') expect(source.children).toHaveLength(2)
      const library = createMaterialLibrary()
      const asset = prepareExhibitAsset(scene, recipe, recipe.bundle!, library)
      expect(asset.pieces).toHaveLength(23)
      expect(asset.geometry.index!.count / 3).toBe(triangles(source))
      const intactVolume = volume(asset.geometry)
      expect(intactVolume).toBeGreaterThan(0)
      let fragmentVolume = 0,
        indexedBytes = 0,
        expandedBytes = 0
      for (const geometry of [
        asset.geometry,
        ...asset.pieces.map((piece) => piece.geometry),
      ]) {
        expect(geometry.index).not.toBeNull()
        const count = geometry.getAttribute('position').count
        for (const name of ['normal', 'uv', 'tangent'])
          expect(geometry.getAttribute(name).count).toBe(count)
        expect(
          geometry.groups.reduce((sum, group) => sum + group.count, 0),
        ).toBe(geometry.index!.count)
        for (const group of geometry.groups)
          expect(asset.materials[group.materialIndex!]).toBeDefined()
        for (const attribute of Object.values(geometry.attributes)) {
          indexedBytes += attribute.array.byteLength
          expandedBytes += geometry.index!.count * attribute.itemSize * 4
        }
        indexedBytes += geometry.index!.array.byteLength
      }
      for (const piece of asset.pieces) {
        const value = volume(piece.geometry)
        expect(value).toBeGreaterThan(0)
        fragmentVolume += value
      }
      expect(Math.abs(fragmentVolume / intactVolume - 1)).toBeLessThan(0.00001)
      expect(indexedBytes).toBeLessThan(expandedBytes * 0.6)
      const materialNames = asset.materials.map((material) => material.name)
      expect(new Set(materialNames)).toEqual(
        new Set(['glass_shell', 'glass_cut', 'gold_trim']),
      )
      const physical = asset.materials as MeshPhysicalMaterial[]
      expect(
        physical.find((material) => material.name === 'glass_shell')!
          .transmission,
      ).toBeGreaterThan(0.9)
      expect(
        physical.find((material) => material.name === 'gold_trim')!.metalness,
      ).toBeCloseTo(0.95, 6)
      asset.geometry.computeBoundingBox()
      expect(asset.geometry.boundingBox!.min.y).toBeCloseTo(0, 6)
      expect(asset.geometry.boundingBox!.max.y).toBeCloseTo(
        recipe.displayHeight,
        6,
      )
      const assembled = new Box3()
      for (const piece of asset.pieces) {
        piece.geometry.computeBoundingBox()
        assembled.union(
          piece.geometry
            .boundingBox!.clone()
            .applyMatrix4(
              new Matrix4().makeTranslation(...piece.centre.toArray()),
            ),
        )
      }
      expect(
        assembled.min.distanceTo(asset.geometry.boundingBox!.min),
      ).toBeLessThan(0.00001)
      expect(
        assembled.max.distanceTo(asset.geometry.boundingBox!.max),
      ).toBeLessThan(0.00001)
      console.log(
        `EXHIBIT_MEMORY ${JSON.stringify({ id, indexedBytes, expandedBytes, triangles: (asset.geometry.index!.count + asset.pieces.reduce((n, p) => n + p.geometry.index!.count, 0)) / 3 })}`,
      )
      asset.geometry.dispose()
      asset.pieces.forEach((piece) => piece.geometry.dispose())
      library.dispose()
      disposeObject(scene)
    },
  )

  it('rejects missing, duplicated or unexpected fragment roots before cloning materials', async () => {
    const scene = await load('adventure-v3/fluted-carafe.glb')
    const recipe = getBreakableRenderRecipe('fluted'),
      library = createMaterialLibrary()
    const shard = scene.getObjectByName('vase_fluted_shard_022')!,
      parent = shard.parent!
    shard.removeFromParent()
    expect(() =>
      prepareExhibitAsset(scene, recipe, recipe.bundle!, library),
    ).toThrow('vase_fluted_shard_022')
    expect(library.materials.size).toBe(0)
    parent.add(shard)
    const duplicate = shard.clone()
    parent.add(duplicate)
    expect(() =>
      prepareExhibitAsset(scene, recipe, recipe.bundle!, library),
    ).toThrow('exactly one')
    expect(library.materials.size).toBe(0)
    duplicate.name = 'vase_fluted_shard_023'
    expect(() =>
      prepareExhibitAsset(scene, recipe, recipe.bundle!, library),
    ).toThrow('Unexpected fracture node')
    expect(library.materials.size).toBe(0)
    duplicate.removeFromParent()
    disposeObject(scene)
  })

  it('accepts the declared 16-piece legacy fallback and rejects it as the 23-piece preferred asset', async () => {
    const scene = await load('adventure/vessels.glb')
    const recipe = getBreakableRenderRecipe('vase'),
      library = createMaterialLibrary()
    expect(() =>
      prepareExhibitAsset(scene, recipe, 'vessels-v2', library),
    ).toThrow('vase_rounded_shard_016')
    expect(library.materials.size).toBe(0)
    const legacy = prepareExhibitAsset(scene, recipe, 'vessels', library)
    expect(legacy.pieces).toHaveLength(16)
    legacy.geometry.dispose()
    legacy.pieces.forEach((piece) => piece.geometry.dispose())
    library.dispose()
    disposeObject(scene)
  })
})
