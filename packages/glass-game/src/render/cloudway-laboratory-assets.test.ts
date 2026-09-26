// Accepted Cloudway asset proofs — the shipped GLBs drive the production crackle contract and every visible phase.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Mesh as MeshType, Object3D } from 'three'
import { BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, } from 'three'
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY } from '../content/cloudway-laboratory'
import type { PlatformRuntimeSnapshot } from '../contracts'
import type { CloudwayCrackleMaterialBinding } from './cloudway-crackle-adapter'
import { createCloudwayCrackleAdapter } from './cloudway-crackle-adapter'
import { validateCloudwayCrackleDonor } from './cloudway-crackle-contract'
import { CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS, CLOUDWAY_LAB_PLATFORM_RENDER_IDS, CLOUDWAY_LAB_ROOT_NAMES, } from './cloudway-laboratory-catalog'
import { disposeObject } from './dispose'

interface GltfMaterial {
  readonly name?: string
  readonly alphaMode?: string
  readonly pbrMetallicRoughness?: {
    readonly baseColorFactor?: readonly number[]
    readonly metallicFactor?: number
    readonly roughnessFactor?: number
  }
  readonly extensions?: {
    readonly KHR_materials_transmission?: {
      readonly transmissionFactor?: number
    }
  }
}

interface GltfNode {
  readonly name?: string
  readonly mesh?: number
  readonly children?: readonly number[]
  readonly matrix?: readonly number[]
  readonly translation?: readonly number[]
  readonly rotation?: readonly number[]
  readonly scale?: readonly number[]
  readonly extras?: Readonly<Record<string, unknown>>
}

interface GltfJson {
  readonly nodes: readonly GltfNode[]
  readonly meshes: readonly {
    readonly primitives: readonly { readonly material?: number }[]
  }[]
  readonly materials?: readonly GltfMaterial[]
}

type CrackleKey = keyof typeof CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS

const CASES = [
  {
    key: 'roseCrackle',
    platformId: 'rose-step',
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/rose-quartz-crackle-fast/rose-quartz-crackle-fast-runtime-v1.glb',
    sha256: 'faabbbb1c4a4f7019502c79e51299a1fb7317de7315fe3410f8b167caaed5285',
  },
  {
    key: 'amethystCrackle',
    platformId: 'amethyst-step',
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/amethyst-crackle-slow/amethyst-crackle-slow-runtime-v1.glb',
    sha256: '2a9615df89bbac42be86c14f0ca251c34d8937aa3b6ed7990baf50fb07991b4c',
  },
] as const satisfies readonly {
  readonly key: CrackleKey
  readonly platformId: string
  readonly relativePath: string
  readonly sha256: string
}[]

const CONTACT_CASES = [
  {
    rootName: CLOUDWAY_LAB_ROOT_NAMES.pearlRest,
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/pearl-marble-long/pearl-marble-long-runtime-v1.glb',
    sha256: 'dda126cc3c9ea41a326fd06299f1bdf89e1a7e2789b1c2eceb83380c0f9ca861',
    supportKey: 'cloudway_lab_asset_json',
  },
  {
    rootName: CLOUDWAY_LAB_ROOT_NAMES.scroll,
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/gilt-scroll-bridge/gilt-scroll-bridge-runtime-v1.glb',
    sha256: 'eb141261cc6dc65a2fd889c0984c0cdb2be8bcbb869e44b45d654845c252edba',
    supportKey: 'platform_adapter_json',
  },
  {
    rootName: CLOUDWAY_LAB_ROOT_NAMES.roseCrackle,
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle,
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/rose-quartz-crackle-fast/rose-quartz-crackle-fast-runtime-v1.glb',
    sha256: 'faabbbb1c4a4f7019502c79e51299a1fb7317de7315fe3410f8b167caaed5285',
    supportKey: 'platform_adapter_json',
  },
  {
    rootName: CLOUDWAY_LAB_ROOT_NAMES.amethystCrackle,
    renderId: CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle,
    relativePath:
      '../../../../apps/beside-cue/public/games/cloudway-laboratory-v1/amethyst-crackle-slow/amethyst-crackle-slow-runtime-v1.glb',
    sha256: '2a9615df89bbac42be86c14f0ca251c34d8937aa3b6ed7990baf50fb07991b4c',
    supportKey: 'platform_adapter_json',
  },
] as const

function acceptedJson(relativePath: string, expectedHash: string): GltfJson {
  const bytes = readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
  )
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(expectedHash)
  expect(bytes.toString('ascii', 0, 4)).toBe('glTF')
  const jsonLength = bytes.readUInt32LE(12)
  expect(bytes.toString('ascii', 16, 20)).toBe('JSON')
  return JSON.parse(
    bytes
      .subarray(20, 20 + jsonLength)
      .toString('utf8')
      .trim(),
  ) as GltfJson
}

