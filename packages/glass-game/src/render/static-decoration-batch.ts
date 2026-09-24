// Static decoration batches — share opaque repeated props inside one room without changing activation or placement.

import type { Group, Mesh, MeshPhysicalMaterial, Object3D } from 'three'
import { DynamicDrawUsage, InstancedMesh, Matrix4 } from 'three'

/** The caller owns template geometry/materials; this owner releases instance buffers. */
export function createStaticDecorationBatch(
  template: Group,
  members: readonly Group[],
  owner: Group,
) {
  const parts: Mesh[] = []
  let compatible = true
  template.updateWorldMatrix(true, true)
  template.traverse((object: Object3D) => {
    if (!object.visible) compatible = false
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    if (
      (mesh as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh === true ||
      mesh.morphTargetInfluences !== undefined ||
      materials.some(
        (material) =>
          material.transparent ||
          (material as MeshPhysicalMaterial).transmission > 0,
      )
    )
      compatible = false
    parts.push(mesh)
  })
  if (!compatible || parts.length === 0) return undefined

  const batches = parts.map((part) => {
    const mesh = new InstancedMesh(part.geometry, part.material, members.length)
    mesh.name = `${owner.name}-${part.name}`
    mesh.castShadow = part.castShadow
    mesh.receiveShadow = part.receiveShadow
    mesh.renderOrder = part.renderOrder
    mesh.layers.mask = part.layers.mask
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    owner.add(mesh)
    return { mesh, local: part.matrixWorld.clone() }
  })
  const matrix = new Matrix4()
  let visibility = ''

  function update(): void {
    const next = members.map((member) => (member.visible ? '1' : '0')).join('')
    if (next === visibility) return
    visibility = next
    for (const batch of batches) {
      let count = 0
      for (const member of members) {
        if (!member.visible) continue
        member.updateMatrix()
        matrix.multiplyMatrices(member.matrix, batch.local)
        batch.mesh.setMatrixAt(count++, matrix)
      }
      batch.mesh.count = count
      batch.mesh.instanceMatrix.needsUpdate = true
      batch.mesh.computeBoundingBox()
      batch.mesh.computeBoundingSphere()
    }
    owner.visible = batches[0]!.mesh.count > 0
  }
  update()
  return {
    update,
    dispose() {
      batches.forEach(({ mesh }) => mesh.dispose())
    },
  }
}
