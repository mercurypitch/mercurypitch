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
import { RUNNER_GAP_APRON_METERS, RUNNER_GAP_APRON_THICKNESS_METERS, RUNNER_GAP_LIP_RADIUS_METERS, runnerGapArtSpans, runnerTrackBounds, } from './runner-world-layout'

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

it('leaves the gap open to sky between thin marble caps and flush edge lines', async () => {
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
  expect(world.root.getObjectByName('runner-gap-void-depth')).toBeUndefined()
  expect(world.root.getObjectByName('runner-gap-undercuts')).toBeUndefined()

  const range = (bounds: Box3) => ({
    start: -bounds.max.z,
    end: -bounds.min.z,
  })
  const marbleAprons = mesh('pearl-runway')
  const marbleBounds = Array.from({ length: marbleAprons.count }, (_, index) =>
    instanceBounds(marbleAprons, index),
  )
  const expectThinApron = (start: number, end: number) => {
    const bounds = marbleBounds
      .filter((candidate) => {
        const candidateRange = range(candidate)
        return (
          candidateRange.start >= start - 1e-5 &&
          candidateRange.end <= end + 1e-5
        )
      })
      .sort((a, b) => range(a).start - range(b).start)
    expect(bounds.length).toBeGreaterThan(0)
    expect(range(bounds[0]!).start).toBeCloseTo(start, 5)
    expect(range(bounds.at(-1)!).end).toBeCloseTo(end, 5)
    expect(
      bounds.reduce(
        (covered, candidate) =>
          covered + range(candidate).end - range(candidate).start,
        0,
      ),
    ).toBeCloseTo(end - start, 5)
    bounds.forEach((candidate, index) => {
      if (index > 0)
        expect(range(bounds[index - 1]!).end).toBeCloseTo(
          range(candidate).start,
          5,
        )
      expect(candidate.max.y).toBeCloseTo(SINGING_CURRENT.groundFeetY, 5)
      expect(candidate.min.y).toBeCloseTo(
        SINGING_CURRENT.groundFeetY - RUNNER_GAP_APRON_THICKNESS_METERS,
        5,
      )
    })
  }
  expectThinApron(span.gapStart - RUNNER_GAP_APRON_METERS, span.gapStart)
  expectThinApron(span.gapEnd, span.gapEnd + RUNNER_GAP_APRON_METERS)

  const gilt = mesh('gilt-runway-edges')
  for (let index = 0; index < gilt.count; index++) {
    const bounds = instanceBounds(gilt, index)
    if (bounds.max.x - bounds.min.x < track.right - track.left - 0.1) continue
    const ribbon = range(bounds)
    expect(
      Math.abs((ribbon.start + ribbon.end) / 2 - span.gapStart),
    ).toBeGreaterThan(0.03)
    expect(
      Math.abs((ribbon.start + ribbon.end) / 2 - span.gapEnd),
    ).toBeGreaterThan(0.03)
  }

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
  expect(-takeoff.max.z).toBeCloseTo(
    span.gapStart - RUNNER_GAP_LIP_RADIUS_METERS * 2,
    5,
  )
  expect(-takeoff.min.z).toBeCloseTo(span.gapStart, 5)
  expect(-landing.max.z).toBeCloseTo(span.gapEnd, 5)
  expect(-landing.min.z).toBeCloseTo(
    span.gapEnd + RUNNER_GAP_LIP_RADIUS_METERS * 2,
    5,
  )
  for (const lip of [takeoff, landing]) {
    expect(lip.max.y).toBeCloseTo(SINGING_CURRENT.groundFeetY, 5)
    expect(lip.min.y).toBeCloseTo(
      SINGING_CURRENT.groundFeetY - RUNNER_GAP_LIP_RADIUS_METERS * 2,
      5,
    )
  }

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