function encoded(
  node: GltfNode,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = node.extras?.[key]
  expect(value).toEqual(expect.any(String))
  return JSON.parse(value as string) as Readonly<Record<string, unknown>>
}

function childRecord(
  owner: Readonly<Record<string, unknown>>,
  key: string,
): Readonly<Record<string, unknown>> {
  const value = owner[key]
  expect(value).not.toBeNull()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  return value as Readonly<Record<string, unknown>>
}

function material(definition: GltfMaterial | undefined): MeshStandardMaterial {
  const pbr = definition?.pbrMetallicRoughness
  const transmission =
    definition?.extensions?.KHR_materials_transmission?.transmissionFactor
  const result =
    transmission === undefined
      ? new MeshStandardMaterial()
      : new MeshPhysicalMaterial({ transmission })
  result.name = definition?.name ?? 'contact-only'
  result.metalness = pbr?.metallicFactor ?? 1
  result.roughness = pbr?.roughnessFactor ?? 1
  result.opacity = pbr?.baseColorFactor?.[3] ?? 1
  result.transparent = definition?.alphaMode === 'BLEND'
  return result
}

function contractScene(json: GltfJson, rootName: string): Object3D {
  const objects = json.nodes.map((node) => {
    let object: Object3D
    if (node.mesh === undefined) object = new Group()
    else {
      const primitives = json.meshes[node.mesh]?.primitives
      expect(primitives).toHaveLength(1)
      object = new Mesh(
        new BoxGeometry(0.1, 0.1, 0.1),
        material(
          primitives?.[0]?.material === undefined
            ? undefined
            : json.materials?.[primitives[0].material],
        ),
      )
    }
    object.name = node.name ?? ''
    object.userData = { ...node.extras }
    if (node.matrix !== undefined) {
      object.matrix.fromArray(node.matrix)
      object.matrixAutoUpdate = false
    } else {
      if (node.translation !== undefined)
        object.position.fromArray(node.translation)
      if (node.rotation !== undefined)
        object.quaternion.fromArray(node.rotation)
      if (node.scale !== undefined) object.scale.fromArray(node.scale)
    }
    return object
  })
  json.nodes.forEach((node, index) => {
    for (const child of node.children ?? [])
      objects[index]!.add(objects[child]!)
  })
  const roots = objects.filter((object) => object.name === rootName)
  expect(roots).toHaveLength(1)
  return roots[0]!
}

function meshNames(roles: readonly Object3D[]): Set<string> {
  const names = new Set<string>()
  roles.forEach((role) =>
    role.traverse((node) => {
      if ((node as MeshType).isMesh) names.add(node.name)
    }),
  )
  return names
}

function visibleMeshNames(root: Object3D): Set<string> {
  const names = new Set<string>()
  root.traverseVisible((node) => {
    if ((node as MeshType).isMesh) names.add(node.name)
  })
  return names
}

function sorted(values: ReadonlySet<string>): string[] {
  return [...values].sort()
}

function runtime(
  id: string,
  phase: PlatformRuntimeSnapshot['phase'],
  phaseProgress: number,
): PlatformRuntimeSnapshot {
  return {
    id,
    phase,
    phaseProgress,
    collisionEnabled: phase === 'intact' || phase === 'warning',
    offset: { x: 0, y: 0, z: 0 },
  }
}

