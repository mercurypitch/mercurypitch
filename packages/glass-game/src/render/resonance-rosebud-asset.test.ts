// Resonance Rosebud runtime contract — one reviewed bundle keeps its hierarchy, fracture and metre-valued optics after display scaling.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Object3D, } from 'three'
import { Box3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { LIVING_GLASS_TRIAL } from '../content/living-glass-trial'
import { RESONANCE_ROSEBUD_BUNDLE_ID, RESONANCE_ROSEBUD_DISPLAY_HEIGHT, RESONANCE_ROSEBUD_MATERIAL_OPTICS, RESONANCE_ROSEBUD_MATERIALS, RESONANCE_ROSEBUD_NODES, RESONANCE_ROSEBUD_RUNTIME, RESONANCE_ROSEBUD_SHARD_COUNT, RESONANCE_ROSEBUD_VARIANT_ID, } from '../content/resonance-rosebud-profile'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'
import { RESONANCE_PEARL_PALETTE } from './resonance-release-config'
import { createVessel } from './vessels'

function delivery(): Buffer {
  return readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[RESONANCE_ROSEBUD_BUNDLE_ID]}`,
      import.meta.url,
    ),
  )
}

async function load(): Promise<Object3D> {
  const bytes = delivery()
  const payload = new Uint8Array(bytes.byteLength)
  payload.set(bytes)
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(payload.buffer, '')
  ).scene
}

function triangles(node: Object3D): number {
  let count = 0
  node.traverse((object) => {
    const mesh = object as Mesh<BufferGeometry>
    if (!mesh.isMesh) return
    count +=
      (mesh.geometry.getIndex()?.count ??
        mesh.geometry.getAttribute('position').count) / 3
  })
  return count
}

function physicalMaterial(
  materials: readonly unknown[],
  name: string,
): MeshPhysicalMaterial {
  const material = materials.find(
    (candidate) => (candidate as MeshPhysicalMaterial).name === name,
  ) as MeshPhysicalMaterial | undefined
  expect(material?.isMeshPhysicalMaterial).toBe(true)
  return material!
}

function sourcePhysicalMaterial(
  root: Object3D,
  name: string,
): MeshPhysicalMaterial {
  let found: MeshPhysicalMaterial | undefined
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    const candidate = materials.find((material) => material.name === name) as
      | MeshPhysicalMaterial
      | undefined
    if (candidate?.isMeshPhysicalMaterial === true) found = candidate
  })
  expect(found).toBeDefined()
  return found!
}

describe('shipped Resonance Rosebud', () => {
  it('matches the accepted hierarchy, hash and intact/fracture budgets', async () => {
    const bytes = delivery()
    expect(bytes.byteLength).toBe(RESONANCE_ROSEBUD_RUNTIME.bytes)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      RESONANCE_ROSEBUD_RUNTIME.sha256,
    )

    const scene = await load()
    const root = scene.getObjectByName(RESONANCE_ROSEBUD_NODES.root)!
    const intact = root.getObjectByName(RESONANCE_ROSEBUD_NODES.intact)!
    const fragments = root.getObjectByName(RESONANCE_ROSEBUD_NODES.fragments)!
    expect(root).toBeDefined()
    expect(intact.parent).toBe(root)
    expect(fragments.parent).toBe(root)
    expect(
      intact.getObjectByName(RESONANCE_ROSEBUD_NODES.intactMesh),
    ).toBeDefined()
    expect(triangles(intact)).toBe(RESONANCE_ROSEBUD_RUNTIME.intactTriangles)
    expect(triangles(fragments)).toBe(
      RESONANCE_ROSEBUD_RUNTIME.fractureTriangles,
    )
    expect(fragments.children.map((child) => child.name)).toEqual(
      Array.from(
        { length: RESONANCE_ROSEBUD_SHARD_COUNT },
        (_, index) =>
          `${RESONANCE_ROSEBUD_NODES.shardPrefix}${String(index).padStart(3, '0')}`,
      ),
    )
    disposeObject(scene)
  })

  it('normalizes material units exactly once across repeated preparation', async () => {
    const scene = await load()
    const recipe = getBreakableRenderRecipe(RESONANCE_ROSEBUD_VARIANT_ID)
    const library = createMaterialLibrary()
    const sourceIntact = scene.getObjectByName(RESONANCE_ROSEBUD_NODES.intact)!
    const sourceBounds = new Box3().setFromObject(sourceIntact)
    const sourceHeight = sourceBounds.max.y - sourceBounds.min.y
    expect(Math.abs(sourceHeight - recipe.sourceHeight!)).toBeLessThan(0.0001)
    const scale = recipe.displayHeight / sourceHeight
    const sourceUnits = new Map(
      [
        RESONANCE_ROSEBUD_MATERIALS.glass,
        RESONANCE_ROSEBUD_MATERIALS.fractureInterior,
      ].map((name) => {
        const material = sourcePhysicalMaterial(scene, name)
        return [
          name,
          {
            thickness: material.thickness,
            attenuationDistance: material.attenuationDistance,
          },
        ] as const
      }),
    )
    const first = prepareExhibitAsset(
      scene,
      recipe,
      RESONANCE_ROSEBUD_BUNDLE_ID,
      library,
    )
    const second = prepareExhibitAsset(
      scene,
      recipe,
      RESONANCE_ROSEBUD_BUNDLE_ID,
      library,
    )

    expect(first.pieces).toHaveLength(RESONANCE_ROSEBUD_SHARD_COUNT)
    expect(first.materials.map((material) => material.name)).toEqual([
      RESONANCE_ROSEBUD_MATERIALS.glass,
      RESONANCE_ROSEBUD_MATERIALS.trim,
      RESONANCE_ROSEBUD_MATERIALS.fractureInterior,
    ])
    first.geometry.computeBoundingBox()
    const bounds = first.geometry.boundingBox!
    expect(bounds.min.y).toBeCloseTo(0, 6)
    expect(bounds.max.y).toBeCloseTo(RESONANCE_ROSEBUD_DISPLAY_HEIGHT, 6)

    for (const name of [
      RESONANCE_ROSEBUD_MATERIALS.glass,
      RESONANCE_ROSEBUD_MATERIALS.fractureInterior,
    ] as const) {
      const accepted = RESONANCE_ROSEBUD_MATERIAL_OPTICS[name]
      const source = sourceUnits.get(name)!
      const firstMaterial = physicalMaterial(first.materials, name)
      const secondMaterial = physicalMaterial(second.materials, name)
      expect(secondMaterial).toBe(firstMaterial)
      expect(firstMaterial.thickness).toBeCloseTo(source.thickness * scale, 12)
      expect(firstMaterial.attenuationDistance).toBeCloseTo(
        source.attenuationDistance * scale,
        12,
      )
      expect(
        Math.abs(firstMaterial.thickness - accepted.displayThickness) /
          accepted.displayThickness,
      ).toBeLessThan(0.0002)
      expect(
        Math.abs(
          firstMaterial.attenuationDistance -
            accepted.displayAttenuationDistance,
        ) / accepted.displayAttenuationDistance,
      ).toBeLessThan(0.0002)
    }
    const firstGold = first.materials.find(
      (material) => material.name === RESONANCE_ROSEBUD_MATERIALS.trim,
    )!
    const secondGold = second.materials.find(
      (material) => material.name === RESONANCE_ROSEBUD_MATERIALS.trim,
    )!
    expect(secondGold).toBe(firstGold)
    expect(firstGold).not.toBe(
      physicalMaterial(first.materials, RESONANCE_ROSEBUD_MATERIALS.glass),
    )

    const geometries = new Set([
      first.geometry,
      ...first.pieces.map((piece) => piece.geometry),
      second.geometry,
      ...second.pieces.map((piece) => piece.geometry),
    ])
    const geometryDisposals = vi.fn()
    geometries.forEach((geometry) =>
      geometry.addEventListener('dispose', geometryDisposals),
    )
    const materials = new Set(first.materials)
    const materialDisposals = vi.fn()
    materials.forEach((material) =>
      material.addEventListener('dispose', materialDisposals),
    )
    for (const asset of [first, second]) {
      asset.geometry.dispose()
      asset.pieces.forEach((piece) => piece.geometry.dispose())
    }
    expect(geometryDisposals).toHaveBeenCalledTimes(geometries.size)
    library.dispose()
    expect(materialDisposals).toHaveBeenCalledTimes(materials.size)
    disposeObject(scene)
  })

  it('installs the real bundle with a warm Rosebud charge and standard rigid shards', async () => {
    const scene = await load()
    const target = LIVING_GLASS_TRIAL.breakables[0]!
    const vessel = createVessel(target, false)
    const recipe = getBreakableRenderRecipe(RESONANCE_ROSEBUD_VARIANT_ID)
    const asset = prepareExhibitAsset(
      scene,
      recipe,
      RESONANCE_ROSEBUD_BUNDLE_ID,
      vessel.materialLibrary,
    )
    const rose = physicalMaterial(
      asset.materials,
      RESONANCE_ROSEBUD_MATERIALS.glass,
    )
    const gold = asset.materials.find(
      (material) => material.name === RESONANCE_ROSEBUD_MATERIALS.trim,
    ) as MeshStandardMaterial
    const originalGoldEmissive = gold.emissive.getHex()

    vessel.setGeometry(asset.geometry, asset.pieces, asset.materials)
    vessel.update(
      { id: target.id, phase: 'charging', brokenAt: null, charge: 0.93 },
      0.1,
    )

    expect(rose.emissive.getHex()).toBe(RESONANCE_PEARL_PALETTE.crackGlow)
    expect(rose.emissiveIntensity).toBeCloseTo(0.12)
    expect(rose.emissiveIntensity).toBeLessThanOrEqual(0.12)
    expect(gold.emissive.getHex()).toBe(originalGoldEmissive)
    expect(
      vessel.root.getObjectByName(`vessel-shards-${target.id}`)?.children,
    ).toHaveLength(RESONANCE_ROSEBUD_SHARD_COUNT)
    expect(vessel.resonanceSnapshot()).toMatchObject({
      phase: 'charging',
      chargeProgress: 0.93,
    })

    vessel.dispose()
    disposeObject(scene)
  })
})
