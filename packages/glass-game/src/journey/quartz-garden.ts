// Quartz gardens — grounded, unequal hexagonal spears for the First Light terrace.

import type { Material } from 'three'
import { BufferGeometry, Color, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, } from 'three'

/** Flat facets and an offset termination keep the silhouette mineral, not gem-cut. */
export function createGardenQuartzGeometry(): BufferGeometry {
  const points: Vector3[] = []
  const shoulder: Vector3[] = []
  const corners = Array.from({ length: 6 }, (_, side) => {
    const angle = (side * Math.PI) / 3
    const radius = side % 2 === 0 ? 0.155 : 0.145
    return new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  })
  for (let side = 0; side < 6; side++) {
    const corner = corners[side]!
    for (const neighbor of [
      corners[(side + 5) % 6]!,
      corners[(side + 1) % 6]!,
    ]) {
      const edge = corner.clone().lerp(neighbor, 0.075)
      points.push(new Vector3(edge.x, -0.045, edge.z))
      shoulder.push(new Vector3(edge.x, 0.69 + (side % 3) * 0.045, edge.z))
    }
  }
  const apex = new Vector3(0.028, 1, -0.035)
  const base = new Vector3(0, -0.045, 0)
  const positions: number[] = []
  const colors: number[] = []
  const facets = [
    '#eefbff',
    '#91d5eb',
    '#f7f1ff',
    '#b4a3da',
    '#a1dece',
    '#fff5df',
  ].map((hex) => new Color(hex))
  let facet = facets[0]!
  const triangle = (a: Vector3, b: Vector3, c: Vector3): void => {
    positions.push(...a.toArray(), ...b.toArray(), ...c.toArray())
    for (let vertex = 0; vertex < 3; vertex++)
      colors.push(facet.r, facet.g, facet.b)
  }
  for (let side = 0; side < points.length; side++) {
    const next = (side + 1) % points.length
    facet = side % 2 === 0 ? new Color(0xffffff) : facets[Math.floor(side / 2)]!
    triangle(points[side]!, shoulder[side]!, points[next]!)
    triangle(points[next]!, shoulder[side]!, shoulder[next]!)
    triangle(shoulder[side]!, apex, shoulder[next]!)
    triangle(base, points[side]!, points[next]!)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const SPEARS = [
  // x, z, height, width, outward lean, yaw, reflected mineral tint
  [0.005, -0.045, 0.76, 0.86, 0.035, 0.2, '#dbf6fa'],
  [-0.135, 0.015, 0.54, 0.68, -0.18, 0.8, '#e0d1f7'],
  [0.155, 0.035, 0.46, 0.62, 0.2, 1.45, '#dcf8ec'],
  [-0.07, 0.145, 0.29, 0.61, -0.12, 2.1, '#f3dff5'],
  [0.14, -0.125, 0.31, 0.52, 0.12, 2.9, '#f0f7ff'],
] as const

/** One resident-material draw, with the buried bases attached to the supplied surface. */
export function createGardenQuartzCluster(
  geometry: BufferGeometry,
  material: Material,
  position: readonly [number, number, number],
  scale = 1,
): InstancedMesh {
  const cluster = new InstancedMesh(geometry, material, SPEARS.length)
  cluster.name = 'museum-crystal-cluster'
  cluster.userData.groundedQuartz = true
  cluster.userData.surfaceY = position[1]
  const matrix = new Matrix4()
  for (const [
    index,
    [x, z, height, width, lean, yaw, tint],
  ] of SPEARS.entries()) {
    matrix.compose(
      new Vector3(
        position[0] + x * scale,
        position[1],
        position[2] + z * scale,
      ),
      new Quaternion().setFromEuler(new Euler(0, yaw, lean)),
      new Vector3(width * scale, height * scale, width * scale),
    )
    cluster.setMatrixAt(index, matrix)
    cluster.setColorAt(index, new Color(tint))
  }
  cluster.instanceMatrix.needsUpdate = true
  if (cluster.instanceColor !== null) cluster.instanceColor.needsUpdate = true
  cluster.castShadow = true
  cluster.receiveShadow = true
  return cluster
}
