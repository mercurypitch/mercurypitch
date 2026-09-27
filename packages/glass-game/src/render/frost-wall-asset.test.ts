// Shipped frost wall — certified pane, closed fragments and permanent frame survive the actual GLB loader.

import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh } from 'three'
import { Box3, Raycaster, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { FROST_WALL_PANE } from '../content/frost-wall-profile'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'

async function loadWall() {
  const bytes = readFileSync(
    new URL(
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/frosted-scroll-wall/frosted-scroll-wall-runtime-v1.glb',
      import.meta.url,
    ),
  )
  // This gate checks real geometry and material assignments. Pixel appearance
  // is verified separately by the hardware browser proof; Node has no decoder.
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      // Replace the registered WebP plugin before it requests browser image APIs.
      name: 'EXT_texture_webp',
      loadTexture: async () => new Texture(),
    }))
  return (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene
}

function assertClosedPositiveFragment(geometry: BufferGeometry) {
  const positions = geometry.getAttribute('position')
  const index = geometry.index!
  const ids = Array.from({ length: positions.count }, (_, i) =>
    [positions.getX(i), positions.getY(i), positions.getZ(i)]
      .map((value) => value.toFixed(5))
      .join(','),
  )
  const edges = new Map<string, number>()
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3()
  let volume = 0
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    a.fromBufferAttribute(positions, vertices[0]!)
    b.fromBufferAttribute(positions, vertices[1]!)
    c.fromBufferAttribute(positions, vertices[2]!)
    volume += a.dot(b.cross(c)) / 6
    for (let edge = 0; edge < 3; edge++) {
      const key = [ids[vertices[edge]!]!, ids[vertices[(edge + 1) % 3]!]!]
        .sort()
        .join('|')
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true)
  expect(volume).toBeGreaterThan(0)
}

