// Journey ivy — bent lobed leaves attached to sparse, continuous rim-rooted stems.

import type { Material } from 'three'
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Quaternion, Vector3, } from 'three'
import type { MuseumJourneyDefinition } from '../content/museum-journey'
import { clearsJourneyLandmarks, rimPoint } from './vegetation-placement'

// Petiole at the origin, pointed blade below it. The raised midrib and turned
// tip give the leaf volume without turning it into a solid hanging bead.
const LEAF_OUTLINE = [
  [0, 0, 0],
  [-0.06, 0.012, -0.005],
  [-0.074, -0.04, 0],
  [-0.12, -0.068, 0.004],
  [-0.062, -0.098, 0.009],
  [-0.055, -0.162, 0.017],
  [0, -0.25, 0.045],
  [0.055, -0.162, 0.017],
  [0.062, -0.098, 0.009],
  [0.12, -0.068, 0.004],
  [0.074, -0.04, 0],
  [0.06, 0.012, -0.005],
] as const
const UP = new Vector3(0, 1, 0)
const FORWARD = new Vector3(0, 0, 1)
const RIGHT = new Vector3(1, 0, 0)

export interface JourneyIvyLeaf {
  stemNode: number
  transform: Matrix4
  dark: boolean
}

export interface JourneyIvyStrand {
  islandId: string
  points: Vector3[]
  leaves: JourneyIvyLeaf[]
}

