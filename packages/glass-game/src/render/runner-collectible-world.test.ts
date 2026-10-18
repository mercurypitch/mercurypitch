// Runner collectible world integration — real donors retain every other token while C01 follows chunk and reward state.
import { readFileSync } from 'node:fs'
import type { Mesh } from 'three'
import { InstancedMesh, Matrix4, Texture } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY as course } from '../runner/crystal-obstacle-study'
import { createSongRunnerGame } from '../runner/game'
import { disposeObject } from './dispose'
import { createRunnerWorld } from './runner-world'

async function donor(id: string) {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES[id]}`,
      import.meta.url,
    ),
  )
  return (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(new Uint8Array(bytes).buffer, '')
  ).scene
}

it('replaces exactly C01, retains neighbouring token matrices and reuses artwork across eviction', async () => {
  const crystal = await donor('living-crystal-platform-v2')
  const obstacles = new Map([
    ['runner-crystal-bulwark-v1', await donor('runner-crystal-bulwark-v1')],
    ['runner-rose-hurdle-v1', await donor('runner-rose-hurdle-v1')],
  ])
  const marble = new Texture(),
    texture = new Texture()
  const textureRelease = vi.spyOn(texture, 'dispose')
  expect(() =>
    createRunnerWorld(course, crystal, marble, false, undefined, obstacles),
  ).toThrow('Runner collectible artwork is missing')
  const world = createRunnerWorld(
    course,
    crystal,
    marble,
    false,
    undefined,
    obstacles,
    { texture, scale: 1.2 },
  )
  const snapshot = createSongRunnerGame(course, {
    comfortableMidi: 60,
  }).snapshot()
  const pickup = course.rewards.pickups[0]!
  const residentChunkIds = [
    ...new Set(course.rewards.pickups.map((item) => item.chunkId)),
  ]
  world.update({ ...snapshot, residentChunkIds }, 0)
  const artwork = world.root.getObjectByName('runner-collectible-c01') as Mesh
  const geometryRelease = vi.spyOn(artwork.geometry, 'dispose')
  expect(artwork.visible).toBe(true)
  const tokenPositions: number[][] = []
  const matrix = new Matrix4()
  world.root.traverse((node) => {
    if (!(node instanceof InstancedMesh) || node.name !== 'discovery-rings')
      return
    for (let index = 0; index < node.count; index++) {
      node.getMatrixAt(index, matrix)
      tokenPositions.push(matrix.elements.slice(12, 15))
    }
  })
  expect(tokenPositions).toEqual(
    course.rewards.pickups
      .slice(1)
      .map((item) => [
        item.lateralX,
        expect.closeTo(0.6),
        -item.courseDistanceMeters,
      ]),
  )
  world.setCollectibleArtworkScale(1.6)
  expect(artwork.scale.x).toBe(1.6)
  expect(artwork.position.toArray()).toEqual([
    pickup.lateralX,
    0.6,
    -pickup.courseDistanceMeters,
  ])
  world.update(
    { ...snapshot, residentChunkIds, collectedRewardIds: [pickup.id] },
    0,
  )
  expect(artwork.visible).toBe(false)
  const retired = artwork.parent!
  world.update({ ...snapshot, residentChunkIds: [] }, 0)
  expect(artwork.parent).toBeNull()
  expect(retired.parent).toBeNull()
  expect(geometryRelease).not.toHaveBeenCalled()
  world.update({ ...snapshot, residentChunkIds: [pickup.chunkId] }, 0)
  expect(world.root.getObjectByName('runner-collectible-c01')).toBe(artwork)
  expect(artwork.visible).toBe(true)
  expect(artwork.scale.x).toBe(1.6)
  world.dispose()
  world.dispose()
  expect(geometryRelease).toHaveBeenCalledOnce()
  expect(textureRelease).not.toHaveBeenCalled()
  expect(artwork.parent).toBeNull()
  for (const source of [crystal, ...obstacles.values()]) disposeObject(source)
  texture.dispose()
  marble.dispose()
})
