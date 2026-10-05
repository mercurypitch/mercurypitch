// Runner opening geometry — copy donor meshes once and retain their local authored detail.
import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export function buildOpeningDonor(source: Object3D, name: string) {
  source.updateWorldMatrix(true, true)
  const prefab = source.getObjectByName(name)
  if (!prefab) throw new Error(`Runner opening donor ${name} is missing.`)
  const inverse = prefab.matrixWorld.clone().invert()
  const groups = new Map<Material, BufferGeometry[]>()
  const result: { geometry: BufferGeometry; material: Material }[] = []
  try {
    prefab.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material))
        throw new Error(`Runner opening donor ${name} has material groups.`)
      const geometry = mesh.geometry.clone()
      const parts = groups.get(mesh.material) ?? []
      parts.push(geometry)
      groups.set(mesh.material, parts)
      // Decoded quantized values must become floats before a metre-space transform.
      for (const name of ['position', 'normal', 'tangent']) {
        const attribute = geometry.getAttribute(name)
        if (
          attribute === undefined ||
          (attribute.array instanceof Float32Array && !attribute.normalized)
        )
          continue
        const values = new Float32Array(attribute.count * attribute.itemSize)
        for (let vertex = 0; vertex < attribute.count; vertex++)
          for (let component = 0; component < attribute.itemSize; component++)
            values[vertex * attribute.itemSize + component] =
              attribute.getComponent(vertex, component)
        geometry.setAttribute(
          name,
          new Float32BufferAttribute(values, attribute.itemSize),
        )
      }
      geometry.applyMatrix4(inverse.clone().multiply(mesh.matrixWorld))
    })
    if (groups.size === 0)
      throw new Error(`Runner opening donor ${name} is empty.`)
    for (const [material, pieces] of groups) {
      const geometry = mergeGeometries(pieces, false)
      if (geometry === null)
        throw new Error(`Runner opening donor ${name} cannot be batched.`)
      geometry.name = `runner-opening-${name}-${material.name}`
      result.push({ geometry, material })
    }
    return result
  } catch (error) {
    result.forEach((part) => part.geometry.dispose())
    throw error
  } finally {
    groups.forEach((parts) => parts.forEach((part) => part.dispose()))
  }
}
