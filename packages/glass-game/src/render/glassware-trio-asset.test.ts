// Glassware delivery proof — exported cavities, optical units and independent shatters survive the real game loader.

import { readFileSync } from 'node:fs'
import type { Material, Mesh, MeshPhysicalMaterial, Object3D } from 'three'
import { Box3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { GLASSWARE_TRIO_PROFILES, GLASSWARE_TRIO_SOURCE_HEIGHT, } from '../content/glassware-trio-profile'
import { GLASSWARE_TRIO_STUDY } from '../content/glassware-trio-study'
import { SHATTER_PLAYBACK_SPEED, SHATTER_PRESENTATION_TIMING, } from '../core/shatter-presentation'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'
import { createVessel } from './vessels'

async function load(bundle: string): Promise<Object3D> {
  const path = GLASS_GAME_ASSET_FILES[bundle]
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${path}`,
      import.meta.url,
    ),
  )
  const payload = Uint8Array.from(bytes)
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(payload.buffer, '')
  ).scene
}

function sourceMaterials(root: Object3D): Material[] {
  const materials = new Set<Material>()
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material])
      materials.add(material)
  })
  return [...materials]
}

for (const [variant, profile] of Object.entries(GLASSWARE_TRIO_PROFILES)) {
  describe(`shipped ${profile.code}`, () => {
    it('loads a complete authored fracture with finite normals and matched intact/shard bounds', async () => {
      const scene = await load(profile.bundle)
      try {
        const intact = scene.getObjectByName(profile.intactNode)!
        const fragments = scene.getObjectByName(profile.fragmentsNode)!
        expect(intact).toBeDefined()
        expect(fragments).toBeDefined()
        expect(fragments.children.map((node) => node.name).sort()).toEqual(
          Array.from(
            { length: profile.shardCount },
            (_, index) =>
              `${profile.shardPrefix}${String(index).padStart(3, '0')}`,
          ),
        )
        const intactBounds = new Box3().setFromObject(intact)
        const fractureBounds = new Box3().setFromObject(fragments)
        expect(intactBounds.max.y - intactBounds.min.y).toBeCloseTo(
          GLASSWARE_TRIO_SOURCE_HEIGHT,
          4,
        )
        expect(fractureBounds.min.distanceTo(intactBounds.min)).toBeLessThan(
          0.001,
        )
        expect(fractureBounds.max.distanceTo(intactBounds.max)).toBeLessThan(
          0.001,
        )
        expect(
          sourceMaterials(scene)
            .map((material) => material.name)
            .sort(),
        ).toEqual(Object.values(profile.materials).sort())
        let invalidComponents = 0
        scene.traverse((node) => {
          const mesh = node as Mesh
          if (!mesh.isMesh) return
          for (const name of ['position', 'normal']) {
            const attribute = mesh.geometry.getAttribute(name)
            expect(attribute).toBeDefined()
            for (let index = 0; index < attribute.count; index++)
              if (
                !Number.isFinite(
                  attribute.getX(index) +
                    attribute.getY(index) +
                    attribute.getZ(index),
                )
              )
                invalidComponents++
          }
        })
        expect(invalidComponents).toBe(0)
      } finally {
        disposeObject(scene)
      }
    })

    it('keeps glass and interior optical distances correct at display scale without tinting its gold', async () => {
      const scene = await load(profile.bundle)
      const library = createMaterialLibrary()
      const recipe = getBreakableRenderRecipe(variant)
      const originals = sourceMaterials(scene)
      const sourceBounds = new Box3().setFromObject(
        scene.getObjectByName(profile.intactNode)!,
      )
      const scale =
        profile.displayHeight / (sourceBounds.max.y - sourceBounds.min.y)
      const first = prepareExhibitAsset(scene, recipe, profile.bundle, library)
      const second = prepareExhibitAsset(scene, recipe, profile.bundle, library)
      try {
        first.geometry.computeBoundingBox()
        expect(first.geometry.boundingBox!.min.y).toBeCloseTo(0, 6)
        expect(first.geometry.boundingBox!.max.y).toBeCloseTo(
          profile.displayHeight,
          6,
        )
        for (const name of [
          profile.materials.glass,
          profile.materials.interior,
        ]) {
          const original = originals.find(
            (material) => material.name === name,
          ) as MeshPhysicalMaterial
          const prepared = first.materials.find(
            (material) => material.name === name,
          ) as MeshPhysicalMaterial
          expect(original.isMeshPhysicalMaterial).toBe(true)
          expect(original.transmission).toBeGreaterThan(0.7)
          expect(original.thickness).toBeGreaterThan(0)
          expect(original.attenuationDistance).toBeGreaterThan(0)
          expect(prepared.thickness).toBeCloseTo(original.thickness * scale, 8)
          expect(prepared.attenuationDistance).toBeCloseTo(
            original.attenuationDistance * scale,
            8,
          )
          expect(
            second.materials.find((material) => material.name === name),
          ).toBe(prepared)
        }
        const gold = first.materials.find(
          (material) => material.name === profile.materials.gold,
        ) as MeshPhysicalMaterial
        expect(gold.metalness).toBeGreaterThan(0.9)
        expect(gold.transmission ?? 0).toBe(0)
      } finally {
        for (const asset of [first, second]) {
          asset.geometry.dispose()
          asset.pieces.forEach((piece) => piece.geometry.dispose())
        }
        library.dispose()
        disposeObject(scene)
      }
    })

    it('charges and breaks only the sung instance; a restored break does not replay its effects', async () => {
      const scene = await load(profile.bundle)
      const definition = GLASSWARE_TRIO_STUDY.breakables.find(
        (exhibit) => exhibit.variant === variant,
      )!
      const first = createVessel(definition, false)
      const neighbour = createVessel(
        { ...definition, id: `${definition.id}/comparison` },
        false,
      )
      const recipe = getBreakableRenderRecipe(variant)
      try {
        for (const vessel of [first, neighbour]) {
          const asset = prepareExhibitAsset(
            scene,
            recipe,
            profile.bundle,
            vessel.materialLibrary,
          )
          vessel.setGeometry(asset.geometry, asset.pieces, asset.materials)
        }
        first.update(
          {
            id: definition.id,
            phase: 'charging',
            charge: 0.92,
            brokenAt: null,
          },
          1,
        )
        neighbour.update(
          {
            id: `${definition.id}/comparison`,
            phase: 'idle',
            charge: 0,
            brokenAt: null,
          },
          1,
        )
        expect(first.resonanceSnapshot()).toMatchObject({
          phase: 'charging',
          chargeProgress: 0.92,
        })
        expect(neighbour.resonanceSnapshot()).toMatchObject({
          phase: 'idle',
          chargeProgress: 0,
        })
        first.update(
          { id: definition.id, phase: 'shattering', charge: 1, brokenAt: 1 },
          1 +
            (SHATTER_PRESENTATION_TIMING.normal.anticipationSeconds +
              SHATTER_PRESENTATION_TIMING.normal.visibleFlightSeconds * 0.1) /
              SHATTER_PLAYBACK_SPEED.default,
        )
        expect(first.resonanceSnapshot()).toMatchObject({ phase: 'releasing' })
        expect(neighbour.resonanceSnapshot()).toMatchObject({ phase: 'idle' })
        first.update(
          { id: definition.id, phase: 'complete', charge: 1, brokenAt: null },
          8,
        )
        expect(first.resonanceSnapshot()).toMatchObject({ phase: 'restored' })
      } finally {
        first.dispose()
        neighbour.dispose()
        disposeObject(scene)
      }
    })
  })
}
