// Pearl court surfaces — replace joined donors' inboard ornament with a continuous marble walking surface.

import type { BufferAttribute, InterleavedBufferAttribute, Mesh } from 'three'
import { BufferGeometry, Float32BufferAttribute, Matrix3, Vector3 } from 'three'

type Attribute = BufferAttribute | InterleavedBufferAttribute
type Vertex = { values: Record<string, number[]>; point: Vector3 }
type Plane = { axis: 'x' | 'y' | 'z'; sign: number; limit: number }
type Contact = { readonly width: number; readonly depth: number }

const CUT_HEIGHT = -0.02
const EXPOSED_RIM = 0.02

function distance(vertex: Vertex, plane: Plane): number {
  return plane.sign * vertex.point[plane.axis] - plane.limit
}

function interpolate(a: Vertex, b: Vertex, ratio: number): Vertex {
  return {
    point: a.point.clone().lerp(b.point, ratio),
    values: Object.fromEntries(
      Object.entries(a.values).map(([name, values]) => [
        name,
        values.map(
          (value, index) => value + (b.values[name]![index]! - value) * ratio,
        ),
      ]),
    ),
  }
}

function clip(
  polygon: readonly Vertex[],
  plane: Plane,
  inside: boolean,
): Vertex[] {
  const output: Vertex[] = []
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index]!,
      b = polygon[(index + 1) % polygon.length]!
    const da = distance(a, plane),
      db = distance(b, plane)
    const keepA = inside ? da >= 0 : da <= 0
    const keepB = inside ? db >= 0 : db <= 0
    if (keepA) output.push(a)
    if (keepA !== keepB) output.push(interpolate(a, b, da / (da - db)))
  }
  return output
}

function bounds(mask: number, contact: Contact) {
  return {
    minX: -contact.width / 2,
    maxX: contact.width / 2,
    minZ: -contact.depth / 2 + ((mask & 4) === 0 ? EXPOSED_RIM : 0),
    maxZ: contact.depth / 2 - ((mask & 8) === 0 ? EXPOSED_RIM : 0),
  }
}

function removeTop(
  donor: Mesh,
  geometry: BufferGeometry,
  planes: readonly Plane[],
): BufferGeometry[] {
  const attributes = Object.entries(geometry.attributes) as [
    string,
    Attribute,
  ][]
  const position = geometry.getAttribute('position')
  const indices = geometry.index
  const vertexCount = position.count
  const points = Array.from({ length: vertexCount }, (_, index) =>
    new Vector3()
      .fromBufferAttribute(position, index)
      .applyMatrix4(donor.matrixWorld),
  )
  const retained: number[] = []
  const cuts = Object.fromEntries(
    attributes.map(([name]) => [name, [] as number[]]),
  )
  const read = (index: number): Vertex => ({
    point: points[index]!,
    values: Object.fromEntries(
      attributes.map(([name, attribute]) => [
        name,
        Array.from({ length: attribute.itemSize }, (_, component) =>
          attribute.getComponent(index, component),
        ),
      ]),
    ),
  })
  const append = (polygon: readonly Vertex[]) => {
    for (let index = 1; index + 1 < polygon.length; index++) {
      const triangle = [polygon[0]!, polygon[index]!, polygon[index + 1]!]
      if (
        triangle[1]!.point
          .clone()
          .sub(triangle[0]!.point)
          .cross(triangle[2]!.point.clone().sub(triangle[0]!.point))
          .lengthSq() < 1e-18
      )
        continue
      for (const vertex of triangle)
        for (const [name] of attributes)
          cuts[name]!.push(...vertex.values[name]!)
    }
  }
  for (let offset = 0; offset < (indices?.count ?? vertexCount); offset += 3) {
    const triangle = [0, 1, 2].map(
      (corner) => indices?.getX(offset + corner) ?? offset + corner,
    )
    if (
      planes.some((plane) =>
        triangle.every(
          (index) => plane.sign * points[index]![plane.axis] - plane.limit <= 0,
        ),
      )
    ) {
      if (indices !== null) retained.push(...triangle)
      else append(triangle.map(read))
      continue
    }
    if (
      planes.every((plane) =>
        triangle.every(
          (index) => plane.sign * points[index]![plane.axis] - plane.limit >= 0,
        ),
      )
    )
      continue
    let remainder = triangle.map(read)
    // Each outside fragment leaves the remainder exactly once: no overlapping
    // union faces when a triangle crosses two corners or the height boundary.
    for (const plane of planes) {
      append(clip(remainder, plane, false))
      remainder = clip(remainder, plane, true)
      if (remainder.length < 3) break
    }
  }
  const result: BufferGeometry[] = []
  if (retained.length > 0) {
    const retainedGeometry = new BufferGeometry()
    for (const [name, attribute] of attributes)
      retainedGeometry.setAttribute(name, attribute)
    retainedGeometry.setIndex(retained)
    result.push(retainedGeometry)
  }
  if (cuts.position!.length > 0) {
    const cutGeometry = new BufferGeometry()
    for (const [name, attribute] of attributes)
      cutGeometry.setAttribute(
        name,
        new Float32BufferAttribute(cuts[name]!, attribute.itemSize),
      )
    result.push(cutGeometry)
  }
  return result
}

