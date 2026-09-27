// Frost platform delivery — real decoded geometry retains measured contacts and separate glass/trim materials.

import { readFileSync } from 'node:fs'
import type { Mesh, MeshPhysicalMaterial } from 'three'
import { Texture } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW, CLOUDWAY_CRYSTAL_PROMENADE_STUDY, } from '../content/cloudway-laboratory'
import { CLOUDWAY_LAB_PLATFORM_RENDER_IDS, CLOUDWAY_LAB_RIGID_MATERIAL_ROLES, CLOUDWAY_LAB_ROOT_NAMES, } from './cloudway-laboratory-catalog'
import { validateCloudwayLaboratoryStaticDonor } from './cloudway-laboratory-static-contract'
import { disposeObject } from './dispose'

const cases = [
  { key: 'frostLily', id: 'frost-lily-step' },
  { key: 'auroraGlide', id: 'aurora-glide-raft' },
] as const

describe('shipped frost platform contacts and materials', () => {
  it.each(cases)(
    'loads $id without changing its certified contact or triangle inventory',
    async ({ key, id }) => {
      const bytes = readFileSync(
        new URL(
          `../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/${id}/${id}-runtime-v2.glb`,
          import.meta.url,
        ),
      )
      const loader = new GLTFLoader()
        .setMeshoptDecoder(MeshoptDecoder)
        .register(() => ({
          // Replace the registered WebP plugin before it requests browser image APIs.
          name: 'EXT_texture_webp',
          loadTexture: async () => new Texture(),
        }))
      const scene = (
        await loader.parseAsync(
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ),
          '',
        )
      ).scene
      const source = scene.getObjectByName(CLOUDWAY_LAB_ROOT_NAMES[key])!
      expect(source).toBeDefined()
      const roles = CLOUDWAY_LAB_RIGID_MATERIAL_ROLES[key]
      const { collider, metadata } = validateCloudwayLaboratoryStaticDonor(
        source,
        id,
        roles,
      )
      expect(metadata.geometry).toMatchObject({
        decimated: false,
        remeshed: false,
      })
      source.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        const material = mesh.material as MeshPhysicalMaterial
        expect(material.map).not.toBeNull()
        expect(material.normalMap).not.toBeNull()
        const role = Object.entries(roles).find(
          ([name]) => name === material.name,
        )?.[1]
        if (role === 'opaque') {
          expect(material.roughnessMap).not.toBeNull()
          expect(material.metalnessMap).not.toBeNull()
          expect(material.transmission ?? 0).toBe(0)
        } else {
          expect(role).toBe('glass')
          expect(material.transmission).toBeGreaterThan(0.5)
          expect(material.metalness).toBe(0)
          expect(material.roughness).toBeGreaterThan(0.1)
          expect(material.roughness).toBeLessThan(0.25)
        }
        const geometry = mesh.geometry
        const positions = geometry.getAttribute('position')
        for (const attribute of Object.values(geometry.attributes)) {
          expect(attribute.count).toBe(positions.count)
          expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true)
        }
        expect(geometry.getAttribute('normal')).toBeDefined()
        expect(geometry.getAttribute('uv')).toBeDefined()
      })
      for (const level of [
        CLOUDWAY_CRYSTAL_PROMENADE_STUDY,
        CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW,
      ]) {
        const placements = level.platforms.filter(
          (platform) =>
            platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS[key],
        )
        expect(placements.length).toBeGreaterThan(0)
        for (const platform of placements) {
          const turned = (platform.renderQuarterTurns ?? 0) % 2 !== 0
          expect(platform.maxX - platform.minX).toBeCloseTo(
            turned ? collider.depth : collider.width,
            8,
          )
          expect(platform.maxZ - platform.minZ).toBeCloseTo(
            turned ? collider.width : collider.depth,
            8,
          )
          expect(platform.thickness).toBeCloseTo(collider.height, 8)
        }
      }
      disposeObject(scene)
    },
  )
})
