// Quarter-turn runtime delivery — both shipped tiers decode to the same support contract and install as reusable shared geometry.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Mesh } from 'three'
import { BoxGeometry, Group, Mesh as ThreeMesh, MeshPhysicalMaterial, MeshStandardMaterial, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { transformBoundsXZ } from '../authoring/transform'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { PEARL_QUARTER_TURN_BUNDLE_IDS, PEARL_QUARTER_TURN_NODES, PEARL_QUARTER_TURN_RENDER_ID, PEARL_QUARTER_TURN_TIER_TRIANGLES, } from '../content/pearl-quarter-turn-profile'
import { CLOUDWAY_QUARTER_TURN_ART_STUDY } from '../content/quarter-turn-art-study'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, } from '../contracts'
import { disposeObject } from './dispose'
import { createMaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import { createPearlQuarterTurnPlatformRenderer } from './quarter-turn-platform'
import { validatePearlQuarterTurnDonor } from './quarter-turn-platform-contract'

const deliveries = [
  {
    id: PEARL_QUARTER_TURN_BUNDLE_IDS.desktop,
    tier: 'desktop',
    bytes: 6_794_736,
    sha256: 'bd264c04a34e02ca6d510bb2ad3e876cd9f773f31463f39ce4e857b3b287c413',
  },
  {
    id: PEARL_QUARTER_TURN_BUNDLE_IDS.mobile,
    tier: 'mobile',
    bytes: 2_097_048,
    sha256: 'dde3db664c97416e32cfcfb82e07f4dd2ffb989917847c1efc6e5e2d3219d137',
  },
] as const

function deliveryBytes(id: string): Buffer {
  return readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[id]}`,
      import.meta.url,
    ),
  )
}

async function load(id: string) {
  const bytes = deliveryBytes(id)
  const payload = new Uint8Array(bytes.byteLength)
  payload.set(bytes)
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(payload.buffer, '')
  ).scene
}

function materials(): MuseumMaterials {
  return Object.fromEntries(
    ['marble', 'teal', 'limestone', 'gold', 'rock', 'glass', 'mirror'].map(
      (id) => [id, new MeshPhysicalMaterial()],
    ),
  ) as MuseumMaterials
}

function fallbacks(level: LevelDefinition): Map<string, Group> {
  return new Map(
    level.platforms.map((platform) => {
      const root = new Group()
      root.add(
        new ThreeMesh(
          new BoxGeometry(1, platform.thickness, 1),
          new MeshStandardMaterial(),
        ),
      )
      return [platform.id, root]
    }),
  )
}

function snapshot(enabledPlatformIds: readonly string[]): GameSnapshot {
  return {
    player: {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      grounded: true,
      facingYaw: 0,
    },
    breakables: [],
    enabledPlatformIds,
    completedBreakableIds: [],
    activeEncounter: null,
    phase: 'idle',
    paused: false,
    checkpointId: 'quarter-turn-start',
    nearbyBreakableId: null,
    elapsedSeconds: 0,
    complete: false,
  }
}

beforeAll(() => {
  vi.stubGlobal('self', globalThis)
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1, height: 1, close: () => undefined })),
  )
})

afterAll(() => vi.unstubAllGlobals())

describe('shipped pearl quarter-turn tiers', () => {
  it.each(deliveries)(
    'decodes the $tier geometry, semantic materials and measured support',
    async (delivery) => {
      const bytes = deliveryBytes(delivery.id)
      expect(bytes.byteLength).toBe(delivery.bytes)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        delivery.sha256,
      )
      const scene = await load(delivery.id)
      const root = scene.getObjectByName(PEARL_QUARTER_TURN_NODES.root)!
      const contract = validatePearlQuarterTurnDonor(root)
      expect(contract.tier).toBe(delivery.tier)
      expect(contract.triangles).toBe(
        PEARL_QUARTER_TURN_TIER_TRIANGLES[delivery.tier],
      )
      expect(contract.draws).toBe(3)
      contract.visual.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        const position = mesh.geometry.getAttribute('position')
        const normal = mesh.geometry.getAttribute('normal')
        expect(position).toBeDefined()
        expect(normal).toBeDefined()
        for (const attribute of [position, normal])
          expect(attribute.array.every(Number.isFinite)).toBe(true)
      })
      disposeObject(scene)
    },
  )

  it('prepares one donor clone and shares its geometry across repeated modules', async () => {
    const source = await load(PEARL_QUARTER_TURN_BUNDLE_IDS.desktop)
    const originalParts = CLOUDWAY_QUARTER_TURN_ART_STUDY.platforms.filter(
      (platform) => platform.renderId === PEARL_QUARTER_TURN_RENDER_ID,
    )
    const repeatedParts = originalParts.map((platform) => {
      const bounds = transformBoundsXZ(platform, {
        translate: { x: 6.25, y: 0.4, z: -3.5 },
        yawQuarterTurns: 1,
      })
      return {
        ...platform,
        ...bounds,
        id: `repeat/${platform.id}`,
        ...(platform.parentPlatformId === undefined
          ? { parentPlatformId: undefined }
          : { parentPlatformId: `repeat/${platform.parentPlatformId}` }),
        top: platform.top + 0.4,
        renderQuarterTurns: 1,
      } satisfies PlatformDefinition
    })
    const level: LevelDefinition = {
      ...CLOUDWAY_QUARTER_TURN_ART_STUDY,
      platforms: [
        ...CLOUDWAY_QUARTER_TURN_ART_STUDY.platforms,
        ...repeatedParts,
      ],
    }
    const sceneRoot = new Group()
    const fallbackById = fallbacks(level)
    const library = createMaterialLibrary()
    const renderer = createPearlQuarterTurnPlatformRenderer(
      level,
      sceneRoot,
      fallbackById,
      materials(),
      library,
    )
    const covered = renderer.install(
      source,
      PEARL_QUARTER_TURN_BUNDLE_IDS.logical,
    )
    expect(covered).toEqual(
      new Set([
        ...originalParts.map((platform) => platform.id),
        ...repeatedParts.map((platform) => platform.id),
      ]),
    )
    for (const id of covered)
      expect(fallbackById.get(id)!.children).toHaveLength(0)
    const owner = sceneRoot.getObjectByName('pearl-quarter-turn-platform-art')!
    const arts = owner.children[0]!.children
    expect(arts).toHaveLength(2)
    const firstMeshes = arts.map((art) => {
      let found: Mesh | undefined
      art.traverse((object) => {
        const mesh = object as Mesh
        if (mesh.isMesh && found === undefined) found = mesh
      })
      return found!
    })
    expect(firstMeshes[0]!.geometry).toBe(firstMeshes[1]!.geometry)
    expect(firstMeshes[0]!.material).toBe(firstMeshes[1]!.material)

    renderer.update(snapshot([...covered]))
    expect(arts.map((art) => art.visible)).toEqual([true, true])
    renderer.update(
      snapshot([...covered].filter((id) => id !== repeatedParts[1]!.id)),
    )
    expect(arts.map((art) => art.visible)).toEqual([true, false])
    renderer.dispose()
    library.dispose()
    disposeObject(source)
  })
})