function marbleSurface(
  donor: Mesh,
  mask: number,
  contact: Contact,
): BufferGeometry {
  const { minX, maxX, minZ, maxZ } = bounds(mask, contact)
  const corners = [
    new Vector3(minX, 0, minZ),
    new Vector3(minX, 0, maxZ),
    new Vector3(maxX, 0, maxZ),
    new Vector3(maxX, 0, minZ),
  ]
  const inverse = donor.matrixWorld.clone().invert()
  const normalMatrix = new Matrix3()
    .setFromMatrix4(donor.matrixWorld)
    .transpose()
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = []
  const append = (a: Vector3, b: Vector3, c: Vector3, normal: Vector3) => {
    const localNormal = normal.clone().applyMatrix3(normalMatrix).normalize()
    for (const point of [a, b, c]) {
      positions.push(...point.clone().applyMatrix4(inverse).toArray())
      normals.push(...localNormal.toArray())
      uvs.push(point.x, point.z)
    }
  }
  append(corners[0]!, corners[1]!, corners[2]!, new Vector3(0, 1, 0))
  append(corners[0]!, corners[2]!, corners[3]!, new Vector3(0, 1, 0))
  for (let index = 0; index < 4; index++) {
    const a = corners[index]!,
      b = corners[(index + 1) % 4]!
    const lowA = a.clone().setY(CUT_HEIGHT),
      lowB = b.clone().setY(CUT_HEIGHT)
    const normal = new Vector3(0, -1, 0)
      .cross(new Vector3().subVectors(b, a))
      .normalize()
    append(a, lowA, b, normal)
    append(b, lowA, lowB, normal)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  return geometry
}

/** Already edge-clipped shell parts retain their original attribute ownership. */
export function replacePearlCourtSurface(
  donor: Mesh,
  parts: readonly BufferGeometry[],
  mask: number,
  contact: Contact,
): {
  readonly shell: readonly BufferGeometry[]
  readonly surface: BufferGeometry | null
} {
  if (mask === 0) return { shell: parts, surface: null }
  const { minX, maxX, minZ, maxZ } = bounds(mask, contact)
  const planes: Plane[] = [
    { axis: 'y', sign: 1, limit: CUT_HEIGHT },
    { axis: 'x', sign: 1, limit: minX },
    { axis: 'x', sign: -1, limit: -maxX },
    { axis: 'z', sign: 1, limit: minZ },
    { axis: 'z', sign: -1, limit: -maxZ },
  ]
  return {
    shell: parts.flatMap((part) => removeTop(donor, part, planes)),
    surface: marbleSurface(donor, mask, contact),
  }
}
