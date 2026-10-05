// Singing Current delivery proof — exported optical panes and closed shards retain authored scale through the real loader.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { BufferGeometry, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, } from 'three'
import { Box3, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES, GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS, } from '../browser/assets'
import type { SingingCurrentWallProfile } from '../content/singing-current-wall-profiles'
import { SINGING_CURRENT_WALL_PROFILES } from '../content/singing-current-wall-profiles'
import { resolveAssetProfileBundle } from './asset-profile-bundles'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'

beforeAll(() => {
  vi.stubGlobal('self', globalThis)
  // Node checks the actual PNG header and shared texture binding. This bitmap
  // wrapper does not certify pixels or raster appearance; browser proof does.
  vi.stubGlobal('createImageBitmap', async (blob: Blob) => {
    const bytes = Buffer.from(await blob.arrayBuffer())
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
    return {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      close: () => undefined,
    }
  })
})
afterAll(() => vi.unstubAllGlobals())

async function loadWall(profile: SingingCurrentWallProfile): Promise<Object3D> {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[profile.bundle]}`,
      import.meta.url,
    ),
  )
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(Uint8Array.from(bytes).buffer, '')
  ).scene
}

function boundaryEdgeCount(geometry: BufferGeometry): number {
  const positions = geometry.getAttribute('position')
  const index = geometry.getIndex()
  const keys = Array.from({ length: positions.count }, (_, vertex) =>
    [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)]
      .map((value) => value.toFixed(6))
      .join(','),
  )
  const edges = new Map<string, number>()
  for (
    let offset = 0;
    offset < (index?.count ?? positions.count);
    offset += 3
  ) {
    const triangle = [0, 1, 2].map(
      (corner) => keys[index?.getX(offset + corner) ?? offset + corner]!,
    )
    for (let corner = 0; corner < 3; corner++) {
      const key = [triangle[corner]!, triangle[(corner + 1) % 3]!]
        .sort()
        .join('|')
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  return [...edges.values()].filter((count) => count !== 2).length
}

function signedVolume(geometry: BufferGeometry, transform?: Matrix4): number {
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
    if (transform) {
      a.applyMatrix4(transform)
      b.applyMatrix4(transform)
      c.applyMatrix4(transform)
    }
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
      const manifest = JSON.parse(
        readFileSync(
          new URL(
            '../../../../apps/beside-cue/public/games/singing-current-walls-v1/manifest.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ) as {
        assets: { id: string; delivery: { sha256: string; bytes: number } }[]
      }
      const delivery = manifest.assets.find(
        (asset) => asset.id === profile.id,
      )!.delivery
      expect(bytes.byteLength).toBe(delivery.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        delivery.sha256,
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

  it.each([
    SINGING_CURRENT_WALL_PROFILES.W04,
    SINGING_CURRENT_WALL_PROFILES.W08,
  ])(
    '$id has closed, volumetric perimeter optics with scalar materials',
    async (profile) => {
      const scene = await loadWall(profile)
      scene.updateMatrixWorld(true)
      try {
        const borders: Mesh[] = []
        scene.traverse((node) => {
          const mesh = node as Mesh
          if (
            mesh.isMesh &&
            !Array.isArray(mesh.material) &&
            mesh.material.name === `${profile.id} colored border glass`
          )
            borders.push(mesh)
        })
        expect(borders).toHaveLength(profile.id === 'W04' ? 1 : 3)
        for (const border of borders) {
          // Apply transforms to float vectors: writing world positions into a
          // quantized Uint16 attribute would wrap/clamp the certified vertices.
          expect(boundaryEdgeCount(border.geometry)).toBe(0)
          expect(
            signedVolume(border.geometry, border.matrixWorld),
          ).toBeGreaterThan(0.0003)
          expect(
            new Box3().setFromObject(border, true).getSize(new Vector3()).z,
          ).toBeGreaterThan(0.025)
          expect(border.geometry.getAttribute('uv')).toBeUndefined()
          expect(
            (border.material as MeshPhysicalMaterial).userData,
          ).toMatchObject({
            runnerOpeningFinish:
              profile.id === 'W04'
                ? 'geometry-facets-v1'
                : 'geometry-ribbons-v1',
            texturePolicy: 'scalar',
          })
        }
      } finally {
        disposeObject(scene)
      }
    },
  )

  it.each([
    SINGING_CURRENT_WALL_PROFILES.W04,
    SINGING_CURRENT_WALL_PROFILES.W08,
    SINGING_CURRENT_WALL_PROFILES.W06,
  ])(
    '$id shares wall-space UVs across the intact pane and shards in both profiles',
    async (profile) => {
      for (const quality of ['full', 'mobile'] as const) {
        expect(resolveAssetProfileBundle(profile.bundle, quality)).toBe(
          profile.bundle,
        )
        expect(
          GLASS_GAME_ASSET_FILES[
            resolveAssetProfileBundle(profile.bundle, quality)
          ],
        ).toBe(profile.file)
      }
      expect(
        GLASS_GAME_NATIVE_MOBILE_ASSET_PAIRS.some(
          (pair) => pair.desktop === profile.file,
        ),
      ).toBe(false)
      const scene = await loadWall(profile)
      scene.updateMatrixWorld(true)
      try {
        const outline = profile.presentation.pane.outlines![0]!
        const minX = Math.min(...outline.map((point) => point.x)),
          maxX = Math.max(...outline.map((point) => point.x))
        const minY = Math.min(...outline.map((point) => point.y)),
          maxY = Math.max(...outline.map((point) => point.y))
        const point = new Vector3()
        let paneMeshes = 0,
          maximumUvError = 0
        const intact = scene.getObjectByName(profile.intactNode) as Mesh
        const roughnessMap = (intact.material as MeshPhysicalMaterial)
          .roughnessMap
        scene.traverse((node) => {
          const mesh = node as Mesh
          if (
            !mesh.isMesh ||
            (mesh.name !== profile.intactNode &&
              !mesh.name.startsWith(profile.shardPrefix))
          )
            return
          paneMeshes++
          const position = mesh.geometry.getAttribute('position'),
            uv = mesh.geometry.getAttribute('uv')
          expect(uv).toBeDefined()
          for (let vertex = 0; vertex < position.count; vertex++) {
            point
              .fromBufferAttribute(position, vertex)
              .applyMatrix4(mesh.matrixWorld)
            maximumUvError = Math.max(
              maximumUvError,
              Math.abs(uv.getX(vertex) - (point.x - minX) / (maxX - minX)),
              Math.abs(
                uv.getY(vertex) - (1 - (point.y - minY) / (maxY - minY)),
              ),
            )
          }
          if (profile.id === 'W06')
            expect((mesh.material as MeshPhysicalMaterial).roughnessMap).toBe(
              roughnessMap,
            )
        })
        expect(paneMeshes).toBe(profile.shardCount + 1)
        expect(maximumUvError).toBeLessThan(0.000035)
        if (profile.id === 'W06') {
          expect(roughnessMap).not.toBeNull()
          expect(roughnessMap!.image).toMatchObject({
            width: 1024,
            height: 1024,
          })
          expect(
            (intact.material as MeshPhysicalMaterial).userData,
          ).toMatchObject({
            runnerOpeningFinish: 'botanical-edge-v1',
            roughnessMapPolicy: 'preserve-authored',
            normalMapPolicy: 'flat',
            uvSpace: 'wall-family-v1',
            roughnessColorSpace: 'linear',
          })
        }
      } finally {
        disposeObject(scene)
      }
    },
  )
})
