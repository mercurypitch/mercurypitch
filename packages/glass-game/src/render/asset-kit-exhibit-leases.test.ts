// Rosebud loader ownership — one real GLB supplies isolated vessel presentations with final-owner geometry disposal.

import { readFileSync } from 'node:fs'
import type { Mesh, Object3D } from 'three'
import { Box3, BufferGeometry, Group, MeshPhysicalMaterial, Texture, TextureLoader, } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { afterEach, expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { GLASSWORKS } from '../content/glassworks'
import { LIVING_GLASS_TRIAL } from '../content/living-glass-trial'
import { RESONANCE_ROSEBUD_BUNDLE_ID, RESONANCE_ROSEBUD_DISPLAY_HEIGHT, RESONANCE_ROSEBUD_MATERIALS, RESONANCE_ROSEBUD_NODES, RESONANCE_ROSEBUD_SHARD_COUNT, } from '../content/resonance-rosebud-profile'
import type { LevelDefinition } from '../contracts'
import { loadMuseumAssets } from './asset-kit'
import { MUSEUM_MATERIAL_CATALOG } from './catalog'
import { disposeMaterials } from './dispose'
import type { MuseumMaterials } from './materials'
import type { createMuseum } from './museum'
import { createVessel } from './vessels'

const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

async function bundle(): Promise<GLTF> {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[RESONANCE_ROSEBUD_BUNDLE_ID]}`,
      import.meta.url,
    ),
  )
  const payload = new Uint8Array(bytes.byteLength)
  payload.set(bytes)
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(payload.buffer, '')
}

async function setup(failSecond = false) {
  const source = await bundle()
  const bounds = new Box3().setFromObject(
    source.scene.getObjectByName(RESONANCE_ROSEBUD_NODES.intact)!,
  )
  let expectedThickness = 0
  source.scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    const rose = materials.find(
      (material) => material.name === RESONANCE_ROSEBUD_MATERIALS.glass,
    ) as MeshPhysicalMaterial | undefined
    if (rose)
      expectedThickness =
        (rose.thickness * RESONANCE_ROSEBUD_DISPLAY_HEIGHT) /
        (bounds.max.y - bounds.min.y)
  })
  const loaded = vi
    .spyOn(GLTFLoader.prototype, 'loadAsync')
    .mockImplementation(async (url) =>
      String(url) === RESONANCE_ROSEBUD_BUNDLE_ID
        ? source
        : ({ scene: new Group() } as GLTF),
    )
  vi.spyOn(TextureLoader.prototype, 'loadAsync').mockImplementation(
    async () => new Texture(),
  )
  const level: LevelDefinition = {
    ...GLASSWORKS,
    platforms: [],
    breakables: ['first', 'second', 'third'].map((id) => ({
      ...LIVING_GLASS_TRIAL.breakables[0]!,
      id,
    })),
    solids: [],
    presentation: {
      worldBounds: { minX: -3, maxX: 3, minY: -1, maxY: 4, minZ: -3, maxZ: 3 },
      lightBounds: { minX: -3, maxX: 3, minY: -1, maxY: 4, minZ: -3, maxZ: 3 },
      rooms: [],
      audioRegions: [],
      visuals: [],
      assetRecipeIds: [],
    },
  }
  const vessels = new Map(
    level.breakables.map((target) => {
      let rewards = 0
      const vessel = createVessel(target, false, {
        resonanceRewardFactory() {
          rewards++
          if (failSecond && target.id === 'second' && rewards === 2)
            throw new Error('second reward failed')
          return { object: new Group(), dispose() {} }
        },
      })
      cleanup.push(() => vessel.dispose())
      return [target.id, vessel]
    }),
  )
  const materials = Object.fromEntries(
    Object.keys(MUSEUM_MATERIAL_CATALOG).map((id) => [
      id,
      new MeshPhysicalMaterial(),
    ]),
  ) as MuseumMaterials
  cleanup.push(() => disposeMaterials(Object.values(materials)))
  const disposed: BufferGeometry[] = []
  const originalDispose = BufferGeometry.prototype.dispose
  vi.spyOn(BufferGeometry.prototype, 'dispose').mockImplementation(function (
    this: BufferGeometry,
  ) {
    disposed.push(this)
    originalDispose.call(this)
  })
  const museum = {
    setKit: vi.fn(),
    setDecorationTexture: vi.fn(),
  } as unknown as ReturnType<typeof createMuseum>
  const pending = loadMuseumAssets(
    level,
    (id) => id,
    vessels,
    museum,
    materials,
    (texture) => cleanup.push(() => texture.dispose()),
    () => false,
  )
  return { pending, loaded, vessels, disposed, expectedThickness }
}

function geometries(root: Object3D, id: string): BufferGeometry[] {
  const intact = root.getObjectByName(`vessel-intact-${id}`) as Mesh
  const shards = root.getObjectByName(`vessel-shards-${id}`) as Group
  return [
    intact.geometry,
    ...shards.children.map((child) => (child as Mesh).geometry),
  ]
}

it('downloads and prepares the real Rosebud once for three isolated vessel owners', async () => {
  const { pending, loaded, vessels, disposed, expectedThickness } =
    await setup()
  await pending
  const first = vessels.get('first')!
  const second = vessels.get('second')!
  const third = vessels.get('third')!
  const shared = geometries(first.root, 'first')

  expect(
    loaded.mock.calls.filter(([url]) => url === RESONANCE_ROSEBUD_BUNDLE_ID),
  ).toHaveLength(1)
  expect(shared).toHaveLength(RESONANCE_ROSEBUD_SHARD_COUNT + 1)
  expect(
    geometries(second.root, 'second').every(
      (geometry, index) => geometry === shared[index],
    ),
  ).toBe(true)
  expect(
    geometries(third.root, 'third').every(
      (geometry, index) => geometry === shared[index],
    ),
  ).toBe(true)
  expect(shared.every((geometry) => !disposed.includes(geometry))).toBe(true)
  const roseMaterials = [...vessels.values()].map(
    (vessel) =>
      [...vessel.materialLibrary.materials].find(
        (material) => material.name === RESONANCE_ROSEBUD_MATERIALS.glass,
      ) as MeshPhysicalMaterial,
  )
  expect(new Set(roseMaterials).size).toBe(3)
  for (const material of roseMaterials)
    expect(material.thickness).toBeCloseTo(expectedThickness, 12)
  first.dispose()
  second.dispose()
  expect(shared.every((geometry) => !disposed.includes(geometry))).toBe(true)
  third.dispose()
  third.dispose()
  expect(
    shared.every(
      (geometry) => disposed.filter((item) => item === geometry).length === 1,
    ),
  ).toBe(true)
})

it('closes the construction owner on partial installation failure while preserving the installed sibling', async () => {
  const { pending, vessels, disposed } = await setup(true)
  const second = vessels.get('second')!
  const previous = second.root.getObjectByName('vessel-intact-second')
  await expect(pending).rejects.toMatchObject({
    name: 'RequiredMuseumAssetError',
    cause: expect.objectContaining({ message: 'second reward failed' }),
  })
  const first = vessels.get('first')!
  const shared = geometries(first.root, 'first')

  expect(second.root.getObjectByName('vessel-intact-second')).toBe(previous)
  expect(shared).toHaveLength(RESONANCE_ROSEBUD_SHARD_COUNT + 1)
  expect(shared.every((geometry) => !disposed.includes(geometry))).toBe(true)
  first.dispose()
  expect(
    shared.every(
      (geometry) => disposed.filter((item) => item === geometry).length === 1,
    ),
  ).toBe(true)
  second.dispose()
  vessels.get('third')!.dispose()
  expect(
    shared.every(
      (geometry) => disposed.filter((item) => item === geometry).length === 1,
    ),
  ).toBe(true)
})
