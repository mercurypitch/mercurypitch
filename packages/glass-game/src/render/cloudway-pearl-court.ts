// Pearl court presentation — trim shared-edge overhang without changing contacts or exterior ornament.

import type { BufferAttribute, InterleavedBufferAttribute, Material, Mesh, } from 'three'
import { BufferGeometry, Float32BufferAttribute, Mesh as ThreeMesh, Vector3, } from 'three'
import type { PlatformDefinition } from '../contracts'
import { replacePearlCourtSurface } from './cloudway-pearl-surface'
import { createRigidPlatformBatch } from './rigid-platform-batch'

type Placement = Parameters<typeof createRigidPlatformBatch>[1][number]
type Attribute = BufferAttribute | InterleavedBufferAttribute
type Vertex = Record<string, number[]>

/** Donor-local edges, after the certified presentation fit. */
export const PEARL_COURT_EDGES = {
  negativeX: 1,
  positiveX: 2,
  negativeZ: 4,
  positiveZ: 8,
} as const
const EPSILON = 1e-5

function permanentlyStatic(platform: PlatformDefinition): boolean {
  return (
    platform.behavior === undefined &&
    platform.activation === undefined &&
    platform.unlockAfter === undefined &&
    platform.supportPolygon === undefined &&
    platform.parentPlatformId === undefined
  )
}

export function pearlCourtJoinMask(
  platform: PlatformDefinition,
  platforms: readonly PlatformDefinition[],
  contact: { readonly width: number; readonly depth: number },
): number {
  if (!permanentlyStatic(platform)) return 0
  const angle = ((platform.renderQuarterTurns ?? 0) * Math.PI) / 2
  const cos = Math.cos(angle),
    sin = Math.sin(angle)
  let mask = 0
  for (const other of platforms) {
    if (
      other === platform ||
      !permanentlyStatic(other) ||
      other.renderId !== platform.renderId ||
      (other.renderQuarterTurns ?? 0) !== (platform.renderQuarterTurns ?? 0) ||
      Math.abs(other.top - platform.top) > EPSILON ||
      Math.abs(other.thickness - platform.thickness) > EPSILON ||
      Math.abs(other.maxX - other.minX - (platform.maxX - platform.minX)) >
        EPSILON ||
      Math.abs(other.maxZ - other.minZ - (platform.maxZ - platform.minZ)) >
        EPSILON
    )
      continue
    const dx = (other.minX + other.maxX - platform.minX - platform.maxX) / 2
    const dz = (other.minZ + other.maxZ - platform.minZ - platform.maxZ) / 2
    const x = cos * dx - sin * dz,
      z = sin * dx + cos * dz
    if (
      Math.abs(z) < EPSILON &&
      Math.abs(Math.abs(x) - contact.width) < EPSILON
    )
      mask |= x < 0 ? PEARL_COURT_EDGES.negativeX : PEARL_COURT_EDGES.positiveX
    if (
      Math.abs(x) < EPSILON &&
      Math.abs(Math.abs(z) - contact.depth) < EPSILON
    )
      mask |= z < 0 ? PEARL_COURT_EDGES.negativeZ : PEARL_COURT_EDGES.positiveZ
  }
  return mask
}

function readVertex(
  attributes: readonly [string, Attribute][],
  index: number,
): Vertex {
  return Object.fromEntries(
    attributes.map(([name, attribute]) => [
      name,
      Array.from({ length: attribute.itemSize }, (_, component) =>
        attribute.getComponent(index, component),
      ),
    ]),
  )
}

function interpolate(a: Vertex, b: Vertex, ratio: number): Vertex {
  return Object.fromEntries(
    Object.entries(a).map(([name, values]) => [
      name,
      values.map((value, index) => value + (b[name]![index]! - value) * ratio),
    ]),
  )
}

function clipPolygon(
  polygon: Vertex[],
  signedDistance: (vertex: Vertex) => number,
): Vertex[] {
  const clipped: Vertex[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!,
      b = polygon[(i + 1) % polygon.length]!
    const da = signedDistance(a),
      db = signedDistance(b)
    if (da >= 0) clipped.push(a)
    if (da >= 0 !== db >= 0) clipped.push(interpolate(a, b, da / (da - db)))
  }
  return clipped
}

