// Pearl lantern integration — shipped geometry rests on its support and never replaces its collision proxy.
import { readFileSync } from 'node:fs'
import { Box3, Texture, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { expect, it } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { CLOUDWAY_THAWING_SONG_ALCOVE as level } from '../content/cloudway-thawing-song-alcove'
import { FLAT_COURSE_COLLIDER } from '../core/collision'
import { MOVEMENT } from '../core/movement'
import { createMuseumAssetLoadPlan } from './asset-load-plan'
import { disposeObject } from './dispose'
import { getRoomDecorationRecipe } from './room-decoration-catalog'

it('loads the actual lantern, contains its footprint and blocks Merc without blocking either song anchor', async () => {
  const decoration = level.presentation!.decorations!.find(
    (item) => item.recipeId === 'pearl-ribbon-lantern-v1',
  )!
  const recipe = getRoomDecorationRecipe(decoration.recipeId)
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[recipe.bundle]}`,
      import.meta.url,
    ),
  )
  const loader = new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .register(() => ({
      name: 'EXT_texture_webp',
      loadTexture: async () => new Texture(),
    }))
  const scene = (
    await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      '',
    )
  ).scene
  const root = scene.getObjectByName(recipe.node)!
  expect(root).toBeDefined()
  const contract = JSON.parse(root.userData.asset_contract_json as string) as {
    support: { centreXZ: [number, number] }
    supportAnchor: string
  }
  const supportAnchor = scene.getObjectByName(contract.supportAnchor)!
  expect(supportAnchor).toBeDefined()
  expect(supportAnchor.position.x).toBeCloseTo(contract.support.centreXZ[0], 7)
  expect(supportAnchor.position.y).toBeCloseTo(0, 7)
  expect(supportAnchor.position.z).toBeCloseTo(contract.support.centreXZ[1], 7)
  root.position.copy(decoration.position)
  root.rotation.y = decoration.yaw
  root.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(root)
  const solid = level.solids!.find(
    (item) => item.id === decoration.coveredSolidIds![0],
  )!
  const floor = level.platforms.find((item) => item.id === solid.platformId)!
  expect(bounds.min.y).toBeCloseTo(floor.top, 3)
  expect(bounds.min.x).toBeGreaterThan(floor.minX)
  expect(bounds.max.x).toBeLessThan(floor.maxX)
  expect(bounds.min.z).toBeGreaterThan(floor.minZ)
  expect(bounds.max.z).toBeLessThan(floor.maxZ)
  expect(bounds.max.y).toBeLessThanOrEqual(solid.top)
  expect(solid.shape).toBe('cylinder')
  if (solid.shape !== 'cylinder') throw new Error('Expected a round proxy')
  const size = bounds.getSize(new Vector3())
  expect(Math.max(size.x, size.z) / 2).toBeLessThanOrEqual(solid.radiusBottom)
  let position = { x: solid.x - 0.8, y: floor.top, z: solid.z }
  let blocked = false
  for (let i = 0; i < 120; i++) {
    const contact = FLAT_COURSE_COLLIDER.move(
      position,
      { x: 0.01, y: 0, z: 0 },
      [...level.platforms, ...level.solids!],
      MOVEMENT,
      level.intentionalGaps,
    )
    position = contact.position
    blocked ||= contact.blockedX
    expect(
      Math.hypot(position.x - solid.x, position.z - solid.z),
    ).toBeGreaterThanOrEqual(solid.radiusBottom + MOVEMENT.radius - 0.001)
  }
  expect(blocked).toBe(true)
  for (const target of level.breakables.filter((item) => item.optional))
    expect(
      Math.hypot(target.anchor.x - solid.x, target.anchor.z - solid.z),
    ).toBeGreaterThan(solid.radiusBottom + MOVEMENT.radius)
  expect(
    createMuseumAssetLoadPlan(level).bundles.filter(
      (id) => id === recipe.bundle,
    ),
  ).toHaveLength(1)
  disposeObject(scene)
})
