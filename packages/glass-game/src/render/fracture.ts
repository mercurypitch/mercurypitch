// ============================================================
// Matched fracture — partition an intact surface without inventing debris geometry.
// ============================================================

import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three'

export interface FracturePiece {
  geometry: BufferGeometry
  centre: Vector3
}

/** Keeps every original triangle, UV and material group exactly once. */
export function fractureGeometry(
  source: BufferGeometry,
  budget = 18,
): FracturePiece[] {
  const geometry = source.index ? source.toNonIndexed() : source.clone()
  const positions = geometry.getAttribute('position')
  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox ?? new Box3()
  const size = bounds.getSize(new Vector3())
  const count = Math.max(1, Math.min(24, Math.floor(budget)))
  const seeds = Array.from({ length: count }, (_, i) => {
    const angle = i * 2.3999632297
    const v = (i + 0.5) / count
    return new Vector3(
      bounds.min.x + size.x * (0.5 + Math.cos(angle) * 0.39),
      bounds.min.y + size.y * v,
      bounds.min.z + size.z * (0.5 + Math.sin(angle) * 0.39),
    )
  })
  const chunks: number[][] = seeds.map(() => [])
  const centre = new Vector3()
  const vertex = new Vector3()
  for (let offset = 0; offset < positions.count; offset += 3) {
    centre.set(0, 0, 0)
    for (let j = 0; j < 3; j++)
      centre.add(vertex.fromBufferAttribute(positions, offset + j))
    centre.multiplyScalar(1 / 3)
    let closest = 0
    let distance = Infinity
    seeds.forEach((seed, i) => {
      const candidate = centre.distanceToSquared(seed)
      if (candidate < distance) {
        distance = candidate
        closest = i
      }
    })
    chunks[closest].push(offset)
  }
  const result = chunks
    .filter((chunk) => chunk.length)
    .map((triangles) => {
      const piece = new BufferGeometry()
      const materialIndices = triangles.map(
        (offset) =>
          geometry.groups.find(
            (group) =>
              offset >= group.start && offset < group.start + group.count,
          )?.materialIndex ?? 0,
      )
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const values: number[] = []
        for (const offset of triangles) {
          for (let j = 0; j < 3; j++) {
            for (let k = 0; k < attribute.itemSize; k++)
              values.push(attribute.getComponent(offset + j, k))
          }
        }
        piece.setAttribute(
          name,
          new Float32BufferAttribute(values, attribute.itemSize),
        )
      }
      materialIndices.forEach((material, i) =>
        piece.addGroup(i * 3, 3, material),
      )
      // Adjacent equal groups can be rendered in one draw, even on textured slabs.
      piece.groups = piece.groups.reduce<typeof piece.groups>(
        (groups, group) => {
          const last = groups.at(-1)
          if (last && last.materialIndex === group.materialIndex)
            last.count += group.count
          else groups.push({ ...group })
          return groups
        },
        [],
      )
      piece.computeBoundingBox()
      const pivot = piece.boundingBox!.getCenter(new Vector3())
      piece.translate(-pivot.x, -pivot.y, -pivot.z)
      piece.computeBoundingSphere()
      return { geometry: piece, centre: pivot }
    })
  geometry.dispose()
  return result
}
