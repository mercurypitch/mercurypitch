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
import { RUNNER_GAP_APRON_METERS, runnerGapArtSpans, runnerTrackBounds, } from './runner-world-layout'

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
  const track = runnerTrackBounds(SINGING_CURRENT)
  expect(bounds.max.y).toBeCloseTo(SINGING_CURRENT.groundFeetY, 5)
  expect(bounds.min.x).toBeCloseTo(track.left, 5)
  expect(bounds.max.x).toBeCloseTo(track.right, 5)
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

it('leaves the gap face open while deep shadow, thin lips and runway cues stay below support', async () => {
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
  const world = createRunnerWorld(SINGING_CURRENT, scene, map, false)
  const snapshot = createSongRunnerGame(SINGING_CURRENT, {
    comfortableMidi: 60,
  }).snapshot()
  const firstGap = SINGING_CURRENT.obstacles.find(
    (obstacle) => obstacle.kind === 'gap',
  )!
  world.update(
    {
      ...snapshot,
      residentChunkIds: [firstGap.chunkId],
    },
    0,
  )
  const mesh = (name: string) => {
    let match: InstancedMesh | undefined
    world.root.traverse((node) => {
      if (node instanceof InstancedMesh && node.name === name && node.count > 0)
        match = node
    })
    return match!
  }
  const instanceBounds = (source: InstancedMesh, index = 0) => {
    source.geometry.computeBoundingBox()
    const matrix = new Matrix4()
    source.getMatrixAt(index, matrix)
    return source.geometry.boundingBox!.clone().applyMatrix4(matrix)
  }
  const span = runnerGapArtSpans(SINGING_CURRENT, firstGap.chunkId)[0]!
  const track = runnerTrackBounds(SINGING_CURRENT)
  const depth = instanceBounds(mesh('runner-gap-void-depth'))
  expect(depth.min.x).toBeCloseTo(track.left, 5)
  expect(depth.max.x).toBeCloseTo(track.right, 5)
  expect(depth.min.z).toBeCloseTo(-span.gapEnd, 5)
  expect(depth.max.z).toBeCloseTo(-span.gapStart, 5)
  expect(depth.max.y).toBeLessThan(SINGING_CURRENT.groundFeetY - 1)

  expect(world.root.getObjectByName('runner-gap-undercuts')).toBeUndefined()

  const range = (bounds: Box3) => ({
    start: -bounds.max.z,
    end: -bounds.min.z,
  })
  const marbleAprons = mesh('pearl-runway')
  const marbleRanges = Array.from({ length: marbleAprons.count }, (_, index) =>
    range(instanceBounds(marbleAprons, index)),
  )
  expect(marbleRanges).toEqual(
    expect.arrayContaining([
      {
        start: expect.closeTo(span.gapStart - RUNNER_GAP_APRON_METERS, 5),
        end: expect.closeTo(span.gapStart, 5),
      },
      {
        start: expect.closeTo(span.gapEnd, 5),
        end: expect.closeTo(span.gapEnd + RUNNER_GAP_APRON_METERS, 5),
      },
    ]),
  )

  // The donor hardware is 1.804m deep despite its 1.7m certified shell.
  // Aprons keep every overhanging rail well away from the actual opening.
  const crystalHardware = mesh('living-crystal-1')
  for (let index = 0; index < crystalHardware.count; index++) {
    const hardware = range(instanceBounds(crystalHardware, index))
    expect(
      hardware.end <= firstGap.minCourseDistanceMeters - 0.8 ||
        hardware.start >= firstGap.maxCourseDistanceMeters + 0.8,
    ).toBe(true)
  }
  const takeoff = instanceBounds(mesh('runner-gap-takeoff-lips'))
  const landing = instanceBounds(mesh('runner-gap-landing-lips'))
  expect(-takeoff.min.z).toBeLessThan(span.gapStart)
  expect(-landing.max.z).toBeGreaterThan(span.gapEnd)

  const band = instanceBounds(mesh('runner-gap-landing-bands'))
  expect(-band.max.z).toBeCloseTo(span.landingBandStart, 5)
  expect(-band.min.z).toBeCloseTo(span.landingBandEnd, 5)
  const runway = mesh('runner-gap-jump-runway')
  expect(runway.count).toBe(18)
  for (let index = 0; index < runway.count; index++)
    expect(-instanceBounds(runway, index).min.z).toBeLessThan(
      span.takeoffLipStart,
    )

  world.dispose()
  disposeObject(scene)
  map.dispose()
})
