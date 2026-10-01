// Runner scenery — bounded chunk instances use certified floor cuts and reviewed Living Crystal geometry.
import type { BufferGeometry, Material, Object3D, Texture } from 'three'
import { BoxGeometry, Group, InstancedMesh, Matrix4, MeshPhysicalMaterial, TorusGeometry, Vector3, } from 'three'
import { LIVING_CRYSTAL_PLATFORM_NODES } from '../content/living-crystal-profile'
import type { CompiledRunnerCourse, RunnerSnapshot } from '../runner/contracts'
import { createLivingCrystalInteriorAnimation } from './living-crystal-interior'
import { validateLivingCrystalPlatformDonor } from './living-crystal-platform-contract'
import { runnerFloorCells } from './runner-world-layout'

function batch(
  geometry: BufferGeometry,
  material: Material,
  matrices: readonly Matrix4[],
  name: string,
) {
  const mesh = new InstancedMesh(geometry, material, matrices.length)
  mesh.name = name
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
  mesh.computeBoundingSphere()
  mesh.receiveShadow = true
  return mesh
}

function box(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
) {
  return new Matrix4()
    .makeTranslation(x, y, z)
    .multiply(new Matrix4().makeScale(width, height, depth))
}

export function createRunnerWorld(
  course: CompiledRunnerCourse,
  crystalScene: Object3D,
  marbleMap: Texture,
  reducedMotion: boolean,
) {
  const donor = crystalScene.getObjectByName(LIVING_CRYSTAL_PLATFORM_NODES.root)
  if (!donor) throw new Error('Runner crystal support is missing.')
  const contract = validateLivingCrystalPlatformDonor(donor)
  const root = new Group()
  root.name = 'singing-current-world'
  const boxGeometry = new BoxGeometry(1, 1, 1)
  const pickupGeometry = new TorusGeometry(0.16, 0.035, 6, 24)
  const marble = new MeshPhysicalMaterial({
    color: 0xf4eee0,
    map: marbleMap,
    roughness: 0.24,
    metalness: 0.05,
    clearcoat: 0.6,
  })
  const gold = new MeshPhysicalMaterial({
    color: 0xd6a648,
    roughness: 0.23,
    metalness: 0.88,
  })
  const frost = new MeshPhysicalMaterial({
    color: 0x86cbd3,
    roughness: 0.19,
    metalness: 0.13,
    clearcoat: 0.8,
  })
  const lane = new MeshPhysicalMaterial({
    color: 0xc5a75c,
    roughness: 0.55,
    metalness: 0.5,
  })
  const roots = createLivingCrystalInteriorAnimation({
    variant: 'pearl-roots',
    seed: course.seed,
    reducedMotion,
    intensity: 1.1,
  })
  const crystalParts = [
    contract.shell,
    contract.hardware,
    contract.interior,
  ].map((mesh, index) => {
    mesh.updateWorldMatrix(true, false)
    return {
      geometry: mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
      material:
        index === 2 ? roots.material : (mesh.material as Material).clone(),
    }
  })
  const installed = new Map<
    string,
    {
      root: Group
      meshes: InstancedMesh[]
      coins: InstancedMesh
      rewardIds: string[]
    }
  >()
  let disposed = false

  function install(id: string) {
    const cells = runnerFloorCells(course, id)
    const chunk = course.chunks.find((item) => item.id === id)!
    const group = new Group()
    group.name = `runner-chunk-${id}`
    const stone: Matrix4[] = [],
      trim: Matrix4[] = [],
      lines: Matrix4[] = [],
      crystal: Matrix4[] = [],
      blockers: Matrix4[] = []
    for (const cell of cells) {
      const width = cell.maxX - cell.minX,
        depth = cell.end - cell.start,
        x = (cell.minX + cell.maxX) / 2,
        z = -(cell.start + cell.end) / 2
      const glass = chunk.index % 3 === 1 && width > 4 && depth > 2
      if (glass)
        crystal.push(box(x, course.groundFeetY, z, width / 3, 1, depth / 1.7))
      else stone.push(box(x, course.groundFeetY - 0.19, z, width, 0.38, depth))
      // Perimeter ribbons sit on solid geometry; never paint a path across a real gap.
      for (const edge of [cell.minX + 0.025, cell.maxX - 0.025])
        trim.push(box(edge, course.groundFeetY - 0.045, z, 0.04, 0.07, depth))
      trim.push(
        box(x, course.groundFeetY - 0.045, -cell.start, width, 0.07, 0.04),
      )
      for (const divide of [-1, 1])
        if (divide > cell.minX && divide < cell.maxX)
          lines.push(
            box(
              divide,
              course.groundFeetY + 0.003,
              z,
              0.018,
              0.004,
              Math.max(0.05, depth - 0.18),
            ),
          )
    }
    for (const obstacle of course.obstacles)
      if (obstacle.chunkId === id && obstacle.kind === 'blocker') {
        blockers.push(
          box(
            (obstacle.minLateralX + obstacle.maxLateralX) / 2,
            (obstacle.minY + obstacle.maxY) / 2,
            -(
              obstacle.minCourseDistanceMeters +
              obstacle.maxCourseDistanceMeters
            ) / 2,
            obstacle.maxLateralX - obstacle.minLateralX,
            obstacle.maxY - obstacle.minY,
            obstacle.maxCourseDistanceMeters - obstacle.minCourseDistanceMeters,
          ),
        )
      }
    const meshes = [
      batch(boxGeometry, marble, stone, 'pearl-runway'),
      batch(boxGeometry, gold, trim, 'gilt-runway-edges'),
      batch(boxGeometry, lane, lines, 'lane-inlays'),
      batch(boxGeometry, frost, blockers, 'frost-obstacles'),
      ...crystalParts.map((part, index) =>
        batch(part.geometry, part.material, crystal, `living-crystal-${index}`),
      ),
    ]
    const pickups = course.rewards.pickups.filter((item) => item.chunkId === id)
    const coins = batch(
      pickupGeometry,
      gold,
      pickups.map((item) =>
        new Matrix4().makeTranslation(
          item.lateralX,
          0.6,
          -item.courseDistanceMeters,
        ),
      ),
      'discovery-rings',
    )
    group.add(...meshes, coins)
    root.add(group)
    const item = {
      root: group,
      meshes,
      coins,
      rewardIds: pickups.map((pickup) => pickup.id),
    }
    installed.set(id, item)
    return item
  }

  return {
    root,
    update(snapshot: RunnerSnapshot, dt: number) {
      if (disposed) return
      const resident = new Set(snapshot.residentChunkIds)
      for (const [id, item] of installed)
        if (!resident.has(id)) {
          item.root.removeFromParent()
          for (const mesh of [...item.meshes, item.coins]) mesh.dispose()
          installed.delete(id)
        }
      for (const id of resident) {
        const item = installed.get(id) ?? install(id)
        const pickups = course.rewards.pickups.filter(
          (pickup) => pickup.chunkId === id,
        )
        pickups.forEach((pickup, index) => {
          const matrix = new Matrix4().makeTranslation(
            pickup.lateralX,
            0.6,
            -pickup.courseDistanceMeters,
          )
          if (snapshot.collectedRewardIds.includes(pickup.id))
            matrix.scale(new Vector3(0, 0, 0))
          else
            matrix.multiply(
              new Matrix4().makeRotationY(
                reducedMotion ? 0 : snapshot.courseSeconds * 1.2,
              ),
            )
          item.coins.setMatrixAt(index, matrix)
        })
        item.coins.instanceMatrix.needsUpdate = true
      }
      root.position.z = snapshot.courseDistanceMeters
      roots.update({ deltaSeconds: dt, paused: snapshot.status !== 'running' })
    },
    metrics: () => ({
      residentChunks: installed.size,
      instances: [...installed.values()].reduce(
        (n, item) =>
          n +
          item.meshes.reduce((sum, mesh) => sum + mesh.count, 0) +
          item.coins.count,
        0,
      ),
    }),
    dispose() {
      if (disposed) return
      disposed = true
      for (const item of installed.values())
        for (const mesh of [...item.meshes, item.coins]) mesh.dispose()
      root.clear()
      root.removeFromParent()
      installed.clear()
      boxGeometry.dispose()
      pickupGeometry.dispose()
      marble.dispose()
      gold.dispose()
      frost.dispose()
      lane.dispose()
      crystalParts.forEach((part, index) => {
        part.geometry.dispose()
        if (index !== 2) part.material.dispose()
      })
      roots.dispose()
    },
  }
}
