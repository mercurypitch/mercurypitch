// Singing Current delivery proof — exported optical panes and closed shards retain authored scale through the real loader.

import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh, MeshPhysicalMaterial, Object3D, } from 'three'
import { Box3, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { SINGING_CURRENT_WALL_PROFILES } from '../content/singing-current-wall-profiles'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'

function signedVolume(geometry: BufferGeometry): number {
  const positions = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const count = index?.count ?? positions.count
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3()
  let volume = 0
  for (let offset = 0; offset < count; offset += 3) {
    a.fromBufferAttribute(positions, index?.getX(offset) ?? offset)
    b.fromBufferAttribute(positions, index?.getX(offset + 1) ?? offset + 1)
    c.fromBufferAttribute(positions, index?.getX(offset + 2) ?? offset + 2)
    volume += a.dot(b.cross(c)) / 6
  }
  return volume
}

describe('shipped Singing Current walls', () => {
  it.each(Object.values(SINGING_CURRENT_WALL_PROFILES))(
    '$id retains floor, pane, optics and positive shard volumes without a lane-fit transform',
    async (profile) => {
      const bytes = readFileSync(
        new URL(
          `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[profile.bundle]}`,
          import.meta.url,
        ),
      )
      const scene = (
        await new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .parseAsync(Uint8Array.from(bytes).buffer, '')
      ).scene
      const library = createMaterialLibrary()
      let prepared: ReturnType<typeof prepareExhibitAsset> | undefined
      try {
        const frame = scene.getObjectByName(
          profile.persistentPrefix,
        ) as Object3D
        const intact = scene.getObjectByName(profile.intactNode) as Mesh
        expect(frame).toBeDefined()
        let frameMeshes = 0
        frame.traverse((node) => {
          if ((node as Mesh).isMesh) frameMeshes++
        })
        expect(frameMeshes).toBeGreaterThan(0)
        expect(intact.isMesh).toBe(true)
        const full = new Box3()
          .setFromObject(frame)
          .union(new Box3().setFromObject(intact))
        const dimensions = full.getSize(new Vector3())
        expect(full.min.y).toBeCloseTo(0, 4)
        expect(dimensions.x).toBeCloseTo(profile.presentation.envelope.width, 4)
        expect(dimensions.y).toBeCloseTo(
          profile.presentation.envelope.height,
          4,
        )
        expect(dimensions.z).toBeCloseTo(profile.presentation.envelope.depth, 4)
        const recipe = getBreakableRenderRecipe(profile.presentation.variant)
        prepared = prepareExhibitAsset(scene, recipe, profile.bundle, library)
        expect(prepared.transform.elements).toEqual([
          1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ])
        prepared.geometry.computeBoundingBox()
        expect(prepared.geometry.boundingBox!.min.y).toBeCloseTo(
          profile.paneBounds.min[1]!,
          4,
        )
        expect(prepared.geometry.boundingBox!.max.y).toBeCloseTo(
          profile.paneBounds.max[1]!,
          4,
        )
        expect(prepared.pieces).toHaveLength(profile.shardCount)
        for (const piece of prepared.pieces) {
          expect(signedVolume(piece.geometry)).toBeGreaterThan(1e-8)
          const normal = piece.geometry.getAttribute('normal')
          for (let index = 0; index < normal.count; index++)
            expect(
              Number.isFinite(
                normal.getX(index) + normal.getY(index) + normal.getZ(index),
              ),
            ).toBe(true)
        }
        const optical = prepared.materials.filter(
          (material) => (material as MeshPhysicalMaterial).transmission > 0.8,
        ) as MeshPhysicalMaterial[]
        expect(optical.length).toBeGreaterThan(0)
        for (const material of optical)
          expect(material.thickness).toBeCloseTo(
            profile.presentation.pane.depth,
            5,
          )
        for (const piece of prepared.pieces) {
          const boundOptics = piece.geometry.groups
            .map(
              (group) =>
                prepared!.materials[
                  group.materialIndex ?? 0
                ] as MeshPhysicalMaterial,
            )
            .filter((material) => material.transmission > 0.8)
          expect(boundOptics.length).toBeGreaterThan(0)
          for (const material of boundOptics)
            expect(material.thickness).toBeCloseTo(
              profile.presentation.pane.depth,
              5,
            )
        }
        expect(new Box3().setFromObject(intact).min.y).toBeCloseTo(
          profile.paneBounds.min[1]!,
          4,
        )
      } finally {
        prepared?.geometry.dispose()
        prepared?.pieces.forEach((piece) => piece.geometry.dispose())
        library.dispose()
        disposeObject(scene)
      }
    },
  )
})
