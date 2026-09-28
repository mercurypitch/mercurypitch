// Rose Hex runtime delivery — both tiers preserve the measured polygon, closed crystal volumes and crackle lifecycle.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { BufferGeometry, Mesh as MeshType, MeshStandardMaterial, } from 'three'
import { FrontSide, MeshPhysicalMaterial, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { describe, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW } from '../content/cloudway-laboratory'
import { ROSE_HEX_CRUMBLE_CONTACT, ROSE_HEX_CRUMBLE_SUPPORT_POLYGON, } from '../content/rose-hex-crumble-profile'
import type { PlatformRuntimeSnapshot } from '../contracts'
import type { CloudwayCrackleMaterialBinding } from './cloudway-crackle-adapter'
import { createCloudwayCrackleAdapter } from './cloudway-crackle-adapter'
import { validateCloudwayCrackleDonor } from './cloudway-crackle-contract'
import { CLOUDWAY_LAB_BUNDLE_IDS, CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS, CLOUDWAY_LAB_ROOT_NAMES, } from './cloudway-laboratory-catalog'
import { disposeObject } from './dispose'

const deliveries = [
  {
    id: CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleDesktop,
    tier: 'Desktop',
    bytes: 6_296_776,
    sha256: '6fb888df6a94cd0f7a1fbd69915b16d0d695acab9aaf6f20f63520a90bba69c1',
  },
  {
    id: CLOUDWAY_LAB_BUNDLE_IDS.roseHexCrumbleMobile,
    tier: 'Mobile',
    bytes: 2_025_056,
    sha256: '9a35a2ede553ea11f4d48e056973e6eb8c33349c528b95ad63d38fb61932bc2f',
  },
] as const

const platform = CLOUDWAY_CRYSTAL_PROMENADE_MECHANICS_PREVIEW.platforms.find(
  (candidate) => candidate.id === 'preview-rose-step',
)!

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

function assertClosedOutward(geometry: BufferGeometry): void {
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
  let signedVolume = 0
  for (let offset = 0; offset < index!.count; offset += 3) {
    const vertices = [
      index!.getX(offset),
      index!.getX(offset + 1),
      index!.getX(offset + 2),
    ]
    a.fromBufferAttribute(positions, vertices[0]!)
    b.fromBufferAttribute(positions, vertices[1]!)
    c.fromBufferAttribute(positions, vertices[2]!)
    signedVolume += a.dot(b.clone().cross(c)) / 6
    for (let edge = 0; edge < 3; edge++) {
      const key = [ids[vertices[edge]!]!, ids[vertices[(edge + 1) % 3]!]!]
        .sort()
        .join('|')
      edges.set(key, (edges.get(key) ?? 0) + 1)
    }
  }
  expect([...edges.values()].every((count) => count === 2)).toBe(true)
  expect(signedVolume).toBeGreaterThan(0)
}

function runtime(
  phase: PlatformRuntimeSnapshot['phase'],
  phaseProgress: number,
): PlatformRuntimeSnapshot {
  return {
    id: platform.id,
    phase,
    phaseProgress,
    collisionEnabled: phase === 'intact' || phase === 'warning',
    offset: { x: 0, y: 0, z: 0 },
  }
}

describe.each(deliveries)('shipped Rose Hex $tier tier', (delivery) => {
  it('loads frozen bytes, exact roles and front-sided closed volume art', async () => {
    const payload = bytes(delivery.id)
    expect(payload.byteLength).toBe(delivery.bytes)
    expect(createHash('sha256').update(payload).digest('hex')).toBe(
      delivery.sha256,
    )
    const scene = await load(delivery.id)
    const root = scene.getObjectByName(CLOUDWAY_LAB_ROOT_NAMES.roseHexCrumble)!
    const validated = validateCloudwayCrackleDonor(root, platform)

    expect(validated.width).toBeCloseTo(ROSE_HEX_CRUMBLE_CONTACT.width, 10)
    expect(validated.depth).toBeCloseTo(ROSE_HEX_CRUMBLE_CONTACT.depth, 10)
    expect(validated.height).toBeCloseTo(ROSE_HEX_CRUMBLE_CONTACT.thickness, 10)
    expect(validated.supportPolygon).toEqual(ROSE_HEX_CRUMBLE_SUPPORT_POLYGON)
    expect(validated.shards).toHaveLength(24)

    const intactVolume = root.getObjectByName(
      'rose_hex_intact_volume',
    ) as MeshType
    expect(intactVolume.isMesh).toBe(true)
    expect(intactVolume.material).toBeInstanceOf(MeshPhysicalMaterial)
    expect((intactVolume.material as MeshPhysicalMaterial).side).toBe(FrontSide)
    expect(
      (intactVolume.material as MeshPhysicalMaterial).transmission,
    ).toBeGreaterThan(0.9)
    assertClosedOutward(intactVolume.geometry)
    for (const shard of validated.shards) {
      expect((shard as MeshType).isMesh).toBe(true)
      const mesh = shard as MeshType
      expect((mesh.material as MeshStandardMaterial).side).toBe(FrontSide)
      assertClosedOutward(mesh.geometry)
    }
    disposeObject(scene)
  })

  it('matches declared materials exactly and disposes every adapter-owned clone once', async () => {
    const scene = await load(delivery.id)
    const root = scene.getObjectByName(CLOUDWAY_LAB_ROOT_NAMES.roseHexCrumble)!
    const validated = validateCloudwayCrackleDonor(root, platform)
    const declaration = JSON.parse(
      root.userData.platform_adapter_json as string,
    ) as { motion: { materials: Record<string, string> } }
    const declared = Object.values(declaration.motion.materials).sort()
    const represented = new Set<string>()
    const bindings: CloudwayCrackleMaterialBinding[] = []
    for (const role of validated.visual)
      role.traverse((object) => {
        const mesh = object as MeshType
        if (!mesh.isMesh) return
        expect(Array.isArray(mesh.material)).toBe(false)
        const material = mesh.material as MeshStandardMaterial
        represented.add(material.name)
        const kind =
          CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS.roseHexCrumble[
            material.name as keyof typeof CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS.roseHexCrumble
          ]
        expect(kind).toBeDefined()
        bindings.push({ mesh: mesh.name, material, kind: kind! })
      })
    expect([...represented].sort()).toEqual(declared)
    expect(bindings).toHaveLength(27)

    const adapter = createCloudwayCrackleAdapter({
      source: root,
      platform,
      materials: bindings,
    })
    const disposed = vi.fn()
    let ownedGeometry = 0
    adapter.root.traverse((object) => {
      const mesh = object as MeshType
      if (!mesh.isMesh) return
      ownedGeometry++
      mesh.geometry.addEventListener('dispose', disposed)
    })
    expect(ownedGeometry).toBe(27)
    adapter.update(runtime('intact', 0))
    expect(
      adapter.root.getObjectByName('rose_hex_intact')?.parent?.visible,
    ).toBe(true)
    adapter.update(runtime('warning', 0.75))
    expect(
      adapter.root.getObjectByName('rose_hex_intact')?.parent?.visible,
    ).toBe(true)
    adapter.update(runtime('released', 0.5))
    expect(
      adapter.root.getObjectByName('rose_hex_intact')?.parent?.visible,
    ).toBe(false)
    expect(
      adapter.root.getObjectByName('rose_hex_shard_000')?.parent?.visible,
    ).toBe(true)
    adapter.update(runtime('resetting', 1))
    adapter.dispose()
    adapter.dispose()
    expect(disposed).toHaveBeenCalledTimes(ownedGeometry)
    disposeObject(scene)
  })
})
