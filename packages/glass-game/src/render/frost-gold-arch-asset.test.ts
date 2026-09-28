// Frost Gold Arch runtime delivery — both tiers preserve the curved pane, grounded frame and closed fracture set.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { BufferGeometry } from 'three'
import { Box3, Raycaster, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { FROST_GOLD_ARCH_BUNDLE_IDS, FROST_GOLD_ARCH_FRAME, FROST_GOLD_ARCH_NODES, FROST_GOLD_ARCH_PANE, FROST_GOLD_ARCH_PROFILE, } from '../content/frost-gold-arch-profile'
import { getBreakableRenderRecipe } from './catalog'
import { disposeObject } from './dispose'
import { prepareExhibitAsset } from './exhibit-asset'
import { createMaterialLibrary } from './material-library'

const deliveries = [
  {
    id: FROST_GOLD_ARCH_BUNDLE_IDS.desktop,
    tier: 'desktop',
    bytes: 9_391_800,
    sha256: 'f40a74c9c200f7b86e19cf8c2139e6084e11ff9775919dc96265b7b4e1f71ec3',
  },
  {
    id: FROST_GOLD_ARCH_BUNDLE_IDS.mobile,
    tier: 'mobile',
    bytes: 3_035_104,
    sha256: '6a2562578f04363ed5225b1792b69561e626a4ca9666bf27724d16223372cdfa',
  },
] as const

function bytes(id: string): Buffer {
  return readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[id]}`,
      import.meta.url,
    ),
  )
}

async function load(id: string) {
  const payload = bytes(id)
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'EXT_texture_webp',
      loadTexture: async () => new Texture(),
    }))
  return (await loader.parseAsync(Uint8Array.from(payload).buffer, '')).scene
}

function assertClosedPositive(geometry: BufferGeometry): void {
  const positions = geometry.getAttribute('position')
  const index = geometry.index
  expect(index).not.toBeNull()
  const ids = Array.from({ length: positions.count }, (_, vertex) =>
    [positions.getX(vertex), positions.getY(vertex), positions.getZ(vertex)]
      .map((value) => value.toFixed(5))
      .join(','),
  )
  const edges = new Map<string, number>()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  let volume = 0
  for (let offset = 0; offset < index!.count; offset += 3) {
    const vertices = [
      index!.getX(offset),
      index!.getX(offset + 1),
      index!.getX(offset + 2),
    ]
    a.fromBufferAttribute(positions, vertices[0]!)
    b.fromBufferAttribute(positions, vertices[1]!)
    c.fromBufferAttribute(positions, vertices[2]!)
    volume += a.dot(b.clone().cross(c)) / 6
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

describe.each(deliveries)('shipped Frost Gold Arch $tier tier', (delivery) => {
  it('loads frozen bytes and keeps every conservative gate band inside the visible pane', async () => {
    const payload = bytes(delivery.id)
    expect(payload.byteLength).toBe(delivery.bytes)
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      delivery.sha256,
    )
    const scene = await load(delivery.id)
    const root = scene.getObjectByName(FROST_GOLD_ARCH_NODES.root)!
    const intact = root.getObjectByName(FROST_GOLD_ARCH_NODES.intact)!
    const bounds = new Box3().setFromObject(intact)
    const size = bounds.getSize(new Vector3())
    expect(size.x).toBeCloseTo(FROST_GOLD_ARCH_PANE.width, 3)
    expect(size.y).toBeCloseTo(FROST_GOLD_ARCH_PANE.height, 3)
    expect(size.z).toBeCloseTo(FROST_GOLD_ARCH_PANE.depth, 3)
    expect(bounds.min.y).toBeCloseTo(0, 5)

    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0, 2)
    for (const band of FROST_GOLD_ARCH_PROFILE.gateParts!) {
      const y = band.bottomCenter.y + band.height / 2
      for (const x of [-band.width / 2 + 0.001, 0, band.width / 2 - 0.001]) {
        ray.ray.origin.set(x, y, 1)
        expect(
          ray.intersectObject(intact, true).length,
          `${band.id} x=${x}, y=${y}`,
        ).toBeGreaterThan(0)
      }
    }
    disposeObject(scene)
  })

  it('keeps grounded physical posts, open walking space and a persistent ornate crown', async () => {
    const scene = await load(delivery.id)
    const root = scene.getObjectByName(FROST_GOLD_ARCH_NODES.root)!
    const frame = root.getObjectByName(FROST_GOLD_ARCH_NODES.frame)!
    const frameBounds = new Box3().setFromObject(frame)
    expect(frameBounds.min.y).toBeGreaterThanOrEqual(-0.012)
    expect(frameBounds.min.y).toBeLessThan(0)
    expect(frameBounds.max.y).toBeCloseTo(3.02266, 4)
    expect(frameBounds.max.z - frameBounds.min.z).toBeCloseTo(
      FROST_GOLD_ARCH_FRAME.depth,
      3,
    )

    const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1), 0, 2)
    for (const post of FROST_GOLD_ARCH_FRAME.posts)
      for (const y of [0.05, 0.8, 1.6]) {
        ray.ray.origin.set(post.centerX, y, 1)
        expect(
          ray.intersectObject(frame, true).length,
          `${post.id} y=${y}`,
        ).toBeGreaterThan(0)
      }
    for (const y of [0.05, 0.8, 1.6]) {
      ray.ray.origin.set(0, y, 1)
      expect(ray.intersectObject(frame, true), `opening y=${y}`).toHaveLength(0)
    }
    ray.ray.origin.set(0, 2.9, 1)
    expect(ray.intersectObject(frame, true).length).toBeGreaterThan(0)
    disposeObject(scene)
  })

  it('prepares 32 closed matching pieces while leaving the frame independent', async () => {
    const scene = await load(delivery.id)
    const root = scene.getObjectByName(FROST_GOLD_ARCH_NODES.root)!
    const frame = root.getObjectByName(FROST_GOLD_ARCH_NODES.frame)!
    const recipe = getBreakableRenderRecipe('frost-gold-arch-breakwall-a')
    expect(recipe.bundle).toBe(FROST_GOLD_ARCH_BUNDLE_IDS.logical)
    expect(recipe.persistentPrefix).toBe(FROST_GOLD_ARCH_NODES.frame)
    const library = createMaterialLibrary()
    const prepared = prepareExhibitAsset(root, recipe, delivery.id, library)
    expect(prepared.pieces).toHaveLength(32)
    expect(frame.parent).not.toBeNull()
    prepared.geometry.computeBoundingBox()
    const intact = prepared.geometry.boundingBox!
    const assembled = new Box3()
    for (const piece of prepared.pieces) {
      assertClosedPositive(piece.geometry)
      piece.geometry.computeBoundingBox()
      const part = piece.geometry.boundingBox!.clone().translate(piece.centre)
      expect(intact.clone().expandByScalar(0.002).containsBox(part)).toBe(true)
      assembled.union(part)
    }
    expect(assembled.min.distanceTo(intact.min)).toBeLessThan(0.02)
    expect(assembled.max.distanceTo(intact.max)).toBeLessThan(0.02)
    prepared.geometry.dispose()
    prepared.pieces.forEach((piece) => piece.geometry.dispose())
    library.dispose()
    disposeObject(scene)
  })
})
