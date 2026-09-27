// Rigid platform batches — shared donor draws follow the same contact transforms as simulation.

import type { Mesh } from 'three'
import { Box3, DynamicDrawUsage, InstancedMesh, Matrix4, Vector3 } from 'three'
import type { PlatformDefinition, PlatformRuntimeSnapshot } from '../contracts'

export interface RigidPlatformBatch {
  readonly mesh: InstancedMesh
  readonly instances: readonly {
    readonly matrix: Matrix4
    readonly bounds: Box3
    readonly platform: PlatformDefinition
  }[]
  readonly selectedIndices: Int32Array
  readonly selectedOffsets: Float64Array
  selectedCount: number
}

export function createRigidPlatformBatch(
  donor: Mesh,
  placements: readonly { placement: Matrix4; platform: PlatformDefinition }[],
): RigidPlatformBatch {
  const mesh = new InstancedMesh(
    donor.geometry,
    donor.material,
    placements.length,
  )
  mesh.name = `${donor.name || 'mesh'}__platform-instances`
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  mesh.userData.excludeFromCameraCollision = true
  mesh.castShadow = false
  mesh.receiveShadow = true
  donor.geometry.computeBoundingBox()
  const instances = placements.map(({ placement, platform }, index) => {
    const matrix = placement.clone().multiply(donor.matrixWorld)
    mesh.setMatrixAt(index, matrix)
    return {
      matrix,
      platform,
      bounds: donor.geometry.boundingBox!.clone().applyMatrix4(matrix),
    }
  })
  mesh.computeBoundingBox()
  mesh.computeBoundingSphere()
  mesh.count = 0
  return {
    mesh,
    instances,
    selectedIndices: new Int32Array(instances.length).fill(-1),
    selectedOffsets: new Float64Array(instances.length * 3),
    selectedCount: -1,
  }
}

const motionMatrix = new Matrix4()
const placedMatrix = new Matrix4()
const visibleBounds = new Box3()
const motionOffset = new Vector3()

/** No elapsed-time animation here: paused/voice snapshots freeze the art exactly. */
export function updateRigidPlatformBatch(
  batch: RigidPlatformBatch,
  committed: boolean,
  active: ReadonlySet<string>,
  runtimeById: ReadonlyMap<string, PlatformRuntimeSnapshot>,
  includes?: (bounds: Box3) => boolean,
): boolean {
  let count = 0
  let changed = false
  if (committed) {
    for (let index = 0; index < batch.instances.length; index++) {
      const instance = batch.instances[index]!
      if (!active.has(instance.platform.id)) continue
      const offset = runtimeById.get(instance.platform.id)?.offset
      motionOffset.set(offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0)
      if (
        includes !== undefined &&
        !includes(visibleBounds.copy(instance.bounds).translate(motionOffset))
      )
        continue
      const slot = count * 3
      if (
        batch.selectedIndices[count] !== index ||
        batch.selectedOffsets[slot] !== motionOffset.x ||
        batch.selectedOffsets[slot + 1] !== motionOffset.y ||
        batch.selectedOffsets[slot + 2] !== motionOffset.z
      ) {
        batch.selectedIndices[count] = index
        batch.selectedOffsets[slot] = motionOffset.x
        batch.selectedOffsets[slot + 1] = motionOffset.y
        batch.selectedOffsets[slot + 2] = motionOffset.z
        motionMatrix.makeTranslation(
          motionOffset.x,
          motionOffset.y,
          motionOffset.z,
        )
        placedMatrix.multiplyMatrices(motionMatrix, instance.matrix)
        batch.mesh.setMatrixAt(count, placedMatrix)
        changed = true
      }
      count++
    }
  }
  if (batch.selectedCount !== count) changed = true
  if (!changed) return false
  batch.selectedCount = count
  batch.mesh.count = count
  batch.mesh.instanceMatrix.needsUpdate = true
  batch.mesh.computeBoundingBox()
  batch.mesh.computeBoundingSphere()
  return true
}