export function createJourneyIvyLeafGeometry(): BufferGeometry {
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  // A curved inner contour breaks up the broad fan facets. Vertex tones follow
  // the raised blade, leaving the borrowed material's lighting fully dynamic.
  // Separate back vertices keep opposing normals without double-sided materials.
  for (let side = 0; side < 2; side++) {
    const offset = positions.length / 3
    positions.push(0, -0.085, 0.046)
    colors.push(0.94, 1, 0.8)
    for (const point of LEAF_OUTLINE) {
      positions.push(...point)
      colors.push(0.66, 0.75, 0.57)
    }
    for (const point of LEAF_OUTLINE) {
      positions.push(
        point[0] * 0.55,
        -0.085 + (point[1] + 0.085) * 0.62,
        point[2] * 0.55 + 0.029,
      )
      colors.push(0.85, 0.94, 0.71)
    }
    const face = (a: number, b: number, c: number): void => {
      indices.push(...(side === 0 ? [a, b, c] : [a, c, b]))
    }
    for (let index = 0; index < LEAF_OUTLINE.length; index++) {
      const next = (index + 1) % LEAF_OUTLINE.length
      const outer = offset + index + 1
      const outerNext = offset + next + 1
      const inner = outer + LEAF_OUTLINE.length
      const innerNext = outerNext + LEAF_OUTLINE.length
      face(offset, inner, innerNext)
      face(inner, outer, outerNext)
      face(inner, outerNext, innerNext)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function clearsIvyArea(
  definition: MuseumJourneyDefinition,
  point: Vector3,
  radius: number,
): boolean {
  if (!clearsJourneyLandmarks(definition, point, radius)) return false
  return definition.spillways.every((spillway) => {
    const dx = point.x - spillway.position[0]
    const dz = point.z - spillway.position[2]
    const across = Math.cos(spillway.yaw) * dx - Math.sin(spillway.yaw) * dz
    const depth = Math.sin(spillway.yaw) * dx + Math.cos(spillway.yaw) * dz
    // Include the curved sheet and animated lip, not only its source pond.
    return (
      Math.abs(across) > spillway.width / 2 + radius + 0.05 ||
      Math.abs(depth) > 0.18 + radius
    )
  })
}

export function createJourneyIvyPlacement(
  definition: MuseumJourneyDefinition,
): JourneyIvyStrand[] {
  const strands: JourneyIvyStrand[] = []
  definition.landmasses.forEach((island, islandIndex) => {
    for (let strand = 0; strand < 8; strand++) {
      const angle = Math.PI * (0.04 + strand * 0.13) + islandIndex * 0.19
      const top = rimPoint(island, angle, 1.02)
      if (!clearsIvyArea(definition, top, 0.018)) continue
      const outward = new Vector3(
        top.x - island.position[0],
        0,
        top.z - island.position[2],
      ).normalize()
      const tangent = new Vector3(outward.z, 0, -outward.x)
      const seed = strand + islandIndex * 7
      const segments = 7 + (seed % 4)
      const length = 0.9 + (seed % 5) * 0.14
      const points = [top]
      for (let step = 1; step <= segments; step++) {
        const t = step / segments
        const point = top
          .clone()
          .addScaledVector(tangent, Math.sin(t * 4.2 + seed) * 0.045 * t)
          .addScaledVector(outward, Math.sin(t * Math.PI) * 0.025 + t * 0.012)
        point.y -= length * t
        if (!clearsIvyArea(definition, point, 0.018)) break
        points.push(point)
      }
      const leaves: JourneyIvyLeaf[] = []
      for (let node = 1; node < points.length - 1; node++) {
        const side = (node + seed) % 2 === 0 ? 1 : -1
        const scale =
          (0.76 + ((node * 3 + seed) % 4) * 0.1) *
          (node > segments - 3 ? 0.78 : 1)
        const origin = points[node]!.clone()
          .addScaledVector(tangent, side * (0.04 + (node % 3) * 0.008))
          .addScaledVector(outward, 0.025)
        const rotation = new Quaternion().setFromAxisAngle(
          UP,
          Math.atan2(outward.x, outward.z) + Math.sin(seed + node * 1.7) * 0.35,
        )
        rotation.multiply(
          new Quaternion().setFromAxisAngle(
            FORWARD,
            side * (0.48 + (node % 3) * 0.1),
          ),
        )
        rotation.multiply(
          new Quaternion().setFromAxisAngle(
            RIGHT,
            Math.sin(node + seed) * 0.22,
          ),
        )
        const transform = new Matrix4().compose(
          origin,
          rotation,
          new Vector3(scale, scale, scale),
        )
        const center = new Vector3(0, -0.115, 0.02).applyMatrix4(transform)
        if (!clearsIvyArea(definition, center, 0.18 * scale)) continue
        leaves.push({
          stemNode: node,
          transform,
          dark: (node + seed) % 3 === 0,
        })
      }
      // A heavily clipped candidate would read as another dangling bead.
      if (leaves.length >= 3)
        strands.push({ islandId: island.id, points, leaves })
    }
  })
  return strands
}

export function createJourneyIvy(
  definition: MuseumJourneyDefinition,
  materials: { foliage: Material; darkFoliage: Material },
  ownedGeometries: Set<BufferGeometry>,
): Group {
  const strands = createJourneyIvyPlacement(definition)
  const leaves = strands.flatMap((strand) => strand.leaves)
  const leafGeometry = createJourneyIvyLeafGeometry()
  const stemGeometry = new CylinderGeometry(0.004, 0.006, 1, 5, 1, true)
  // The shared ivy material reads vertex colors for the blades. Supply an
  // explicit white multiplier for stems rather than relying on GL defaults.
  stemGeometry.setAttribute(
    'color',
    new Float32BufferAttribute(
      new Float32Array(stemGeometry.getAttribute('position').count * 3).fill(1),
      3,
    ),
  )
  ownedGeometries.add(leafGeometry)
  ownedGeometries.add(stemGeometry)
  const light = new InstancedMesh(
    leafGeometry,
    materials.foliage,
    leaves.filter((leaf) => !leaf.dark).length,
  )
  const dark = new InstancedMesh(
    leafGeometry,
    materials.darkFoliage,
    leaves.filter((leaf) => leaf.dark).length,
  )
  const stems = new InstancedMesh(
    stemGeometry,
    materials.darkFoliage,
    strands.reduce(
      (sum, strand) => sum + strand.points.length - 1 + strand.leaves.length,
      0,
    ),
  )
  light.name = 'instanced-hanging-cliff-ivy'
  dark.name = 'instanced-hanging-cliff-ivy-shadow'
  stems.name = 'instanced-hanging-cliff-ivy-stems'
  let lightIndex = 0
  let darkIndex = 0
  for (const leaf of leaves) {
    if (leaf.dark) dark.setMatrixAt(darkIndex++, leaf.transform)
    else light.setMatrixAt(lightIndex++, leaf.transform)
  }
  const matrix = new Matrix4()
  const direction = new Vector3()
  const midpoint = new Vector3()
  const rotation = new Quaternion()
  let stemIndex = 0
  const addStem = (from: Vector3, to: Vector3, thickness: number): void => {
    direction.subVectors(to, from)
    const length = direction.length()
    rotation.setFromUnitVectors(UP, direction.normalize())
    midpoint.addVectors(from, to).multiplyScalar(0.5)
    matrix.compose(
      midpoint,
      rotation,
      new Vector3(thickness, length, thickness),
    )
    stems.setMatrixAt(stemIndex++, matrix)
  }
  for (const strand of strands) {
    for (let index = 1; index < strand.points.length; index++)
      addStem(
        strand.points[index - 1]!,
        strand.points[index]!,
        1 - (index / strand.points.length) * 0.55,
      )
    for (const leaf of strand.leaves)
      addStem(
        strand.points[leaf.stemNode]!,
        new Vector3().setFromMatrixPosition(leaf.transform),
        0.48,
      )
  }
  const root = new Group()
  root.name = 'museum-hanging-ivy'
  root.userData.strandCount = strands.length
  for (const batch of [light, dark, stems]) {
    batch.instanceMatrix.needsUpdate = true
    batch.receiveShadow = true
    if (batch.count > 0) root.add(batch)
    else batch.dispose()
  }
  return root
}
