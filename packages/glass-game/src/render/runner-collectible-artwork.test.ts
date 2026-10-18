// Runner artwork ownership tests — authored collection, residency, facing and disposal remain independent of scale.
import type { Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'
import { Group, PerspectiveCamera, Quaternion, Texture } from 'three'
import { expect, it, vi } from 'vitest'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY as course } from '../runner/crystal-obstacle-study'
import { createSongRunnerGame } from '../runner/game'
import { createRunnerCollectibleArtwork } from './runner-collectible-artwork'

const pickup = course.rewards.pickups[0]!

function fixture() {
  const texture = new Texture()
  const artwork = createRunnerCollectibleArtwork(pickup, texture)
  const chunk = new Group()
  artwork.attach(chunk, pickup.chunkId)
  const mesh = chunk.children[0] as Mesh<PlaneGeometry, MeshBasicMaterial>
  const snapshot = {
    ...createSongRunnerGame(course, { comfortableMidi: 60 }).snapshot(),
    residentChunkIds: [pickup.chunkId],
  }
  return { texture, artwork, chunk, mesh, snapshot }
}

it('uses one opaque alpha-cutout in the transmission source, with the accepted default size and position', () => {
  const { artwork, texture, mesh, snapshot } = fixture()
  artwork.update(snapshot)
  expect(mesh.visible).toBe(true)
  expect(mesh.position.toArray()).toEqual([
    pickup.lateralX,
    0.6,
    -pickup.courseDistanceMeters,
  ])
  expect(mesh.geometry.parameters).toMatchObject({ width: 0.65, height: 0.65 })
  expect(mesh.scale.toArray()).toEqual([1.2, 1.2, 1.2])
  expect(mesh.material).toMatchObject({
    map: texture,
    transparent: false,
    alphaTest: 0.5,
    alphaToCoverage: true,
    toneMapped: false,
    depthTest: true,
    depthWrite: true,
  })
  expect(mesh.castShadow).toBe(false)
  expect(mesh.userData.pickupId).toBe(pickup.id)
  artwork.dispose()
})

it('reuses resources through tuning and chunk eviction, and trusts collected IDs on remount', () => {
  const { artwork, texture, mesh, chunk, snapshot } = fixture()
  const geometry = mesh.geometry,
    material = mesh.material
  const released = [geometry, material, texture].map((value) =>
    vi.spyOn(value, 'dispose'),
  )
  const before = JSON.stringify(course.rewards)
  artwork.setScale(9)
  expect(mesh.scale.x).toBe(1.6)
  artwork.setScale(0)
  expect(mesh.scale.x).toBe(0.8)
  artwork.setScale(NaN)
  expect(mesh.scale.x).toBe(1.2)
  expect(mesh.geometry).toBe(geometry)
  expect(mesh.material).toBe(material)
  artwork.update({ ...snapshot, collectedRewardIds: [pickup.id] })
  expect(mesh.visible).toBe(false)
  artwork.retireChunk('other')
  expect(mesh.parent).toBe(chunk)
  artwork.retireChunk(pickup.chunkId)
  expect(mesh.parent).toBeNull()
  expect(mesh.visible).toBe(false)
  const next = new Group()
  artwork.attach(next, 'other')
  expect(next.children).toHaveLength(0)
  artwork.attach(next, pickup.chunkId)
  artwork.update({ ...snapshot, collectedRewardIds: [pickup.id] })
  expect(mesh.visible).toBe(false)
  artwork.update(snapshot)
  expect(mesh.visible).toBe(true)
  artwork.update({ ...snapshot, residentChunkIds: [] })
  expect(mesh.visible).toBe(false)
  expect(JSON.stringify(course.rewards)).toBe(before)
  for (const release of released) expect(release).not.toHaveBeenCalled()
  artwork.dispose()
  artwork.dispose()
  expect(released[0]).toHaveBeenCalledOnce()
  expect(released[1]).toHaveBeenCalledOnce()
  expect(released[2]).not.toHaveBeenCalled()
  artwork.attach(next, pickup.chunkId)
  artwork.setScale(1.6)
  artwork.update(snapshot)
  expect(mesh.parent).toBeNull()
  expect(mesh.visible).toBe(false)
  expect(mesh.scale.x).toBe(1.2)
})

it('faces the actual camera after its pose changes, including a transformed chunk parent', () => {
  const { artwork, mesh, chunk } = fixture()
  chunk.rotation.set(0.1, 0.4, -0.2)
  const camera = new PerspectiveCamera()
  const worldRotation = new Quaternion()
  for (const x of [-2, 0, 2]) {
    camera.position.set(x, 2.4, 4)
    camera.lookAt(x * 0.2, 0.5, -5)
    artwork.faceCamera(camera)
    mesh.getWorldQuaternion(worldRotation)
    expect(worldRotation.angleTo(camera.quaternion)).toBeLessThan(1e-7)
    expect(mesh.position.toArray()).toEqual([
      pickup.lateralX,
      0.6,
      -pickup.courseDistanceMeters,
    ])
  }
  artwork.dispose()
})

it.each([false, true])(
  'temporarily warms later artwork and restores its prior residency (resident: %s)',
  async (resident) => {
    const { artwork, mesh, chunk } = fixture()
    if (!resident) artwork.retireChunk(pickup.chunkId)
    const root = new Group()
    const previousParent = mesh.parent
    const geometry = mesh.geometry,
      material = mesh.material
    for (const fail of [false, true]) {
      const prepare = artwork.withWarmupState(root, async () => {
        expect(mesh.parent).toBe(resident ? chunk : root)
        expect(mesh.visible).toBe(true)
        expect(mesh.geometry).toBe(geometry)
        expect(mesh.material).toBe(material)
        if (fail) throw new Error('program preparation failed')
      })
      if (fail)
        await expect(prepare).rejects.toThrow('program preparation failed')
      else await prepare
      expect(mesh.parent).toBe(previousParent)
      expect(mesh.visible).toBe(false)
      expect(root.children).toHaveLength(0)
    }
    artwork.dispose()
  },
)

it('never restores a disposed artwork when preparation completes after exit', async () => {
  const { artwork, mesh, texture } = fixture()
  artwork.retireChunk(pickup.chunkId)
  const root = new Group()
  const released = [mesh.geometry, mesh.material, texture].map((value) =>
    vi.spyOn(value, 'dispose'),
  )
  let complete!: () => void
  const warmup = artwork.withWarmupState(
    root,
    () =>
      new Promise<void>((resolve) => {
        complete = resolve
      }),
  )
  expect(root.children).toEqual([mesh])
  artwork.dispose()
  complete()
  await warmup
  expect(root.children).toHaveLength(0)
  expect(mesh.visible).toBe(false)
  expect(released[0]).toHaveBeenCalledOnce()
  expect(released[1]).toHaveBeenCalledOnce()
  expect(released[2]).not.toHaveBeenCalled()
  const prepareAgain = vi.fn(async () => {})
  await artwork.withWarmupState(root, prepareAgain)
  expect(prepareAgain).not.toHaveBeenCalled()
})
