// ============================================================
// Metre-scaled surfaces — one affine scale per connected UV island keeps stretched textures continuous.
// ============================================================

import type { BufferGeometry } from 'three'
import { Vector3 } from 'three'

/** UV1/lightmap atlases and indexed topology remain untouched. Curves use an area-weighted scale. */
export function stretchSurfaceUv(
  source: BufferGeometry,
  stretch: Vector3,
): BufferGeometry {
  const geometry = source.clone()
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  if (!geometry.hasAttribute('uv')) return geometry
  const parent = Array.from({ length: position.count }, (_, i) => i)
  const find = (vertex: number): number => {
    let root = vertex
    while (parent[root] !== root) root = parent[root]
    while (parent[vertex] !== vertex) {
      const next = parent[vertex]
      parent[vertex] = root
      vertex = next
    }
    return root
  }
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }
  const matching = new Map<string, number>()
  // GLTF may duplicate vertices for hard normals/material seams. Identical UVs
  // at identical positions still have to remain identical after rescaling.
  for (let i = 0; i < position.count; i++) {
    const key = [
      position.getX(i),
      position.getY(i),
      position.getZ(i),
      uv.getX(i),
      uv.getY(i),
    ]
      .map((n) => Math.round(n * 1e5))
      .join(',')
    const other = matching.get(key)
    if (other !== undefined) join(i, other)
    else matching.set(key, i)
  }
  const index = geometry.index
  const count = index?.count ?? position.count
  const vertexAt = (i: number) => index?.getX(i) ?? i
  for (let i = 0; i < count; i += 3) {
    join(vertexAt(i), vertexAt(i + 1))
    join(vertexAt(i), vertexAt(i + 2))
  }
  const sums = new Map<number, { u: number; v: number; area: number }>()
  const a = new Vector3(),
    b = new Vector3(),
    origin = new Vector3()
  const tangent = new Vector3(),
    bitangent = new Vector3(),
    temporary = new Vector3()
  for (let i = 0; i < count; i += 3) {
    const x = vertexAt(i),
      y = vertexAt(i + 1),
      z = vertexAt(i + 2)
    origin.fromBufferAttribute(position, x)
    a.fromBufferAttribute(position, y).sub(origin)
    b.fromBufferAttribute(position, z).sub(origin)
    const u1 = uv.getX(y) - uv.getX(x),
      u2 = uv.getX(z) - uv.getX(x)
    const v1 = uv.getY(y) - uv.getY(x),
      v2 = uv.getY(z) - uv.getY(x)
    const determinant = u1 * v2 - u2 * v1
    if (Math.abs(determinant) < 1e-10) continue
    tangent
      .copy(a)
      .multiplyScalar(v2)
      .addScaledVector(b, -v1)
      .divideScalar(determinant)
    bitangent
      .copy(b)
      .multiplyScalar(u1)
      .addScaledVector(a, -u2)
      .divideScalar(determinant)
    const area = temporary.crossVectors(a, b).length()
    if (
      area < 1e-10 ||
      tangent.lengthSq() < 1e-10 ||
      bitangent.lengthSq() < 1e-10
    )
      continue
    const scaleU =
      temporary.copy(tangent).multiply(stretch).length() / tangent.length()
    const scaleV =
      temporary.copy(bitangent).multiply(stretch).length() / bitangent.length()
    const id = find(x),
      sum = sums.get(id) ?? { u: 0, v: 0, area: 0 }
    sum.u += scaleU * area
    sum.v += scaleV * area
    sum.area += area
    sums.set(id, sum)
  }
  for (let i = 0; i < position.count; i++) {
    const sum = sums.get(find(i))
    if (sum)
      uv.setXY(
        i,
        (uv.getX(i) * sum.u) / sum.area,
        (uv.getY(i) * sum.v) / sum.area,
      )
  }
  return geometry
}
