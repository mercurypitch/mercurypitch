// ============================================================
// Exhibit baking — retain every material slot, UV channel and tangent through matched fracture.
// ============================================================

import type { BufferGeometry, Material, Matrix4, Mesh, Object3D } from 'three'
import { Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { MaterialLibrary } from './material-library'

export function createMaterialTable(library: MaterialLibrary) {
  const materials: Material[] = []
  return {
    materials,
    index(source: Material) {
      const material = library.clone(source)
      let index = materials.indexOf(material)
      if (index === -1) index = materials.push(material) - 1
      return index
    },
  }
}

export function flattenGeometry(
  object: Object3D,
  transform: Matrix4,
  table: ReturnType<typeof createMaterialTable>,
): BufferGeometry {
  const sources: BufferGeometry[] = []
  const groups: { start: number; count: number; materialIndex: number }[] = []
  const attributes = new Map<string, number>()
  let offset = 0
  try {
    object.updateWorldMatrix(true, true)
    object.traverse((node) => {
      const mesh = node as Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry.clone()
      sources.push(geometry)
      // glTF already splits UV/normal seams. Keep its index rather than expanding
      // all triangle corners (including the hidden fracture alternative).
      if (!geometry.index)
        geometry.setIndex(
          Array.from(
            { length: geometry.getAttribute('position').count },
            (_, i) => i,
          ),
        )
      geometry.applyMatrix4(mesh.matrixWorld).applyMatrix4(transform)
      if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals()
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const previous = attributes.get(name)
        if (previous !== undefined && previous !== attribute.itemSize)
          throw new Error(`Incompatible ${name} attributes in ${object.name}`)
        attributes.set(name, attribute.itemSize)
      }
      const count = geometry.index!.count
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      const sourceGroups = geometry.groups.length
        ? geometry.groups
        : [{ start: 0, count, materialIndex: 0 }]
      for (const group of sourceGroups) {
        const source =
          materials[
            Array.isArray(mesh.material) ? (group.materialIndex ?? 0) : 0
          ]
        if (source === undefined)
          throw new Error(`Missing material binding in ${object.name}`)
        groups.push({
          start: offset + group.start,
          count: group.count,
          materialIndex: table.index(source),
        })
      }
      geometry.clearGroups()
      offset += count
    })
    // Different primitives may legitimately have different UV sets or vertex colors.
    // Extend their union with neutral values; never erase authored channels to merge.
    for (const geometry of sources) {
      const count = geometry.getAttribute('position').count
      for (const [name, size] of attributes) {
        const source = geometry.getAttribute(name)
        if (
          geometry.hasAttribute(name) &&
          source.array instanceof Float32Array &&
          !source.normalized &&
          !('isInterleavedBufferAttribute' in source)
        )
          continue
        const data = new Float32Array(count * size)
        for (let vertex = 0; vertex < count; vertex++)
          for (let component = 0; component < size; component++)
            data[vertex * size + component] = geometry.hasAttribute(name)
              ? source.getComponent(vertex, component)
              : name === 'color' ||
                  (name === 'tangent' && (component === 0 || component === 3))
                ? 1
                : 0
        geometry.setAttribute(name, new Float32BufferAttribute(data, size))
      }
    }
    const geometry = mergeGeometries(sources, false)
    if (geometry === null)
      throw new Error(`Museum asset has no mergeable geometry: ${object.name}`)
    for (const group of groups)
      geometry.addGroup(group.start, group.count, group.materialIndex)
    return geometry
  } finally {
    sources.forEach((source) => source.dispose())
  }
}