/** Uncut attributes stay shared; only intersected triangles allocate new vertices. */
export function clipPearlCourtGeometry(
  donor: Mesh,
  mask: number,
  contact: { readonly width: number; readonly depth: number },
): readonly BufferGeometry[] {
  if (mask === 0) return [donor.geometry]
  const attributes = Object.entries(donor.geometry.attributes)
  const position = donor.geometry.getAttribute('position')
  const index = donor.geometry.index
  if (index === null)
    throw new Error('Pearl court donor requires indexed triangles.')
  const point = new Vector3()
  const planes: ((vertex: Vertex) => number)[] = []
  const addPlane = (
    flag: number,
    axis: 'x' | 'z',
    sign: number,
    limit: number,
  ) => {
    if ((mask & flag) === 0) return
    planes.push((vertex) => {
      point.fromArray(vertex.position!).applyMatrix4(donor.matrixWorld)
      return limit - sign * point[axis]
    })
  }
  addPlane(PEARL_COURT_EDGES.negativeX, 'x', -1, contact.width / 2)
  addPlane(PEARL_COURT_EDGES.positiveX, 'x', 1, contact.width / 2)
  addPlane(PEARL_COURT_EDGES.negativeZ, 'z', -1, contact.depth / 2)
  addPlane(PEARL_COURT_EDGES.positiveZ, 'z', 1, contact.depth / 2)
  const retainedIndices: number[] = []
  const cutAttributes = Object.fromEntries(
    attributes.map(([name]) => [name, [] as number[]]),
  )
  for (let offset = 0; offset < index.count; offset += 3) {
    const indices = [
      index.getX(offset),
      index.getX(offset + 1),
      index.getX(offset + 2),
    ]
    const triangle = indices.map((vertex) => ({
      position: [
        position.getX(vertex),
        position.getY(vertex),
        position.getZ(vertex),
      ],
    }))
    if (
      planes.every((plane) => triangle.every((vertex) => plane(vertex) >= 0))
    ) {
      retainedIndices.push(...indices)
      continue
    }
    if (planes.some((plane) => triangle.every((vertex) => plane(vertex) < 0)))
      continue
    let polygon = indices.map((vertex) => readVertex(attributes, vertex))
    for (const plane of planes) polygon = clipPolygon(polygon, plane)
    for (let i = 1; i + 1 < polygon.length; i++)
      for (const vertex of [polygon[0]!, polygon[i]!, polygon[i + 1]!])
        for (const [name] of attributes)
          cutAttributes[name]!.push(...vertex[name]!)
  }
  const result: BufferGeometry[] = []
  if (retainedIndices.length > 0) {
    const geometry = new BufferGeometry()
    for (const [name, attribute] of attributes)
      geometry.setAttribute(name, attribute)
    geometry.setIndex(retainedIndices)
    result.push(geometry)
  }
  if (cutAttributes.position!.length > 0) {
    const geometry = new BufferGeometry()
    for (const [name, attribute] of attributes)
      geometry.setAttribute(
        name,
        new Float32BufferAttribute(cutAttributes[name]!, attribute.itemSize),
      )
    result.push(geometry)
  }
  return result
}

/** One shared pool keeps each observed edge-mask variant to one instanced draw. */
function compactVariants(
  donor: Mesh,
  variants: readonly (readonly BufferGeometry[])[],
): BufferGeometry[] {
  const attributes = Object.entries(donor.geometry.attributes)
  const sourceCount = donor.geometry.getAttribute('position').count
  const cutParts = variants.flatMap((parts) =>
    parts.filter((part) => part.index === null),
  )
  const cuts = new Map<BufferGeometry, number>()
  let count = sourceCount
  for (const part of cutParts) {
    cuts.set(part, count)
    count += part.getAttribute('position').count
  }
  const pool = attributes.map(([name, attribute]) => {
    if (cutParts.length === 0) return [name, attribute] as const
    const values = new Float32Array(count * attribute.itemSize)
    for (let vertex = 0; vertex < sourceCount; vertex++)
      for (let component = 0; component < attribute.itemSize; component++)
        values[vertex * attribute.itemSize + component] =
          attribute.getComponent(vertex, component)
    for (const part of cutParts)
      values.set(
        part.getAttribute(name).array,
        cuts.get(part)! * attribute.itemSize,
      )
    return [
      name,
      new Float32BufferAttribute(values, attribute.itemSize),
    ] as const
  })
  return variants.map((parts) => {
    const geometry = new BufferGeometry()
    for (const [name, attribute] of pool) geometry.setAttribute(name, attribute)
    const indices: number[] = []
    for (const part of parts) {
      if (part.index !== null)
        for (const index of part.index.array) indices.push(index)
      else {
        const offset = cuts.get(part)!
        for (
          let index = 0;
          index < part.getAttribute('position').count;
          index++
        )
          indices.push(offset + index)
      }
    }
    geometry.setIndex(indices)
    return geometry
  })
}

export function createPearlCourtBatches(
  donor: Mesh,
  placements: readonly Placement[],
  contact: { readonly width: number; readonly depth: number },
  surfaceMaterial?: Material,
) {
  const platforms = placements.map((item) => item.platform)
  const groups = new Map<number, Placement[]>()
  for (const item of placements) {
    const mask = pearlCourtJoinMask(item.platform, platforms, contact)
    const group = groups.get(mask) ?? []
    group.push(item)
    groups.set(mask, group)
  }
  if (groups.size === 1 && groups.has(0))
    return [createRigidPlatformBatch(donor, placements)]
  const entries = [...groups]
  const clipped = entries.map(([mask]) =>
    clipPearlCourtGeometry(donor, mask, contact),
  )
  const surfaces = clipped.map((parts, index) =>
    surfaceMaterial === undefined
      ? { shell: parts, surface: null }
      : replacePearlCourtSurface(donor, parts, entries[index]![0], contact),
  )
  const parts = surfaces.map((item) => item.shell)
  const geometries = compactVariants(donor, parts)
  new Set([...clipped.flat(), ...parts.flat()]).forEach((geometry) => {
    if (geometry !== donor.geometry) geometry.dispose()
  })
  const batches: ReturnType<typeof createRigidPlatformBatch>[] = []
  try {
    for (let index = 0; index < entries.length; index++) {
      const [mask, group] = entries[index]!
      const variant = new ThreeMesh(geometries[index]!, donor.material)
      variant.name = mask === 0 ? donor.name : `${donor.name}__court-${mask}`
      variant.matrixWorld.copy(donor.matrixWorld)
      batches.push(createRigidPlatformBatch(variant, group))
      const surface = surfaces[index]!.surface
      if (surface !== null && surfaceMaterial !== undefined) {
        const top = new ThreeMesh(surface, surfaceMaterial)
        top.name = `${donor.name}__court-marble-${mask}`
        top.matrixWorld.copy(donor.matrixWorld)
        batches.push(createRigidPlatformBatch(top, group))
      }
    }
    return batches
  } catch (error) {
    batches.forEach((batch) => batch.mesh.dispose())
    geometries.forEach((geometry) => geometry.dispose())
    surfaces.forEach((item) => item.surface?.dispose())
    throw error
  }
}
