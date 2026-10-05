// Crystal obstacle export tests — real GLBs must align, instance and retire without donor disposal.
import { readFileSync } from 'node:fs'
import type { Mesh, Object3D } from 'three'
import { Box3, Matrix4, Vector3 } from 'three'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { expect, it, vi } from 'vitest'
import { GLASS_GAME_ASSET_FILES, GLASS_GAME_REQUIRED_FILES, } from '../browser/assets'
import { runnerObstacleArt } from '../content/runner-obstacle-profiles'
import { SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY } from '../runner/crystal-obstacle-study'
import { disposeObject } from './dispose'
import { createRunnerObstacleArt } from './runner-obstacles'

const course = SINGING_CURRENT_CRYSTAL_CONTINUOUS_STUDY

async function sources() {
  const result = new Map<string, Object3D>()
  for (const bundle of ['runner-crystal-bulwark-v1', 'runner-rose-hurdle-v1']) {
    const file = GLASS_GAME_ASSET_FILES[bundle]!
    expect(GLASS_GAME_REQUIRED_FILES).toContain(file)
    const bytes = readFileSync(
      new URL(
        `../../../../apps/beside-cue/public/games/${file}`,
        import.meta.url,
      ),
    )
    const header = JSON.parse(
      bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
    )
    // Full-resolution material studies remain in the archive, not a phone visit.
    expect(header.images ?? []).toHaveLength(0)
    expect(bytes.byteLength).toBeLessThan(2_000_000)
    result.set(
      bundle,
      (
        await new GLTFLoader()
          .setMeshoptDecoder(MeshoptDecoder)
          .parseAsync(new Uint8Array(bytes).buffer, '')
      ).scene,
    )
  }
  return result
}

it('fits each exported optical shell and trim to the visible course envelope', async () => {
  const donors = await sources()
  const art = createRunnerObstacleArt(course, donors)
  for (const obstacle of course.obstacles) {
    if (obstacle.kind !== 'blocker') continue
    const profile = runnerObstacleArt(obstacle.profileId)!
    const chunks = art.chunk(obstacle.chunkId)
    const meshes = chunks.filter((mesh) =>
      profile.parts.some((name) => mesh.name === `runner-obstacle-${name}`),
    )
    expect(meshes).toHaveLength(2)
    const bounds = new Box3()
    for (const mesh of meshes) {
      const matrix = new Matrix4()
      mesh.getMatrixAt(0, matrix)
      bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix))
      expect(mesh.material).not.toBe(
        (
          donors
            .get(profile.bundle)!
            .getObjectByName(mesh.name.replace('runner-obstacle-', '')) as Mesh
        ).material,
      )
    }
    expect(bounds.min.x).toBeCloseTo(obstacle.minLateralX, 3)
    expect(bounds.max.x).toBeCloseTo(obstacle.maxLateralX, 3)
    expect(bounds.min.y).toBeCloseTo(obstacle.minY, 3)
    expect(bounds.max.y).toBeCloseTo(obstacle.maxY, 3)
    expect(bounds.min.z).toBeCloseTo(-obstacle.maxCourseDistanceMeters, 3)
    expect(bounds.max.z).toBeCloseTo(-obstacle.minCourseDistanceMeters, 3)
    for (const mesh of chunks) mesh.dispose()
  }
  art.dispose()
  donors.forEach((donor) => disposeObject(donor))
})

it('batches repeated profiles and releases only owned geometry/materials once', async () => {
  const donors = await sources()
  const obstacle = course.obstacles.find((o) => o.kind === 'blocker')!
  const repeated = {
    ...course,
    obstacles: [obstacle, { ...obstacle, id: 'second-copy' }],
  }
  const art = createRunnerObstacleArt(repeated, donors)
  const instances = art.chunk(obstacle.chunkId)
  expect(instances).toHaveLength(2)
  expect(instances.every((mesh) => mesh.count === 2)).toBe(true)
  const donor = donors
    .get('runner-crystal-bulwark-v1')!
    .getObjectByName('B01_Gold') as Mesh
  const donorDisposed = vi.fn()
  donor.geometry.addEventListener('dispose', donorDisposed)
  const ownedDisposed = vi.fn()
  instances[0]!.geometry.addEventListener('dispose', ownedDisposed)
  instances.forEach((mesh) => mesh.dispose())
  expect(ownedDisposed).not.toHaveBeenCalled()
  art.dispose()
  art.dispose()
  expect(ownedDisposed).toHaveBeenCalledOnce()
  expect(donorDisposed).not.toHaveBeenCalled()
  expect(art.chunk(obstacle.chunkId)).toEqual([])
  donors.forEach((donor) => disposeObject(donor))
})

