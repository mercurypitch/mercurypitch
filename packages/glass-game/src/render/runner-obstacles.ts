// Crystal obstacle instances — shared donor geometry stays bounded to resident course chunks.
import type { BufferGeometry, Material, Object3D } from 'three'
import { Box3, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, Vector3, } from 'three'
import { runnerObstacleArt } from '../content/runner-obstacle-profiles'
import type { CompiledRunnerCourse } from '../runner/contracts'

interface ObstaclePart {
  readonly name: string
  readonly geometry: BufferGeometry
  readonly material: Material
}

export function createRunnerObstacleArt(
  course: CompiledRunnerCourse,
  sources: ReadonlyMap<string, Object3D>,
) {
  const parts = new Map<string, readonly ObstaclePart[]>()
  let disposed = false
  const release = () => {
    for (const bundle of parts.values())
      for (const part of bundle) {
        part.geometry.dispose()
        part.material.dispose()
      }
    parts.clear()
  }
  try {
    for (const obstacle of course.obstacles) {
      if (obstacle.kind !== 'blocker') continue
      const profile = runnerObstacleArt(obstacle.profileId)
      if (!profile || parts.has(profile.bundle)) continue
      const root = sources.get(profile.bundle)?.getObjectByName(profile.root)
      if (!root)
        throw new Error(`Missing crystal obstacle donor: ${profile.root}`)
      root.updateWorldMatrix(true, true)
      const next: ObstaclePart[] = []
      parts.set(profile.bundle, next)
      const bounds = new Box3()
      for (const name of profile.parts) {
        const mesh = root.getObjectByName(name)
        if (!(mesh instanceof Mesh) || Array.isArray(mesh.material))
          throw new Error(`Invalid crystal obstacle part: ${name}`)
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
        geometry.computeBoundingBox()
        const material = mesh.material.clone()
        // The close runner view needs a shorter optical path than the donor's
        // dense blue volume. Keep its tint and frame, with less absorption and
        // refraction displacement through the same transmission pass.
        if (name === 'B01_Crystal' && material instanceof MeshPhysicalMaterial)
          material.thickness = 0.18
        next.push({ name, geometry, material })
        bounds.union(geometry.boundingBox!)
      }
      const expectedMin = new Vector3(-0.5, 0, -0.5)
      const expectedMax = new Vector3(0.5, 1, 0.5)
      if (
        bounds.min.distanceTo(expectedMin) > 0.004 ||
        bounds.max.distanceTo(expectedMax) > 0.004
      )
        throw new Error(
          `Crystal obstacle is not grounded and normalized: ${profile.root}`,
        )
    }
  } catch (error) {
    release()
    throw error
  }

  return {
    chunk(id: string): InstancedMesh[] {
      if (disposed) return []
      const transforms = new Map<string, Matrix4[]>()
      for (const obstacle of course.obstacles) {
        if (obstacle.chunkId !== id || obstacle.kind !== 'blocker') continue
        const profile = runnerObstacleArt(obstacle.profileId)
        if (!profile) continue
        const list = transforms.get(profile.bundle) ?? []
        list.push(
          new Matrix4()
            .makeTranslation(
              (obstacle.minLateralX + obstacle.maxLateralX) / 2,
              obstacle.minY,
              -(
                obstacle.minCourseDistanceMeters +
                obstacle.maxCourseDistanceMeters
              ) / 2,
            )
            .multiply(
              new Matrix4().makeScale(
                obstacle.maxLateralX - obstacle.minLateralX,
                obstacle.maxY - obstacle.minY,
                obstacle.maxCourseDistanceMeters -
                  obstacle.minCourseDistanceMeters,
              ),
            ),
        )
        transforms.set(profile.bundle, list)
      }
      const meshes: InstancedMesh[] = []
      for (const [bundle, matrices] of transforms)
        for (const part of parts.get(bundle)!) {
          const mesh = new InstancedMesh(
            part.geometry,
            part.material,
            matrices.length,
          )
          mesh.name = `runner-obstacle-${part.name}`
          matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
          mesh.computeBoundingSphere()
          mesh.receiveShadow = true
          meshes.push(mesh)
        }
      return meshes
    },
    dispose() {
      if (disposed) return
      disposed = true
      release()
    },
  }
}