describe('shipped frost wall', () => {
  it('keeps all 32 closed shards within the certified pane and frame feet on the court', async () => {
    const scene = await loadWall()
    const recipe = getBreakableRenderRecipe('frosted-scroll-wall')
    const library = createMaterialLibrary()
    const frame = scene.getObjectByName('frost_wall_frame')!
    const frameBounds = new Box3().setFromObject(frame)
    const feetBounds = new Box3().setFromObject(
      scene.getObjectByName('frost_wall_frame_visual')!,
    )
    expect(feetBounds.min.y).toBeCloseTo(0, 4)
    // The 18mm round gold floor trim straddles the zero-height contact datum.
    expect(frameBounds.min.y).toBeGreaterThanOrEqual(-0.02)
    expect(frameBounds.min.y).toBeLessThanOrEqual(0.00005)
    expect(frameBounds.max.y).toBeCloseTo(3, 4)
    expect(frameBounds.min.x).toBeCloseTo(-1.355656505, 4)
    expect(frameBounds.max.x).toBeCloseTo(1.355656505, 4)
    expect(feetBounds.min.z).toBeCloseTo(-0.245718434, 4)
    expect(feetBounds.max.z).toBeCloseTo(0.245718434, 4)
    // Decorative round trim projects 9mm beyond the structural contact box.
    expect(frameBounds.min.z).toBeCloseTo(-0.254718434, 4)
    expect(frameBounds.max.z).toBeCloseTo(0.254718434, 4)
    // These actual-geometry rays catch a raised sill or missing post that an
    // aggregate bounding box would miss. Gameplay still uses cheap box solids.
    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0, 2)
    for (const x of [-0.5, 0, 0.5]) {
      for (const y of [0.03, 0.15, 0.7, 1.5, 2.2]) {
        ray.ray.origin.set(x, y, 1)
        expect(
          ray.intersectObject(frame, true),
          `opening x=${x}, y=${y}`,
        ).toHaveLength(0)
      }
    }
    // The column narrows above its flared base; sample its actual inner shaft.
    for (const x of [-0.95, 0.95]) {
      for (const y of [0.15, 1, 2.2]) {
        ray.ray.origin.set(x, y, 1)
        expect(
          ray.intersectObject(frame, true).length,
          `post x=${x}, y=${y}`,
        ).toBeGreaterThan(0)
      }
    }
    ray.ray.origin.set(0, 2.85, 1)
    expect(
      ray.intersectObject(frame, true).length,
      'top frame',
    ).toBeGreaterThan(0)
    let quantizedIntactMeshes = 0
    scene.getObjectByName('frost_wall_intact')!.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      const position = (object as Mesh).geometry.getAttribute('position')
      if (position.normalized && position.array instanceof Int16Array)
        quantizedIntactMeshes++
    })
    expect(quantizedIntactMeshes).toBeGreaterThan(0)
    let quantizedShardMeshes = 0
    scene.getObjectByName('frost_wall_shard_000')!.traverse((object) => {
      if (!(object as Mesh).isMesh) return
      const position = (object as Mesh).geometry.getAttribute('position')
      if (position.normalized && position.array instanceof Int16Array)
        quantizedShardMeshes++
    })
    expect(quantizedShardMeshes).toBeGreaterThan(0)
    const prepared = prepareExhibitAsset(scene, recipe, recipe.bundle!, library)
    expect(prepared.pieces).toHaveLength(32)
    expect(prepared.geometry.getAttribute('position').array).toBeInstanceOf(
      Float32Array,
    )
    expect(prepared.geometry.getAttribute('position').normalized).toBe(false)
    expect(
      prepared.pieces.every(
        (piece) =>
          piece.geometry.getAttribute('position').array instanceof
            Float32Array && !piece.geometry.getAttribute('position').normalized,
      ),
    ).toBe(true)
    prepared.geometry.computeBoundingBox()
    const bounds = prepared.geometry.boundingBox!
    const size = bounds.getSize(new Vector3())
    expect(size.x).toBeCloseTo(FROST_WALL_PANE.width, 3)
    expect(size.y).toBeCloseTo(FROST_WALL_PANE.height, 3)
    expect(size.z).toBeCloseTo(FROST_WALL_PANE.depth, 3)
    expect(bounds.min.y).toBeCloseTo(0, 5)
    const assembled = new Box3()
    for (const piece of prepared.pieces) {
      assertClosedPositiveFragment(piece.geometry)
      piece.geometry.computeBoundingBox()
      const part = piece.geometry.boundingBox!.clone().translate(piece.centre)
      assembled.union(part)
      expect(bounds.clone().expandByScalar(0.002).containsBox(part)).toBe(true)
    }
    expect(assembled.min.distanceTo(bounds.min)).toBeLessThan(0.015)
    expect(assembled.max.distanceTo(bounds.max)).toBeLessThan(0.015)
    expect(frame.parent).not.toBeNull()
    expect(frameBounds.getSize(new Vector3()).x).toBeGreaterThan(size.x)
    prepared.geometry.dispose()
    prepared.pieces.forEach((piece) => piece.geometry.dispose())
    library.dispose()
    disposeObject(scene)
  })

  it('rejects stale contact dimensions before cloning materials', async () => {
    const scene = await loadWall()
    const intact = scene.getObjectByName('frost_wall_intact')!
    intact.scale.x = 1.1
    const recipe = getBreakableRenderRecipe('frosted-scroll-wall')
    const library = createMaterialLibrary()
    expect(() =>
      prepareExhibitAsset(scene, recipe, recipe.bundle!, library),
    ).toThrow('Pane bounds do not match certified contact')
    expect(library.materials.size).toBe(0)
    // Every actual fragment has mesh payload; a name-only placeholder is insufficient.
    const shard = scene.getObjectByName('frost_wall_shard_000')!
    let meshes = 0
    shard.traverse((object) => {
      if ((object as Mesh).isMesh) meshes++
    })
    expect(meshes).toBeGreaterThan(0)
    library.dispose()
    disposeObject(scene)
  })
})