it('encloses each exported surface in its curved collision profile, including band crossings', async () => {
  const donors = await sources()
  for (const obstacle of course.obstacles) {
    if (obstacle.kind !== 'blocker') continue
    const shape = obstacle.collisionProfile!
    expect(shape).toBeDefined()
    const bands =
      shape.kind === 'convex-yz'
        ? [{ minXFraction: -0.5, maxXFraction: 0.5, vertices: shape.vertices }]
        : shape.bands
    const profile = runnerObstacleArt(obstacle.profileId)!
    const donor = donors.get(profile.bundle)!
    donor.updateMatrixWorld(true)
    for (const name of profile.parts) {
      const mesh = donor.getObjectByName(name) as Mesh
      const positions = mesh.geometry.getAttribute('position')
      const index = mesh.geometry.index
      const points = Array.from({ length: positions.count }, (_, i) =>
        new Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(mesh.matrixWorld),
      )
      for (const band of bands) {
        const samples = points.filter(
          (p) => p.x >= band.minXFraction && p.x <= band.maxXFraction,
        )
        // Clipping a triangle at a band boundary creates new vertices. Checking
        // those too catches protruding shoulders between two authored bands.
        const count = index?.count ?? positions.count
        for (let i = 0; i < count; i += 3) {
          const triangle = [0, 1, 2].map(
            (offset) => points[index?.getX(i + offset) ?? i + offset]!,
          )
          for (const [edge, a] of triangle.entries()) {
            const b = triangle[(edge + 1) % 3]!
            for (const x of [band.minXFraction, band.maxXFraction]) {
              if ((a.x < x && b.x > x) || (a.x > x && b.x < x))
                samples.push(a.clone().lerp(b, (x - a.x) / (b.x - a.x)))
            }
          }
        }
        const vertices = band.vertices
        const signedArea = vertices.reduce((area, a, i) => {
          const b = vertices[(i + 1) % vertices.length]!
          return area + a.zFraction * b.yFraction - b.zFraction * a.yFraction
        }, 0)
        let greatestOutsideDistance = 0
        for (const point of samples)
          for (const [i, a] of vertices.entries()) {
            const b = vertices[(i + 1) % vertices.length]!
            const dz = b.zFraction - a.zFraction
            const dy = b.yFraction - a.yFraction
            // Geometry faces negative world Z; collision fractions advance
            // along positive course distance.
            const signedDistance =
              (Math.sign(signedArea) *
                (dz * (point.y - a.yFraction) -
                  dy * (-point.z - a.zFraction))) /
              Math.hypot(dz, dy)
            greatestOutsideDistance = Math.max(
              greatestOutsideDistance,
              -signedDistance,
            )
          }
        // Float GLB export tolerance, below one millimetre at these envelopes.
        expect(
          greatestOutsideDistance,
          `${obstacle.id}/${name}/${band.minXFraction}`,
        ).toBeLessThan(0.0005)
      }
    }
  }
  donors.forEach((donor) => disposeObject(donor))
})

it('rejects missing or incorrectly scaled models instead of silently rendering a box', async () => {
  expect(() => createRunnerObstacleArt(course, new Map())).toThrow(
    'Missing crystal obstacle donor',
  )
  const donors = await sources()
  donors.get('runner-crystal-bulwark-v1')!.scale.setScalar(0.5)
  expect(() => createRunnerObstacleArt(course, donors)).toThrow(
    'not grounded and normalized',
  )
  donors.forEach((donor) => disposeObject(donor))
})