describe('accepted Cloudway contact footprints', () => {
  it.each(CONTACT_CASES)(
    'keeps $rootName metadata, collision and level support aligned without root scaling',
    (asset) => {
      const json = acceptedJson(asset.relativePath, asset.sha256)
      const roots = json.nodes.filter((node) => node.name === asset.rootName)
      expect(roots).toHaveLength(1)
      const root = roots[0]!
      expect(root).not.toHaveProperty('matrix')
      expect(root).not.toHaveProperty('translation')
      expect(root).not.toHaveProperty('rotation')
      expect(root).not.toHaveProperty('scale')

      const collider = encoded(root, 'collider_json')
      const declaration = encoded(root, asset.supportKey)
      const support = childRecord(
        declaration,
        asset.supportKey === 'cloudway_lab_asset_json' ? 'contact' : 'support',
      )
      const width = support.width as number
      const depth = support.depth as number
      const height = collider.height as number
      expect([width, depth, height].every(Number.isFinite)).toBe(true)
      expect(collider).toMatchObject({
        shape: 'box',
        width,
        depth,
        height,
        topY: 0,
        center: [0, -height / 2, 0],
      })
      expect(support.topY).toBe(0)

      const platforms = CLOUDWAY_CRYSTAL_PROMENADE_STUDY.platforms.filter(
        (platform) => platform.renderId === asset.renderId,
      )
      expect(platforms.length).toBeGreaterThan(0)
      for (const platform of platforms) {
        const turns = platform.renderQuarterTurns ?? 0
        const worldWidth = turns % 2 === 0 ? width : depth
        const worldDepth = turns % 2 === 0 ? depth : width
        expect(platform.maxX - platform.minX).toBeCloseTo(worldWidth, 8)
        expect(platform.maxZ - platform.minZ).toBeCloseTo(worldDepth, 8)
        expect(platform.thickness).toBeCloseTo(height, 8)
      }

      if (asset.supportKey !== 'platform_adapter_json') return
      const motion = childRecord(declaration, 'motion')
      if (motion.kind === 'scroll') {
        const anchors = childRecord(motion, 'rollerEdgeAnchors')
        expect(anchors.negative).toEqual([-width / 2, 0, 0])
        expect(anchors.positive).toEqual([width / 2, 0, 0])
        return
      }
      const roles = childRecord(motion, 'roles')
      const contactName = roles.contact
      expect(contactName).toEqual(expect.any(String))
      const contacts = json.nodes.filter((node) => node.name === contactName)
      expect(contacts).toHaveLength(1)
      expect(contacts[0]?.extras).toMatchObject({ width, depth })
    },
  )
})

describe.each(CASES)('accepted $key runtime artifact', (asset) => {
  it('uses its frozen metadata and reviewed materials through every adapter phase', () => {
    const json = acceptedJson(asset.relativePath, asset.sha256)
    const source = contractScene(json, CLOUDWAY_LAB_ROOT_NAMES[asset.key])
    const platform = CLOUDWAY_CRYSTAL_PROMENADE_STUDY.platforms.find(
      (candidate) => candidate.id === asset.platformId,
    )!
    const validated = validateCloudwayCrackleDonor(source, platform)
    const kinds = CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS[asset.key] as Readonly<
      Record<string, 'glass' | 'opaque'>
    >
    const represented = new Set<string>()
    const bindings: CloudwayCrackleMaterialBinding[] = []
    for (const role of validated.visual)
      role.traverse((node) => {
        const mesh = node as MeshType
        if (!mesh.isMesh) return
        expect(Array.isArray(mesh.material)).toBe(false)
        const sourceMaterial = mesh.material as MeshStandardMaterial
        const kind = kinds[sourceMaterial.name]
        expect(kind).toBeDefined()
        represented.add(sourceMaterial.name)
        bindings.push({
          mesh: mesh.name,
          kind: kind!,
          material: sourceMaterial,
        })
      })
    expect(sorted(represented)).toEqual(Object.keys(kinds).sort())
    expect(bindings).toHaveLength(41)

    const persistent = meshNames(validated.persistent)
    const intact = meshNames([validated.intact])
    const shards = meshNames(validated.shards)
    const adapter = createCloudwayCrackleAdapter({
      source,
      platform,
      materials: bindings,
    })
    try {
      adapter.update(runtime(platform.id, 'intact', 0))
      expect(sorted(visibleMeshNames(adapter.root))).toEqual(
        sorted(new Set([...persistent, ...intact])),
      )

      const opaqueIntact = bindings.find(
        (binding) => intact.has(binding.mesh) && binding.kind === 'opaque',
      )!
      const sourceEmission = opaqueIntact.material.emissive.clone()
      const warningMesh = adapter.root.getObjectByName(
        opaqueIntact.mesh,
      ) as MeshType
      const warningMaterial = warningMesh.material as MeshStandardMaterial
      adapter.update(runtime(platform.id, 'warning', 0.6))
      expect(sorted(visibleMeshNames(adapter.root))).toEqual(
        sorted(new Set([...persistent, ...intact])),
      )
      expect(warningMaterial).not.toBe(opaqueIntact.material)
      expect(warningMaterial.emissive.equals(sourceEmission)).toBe(false)
      expect(opaqueIntact.material.emissive.equals(sourceEmission)).toBe(true)

      adapter.update(runtime(platform.id, 'released', 0.18))
      expect(sorted(visibleMeshNames(adapter.root))).toEqual(
        sorted(new Set([...persistent, ...shards])),
      )
      adapter.update(runtime(platform.id, 'resetting', 0.75))
      expect(sorted(visibleMeshNames(adapter.root))).toEqual(
        sorted(new Set([...persistent, ...shards])),
      )
    } finally {
      adapter.dispose()
      disposeObject(source)
    }
  })
})
