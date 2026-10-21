// Cliff detail — interrupt First Light's broad limestone bedding beneath its planted rim.

import type { BufferGeometry } from 'three'
import { Float32BufferAttribute, Matrix3, Vector3 } from 'three'

function ramp(start: number, end: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

function pocket(center: number, radius: number, value: number): number {
  return 1 - ramp(0, radius, Math.abs(value - center))
}

// Rounded roots and shoulders retain the donor's thin faces while the
// unequal walls read as clefts rather than smooth circular dents.
function fracture(
  center: number,
  left: number,
  right: number,
  value: number,
): number {
  const offset = value - center
  const width = offset < 0 ? left : right
  const core = 0.07
  const shoulder = 0.11
  const distance = Math.abs(offset)
  const length = width - (core + shoulder) / 2
  if (distance >= width) return 0
  if (distance < core) return 1 - (distance * distance) / (2 * core * length)
  if (distance > width - shoulder)
    return (width - distance) ** 2 / (2 * shoulder * length)
  return (width - shoulder / 2 - distance) / length
}

function sculpt(x: number, y: number, z: number, result: Vector3): Vector3 {
  const depth = -y
  const band = ramp(0.28, 0.86, depth) * (1 - ramp(1.8, 2.05, depth))
  const face = ramp(-0.08, 0.64, z) * (1 - ramp(1.9, 2.35, Math.abs(x)))
  const weight = band * face
  if (weight === 0) return result.set(x, y, z)
  const bedding =
    0.16 * pocket(-1.22, 0.72, x) * pocket(0.82, 0.64, depth) -
    0.115 * pocket(0.05, 0.68, x) * pocket(1.14, 0.76, depth) +
    0.09 * pocket(1.15, 0.62, x) * pocket(0.72, 0.55, depth)
  // Carry cuts across the beds, tapering only at the planted rim and tip.
  const recess =
    0.38 * fracture(-0.98 + depth * 0.16, 0.58, 0.44, x) +
    0.18 * fracture(0.26 - depth * 0.07, 0.58, 0.38, x) +
    0.34 * fracture(1.48 - depth * 0.21, 0.55, 0.36, x)
  return result.set(x, y + bedding * weight, z - recess * weight)
}

/**
 * Own the derivative: donors shared by the other islands stay byte-for-byte
 * intact. Keep their topology and UVs, and transport the smooth donor normals
 * through the deformation instead of splitting them at duplicated UV seams.
 */
export function createFirstLightCliffDetail(
  source: BufferGeometry,
): BufferGeometry {
  const positions = source.getAttribute('position')
  const normals = source.getAttribute('normal')
  if (
    positions === undefined ||
    normals === undefined ||
    positions.count !== normals.count
  )
    throw new Error(
      'First Light cliff detail requires matched positions and normals.',
    )
  const geometry = source.clone()
  const nextPositions = new Float32Array(positions.count * 3)
  const nextNormals = new Float32Array(normals.count * 3)
  const point = new Vector3()
  const plus = new Vector3()
  const minus = new Vector3()
  const normal = new Vector3()
  const dx = new Vector3()
  const dy = new Vector3()
  const dz = new Vector3()
  const normalMatrix = new Matrix3()
  const step = 0.0001
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    sculpt(x, y, z, point).toArray(nextPositions, i * 3)
    normal.fromBufferAttribute(normals, i)
    if (point.x !== x || point.y !== y || point.z !== z) {
      dx.subVectors(
        sculpt(x + step, y, z, plus),
        sculpt(x - step, y, z, minus),
      ).multiplyScalar(0.5 / step)
      dy.subVectors(
        sculpt(x, y + step, z, plus),
        sculpt(x, y - step, z, minus),
      ).multiplyScalar(0.5 / step)
      dz.subVectors(
        sculpt(x, y, z + step, plus),
        sculpt(x, y, z - step, minus),
      ).multiplyScalar(0.5 / step)
      normalMatrix
        .set(dx.x, dy.x, dz.x, dx.y, dy.y, dz.y, dx.z, dy.z, dz.z)
        .invert()
        .transpose()
      normal.applyMatrix3(normalMatrix).normalize()
    }
    normal.toArray(nextNormals, i * 3)
  }
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(nextPositions, 3),
  )
  geometry.setAttribute('normal', new Float32BufferAttribute(nextNormals, 3))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.userData.firstLightCliffDetail = true
  return geometry
}
