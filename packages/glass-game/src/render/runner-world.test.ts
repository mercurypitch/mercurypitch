// Runner world resource tests — real reviewed geometry remains instanced and bounded across chunks.
import { readFileSync } from 'node:fs'
import { Box3, InstancedMesh, Matrix4, Texture } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES } from '../browser/assets'
import { SINGING_CURRENT } from '../runner/first-course'
import { createSongRunnerGame } from '../runner/game'
import { disposeObject } from './dispose'
import { createRunnerWorld } from './runner-world'

it('instances reviewed crystal at the gameplay floor, reclaims retired chunks and disposes only owned resources', async () => {
  const bytes = readFileSync(
    new URL(
      `../../../../apps/beside-cue/public/games/${GLASS_GAME_ASSET_FILES['living-crystal-platform-v2']}`,
      import.meta.url,
    ),
  )
  const scene = (
    await new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .parseAsync(new Uint8Array(bytes).buffer, '')
  ).scene
  const map = new Texture()
  const mapDisposed = vi.fn()
  map.addEventListener('dispose', mapDisposed)
  const world = createRunnerWorld(SINGING_CURRENT, scene, map, false)
  const game = createSongRunnerGame(SINGING_CURRENT, { comfortableMidi: 60 })
  const snapshot = game.snapshot()
  const chunks = SINGING_CURRENT.chunks
  world.update(
    { ...snapshot, residentChunkIds: [chunks[0]!.id, chunks[1]!.id] },
    0,
  )
  const retired = world.root.children[0]!
  const retiredInstances: InstancedMesh[] = []
  retired.traverse((node) => {
    if (node instanceof InstancedMesh) retiredInstances.push(node)
  })
  const retiredDisposals = retiredInstances.map((mesh) => {
    const spy = vi.fn()
    mesh.addEventListener('dispose', spy)
    return spy
  })
  const shells: InstancedMesh[] = []
  world.root.traverse((node) => {
    if (
      node instanceof InstancedMesh &&
      node.name === 'living-crystal-0' &&
      node.count > 0
    )
      shells.push(node)
  })
  expect(shells).toHaveLength(1)
  const shell = shells[0]!
  const matrix = new Matrix4()
  shell.getMatrixAt(0, matrix)
  shell.geometry.computeBoundingBox()
  const bounds = new Box3()
    .copy(shell.geometry.boundingBox!)
    .applyMatrix4(matrix)
  expect(bounds.max.y).toBeCloseTo(SINGING_CURRENT.groundFeetY, 5)
  expect(bounds.min.x).toBeCloseTo(-3, 5)
  expect(bounds.max.x).toBeCloseTo(3, 5)
  expect(shell.count).toBeGreaterThan(1)
  world.update(
    { ...snapshot, residentChunkIds: [chunks[1]!.id, chunks[2]!.id] },
    0.02,
  )
  expect(retired.parent).toBeNull()
  for (const disposed of retiredDisposals)
    expect(disposed).toHaveBeenCalledOnce()
  expect(world.metrics().residentChunks).toBe(2)
  expect(world.root.children).toHaveLength(2)
  expect(mapDisposed).not.toHaveBeenCalled()
  const geometryDisposed = vi.fn()
  shell.geometry.addEventListener('dispose', geometryDisposed)
  world.dispose()
  world.dispose()
  expect(geometryDisposed).toHaveBeenCalledOnce()
  expect(mapDisposed).not.toHaveBeenCalled()
  expect(world.root.children).toHaveLength(0)
  disposeObject(scene)
  map.dispose()
})
