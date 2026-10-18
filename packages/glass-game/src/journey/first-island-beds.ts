// ============================================================
// First island beds — connected low planting within measured terrace clearances.
// ============================================================

import type { Material } from 'three'
import { BufferGeometry, Color, Euler, Float32BufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, } from 'three'
import type { GardenBorderCard } from './garden-border'
import { appendGardenBorder } from './garden-border'

interface TerraceBedLobe {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly height: number
  readonly flowers?: 6 | 9
}

interface TerraceBed {
  readonly id: string
  readonly lobes: readonly TerraceBedLobe[]
}

// First Light architecture-local coordinates. Whole lobe footprints were
// measured on the decoded terrace, away from both pods, portrait, stairways,
// pond, bridge landing and existing urns/trees. The gaps are walking routes.
export const FIRST_ISLAND_TERRACE_BEDS: readonly TerraceBed[] = [
  {
    id: 'east-shoulder',
    lobes: [
      { x: 2.63608, z: 0.27672, radius: 0.24, height: 0.23 },
      { x: 2.814, z: 0.55, radius: 0.24, height: 0.28 },
      { x: 2.861, z: 0.82, radius: 0.24, height: 0.25 },
      { x: 2.75134, z: 1.09351, radius: 0.24, height: 0.22 },
    ],
  },
  {
    id: 'west-edge',
    lobes: [
      { x: -2.1507, z: 1.10508, radius: 0.24, height: 0.26 },
      { x: -2.15894, z: 0.88486, radius: 0.2, height: 0.22 },
    ],
  },
  {
    id: 'portrait-front-border',
    lobes: [
      { x: -1.67, z: 2.19, radius: 0.14, height: 0.25, flowers: 6 },
      { x: -1.59, z: 2.27, radius: 0.16, height: 0.28, flowers: 9 },
      { x: -1.47, z: 2.31, radius: 0.16, height: 0.25, flowers: 9 },
      { x: -1.31, z: 2.39, radius: 0.18, height: 0.23, flowers: 9 },
    ],
  },
]

// Upper-crown leaf contacts measured on the resident v11 masked foliage.
// Positions use First Light local x/z and height relative to its terrace deck.
// These are planted-rim contacts, outside the marble walking surface.
export const FIRST_ISLAND_RIM_BOUQUETS = [
  {
    id: 'front-left',
    contacts: [
      [-1.427, 0.1044, 3.17625],
      [-1.565, 0.05094, 3.0275],
      [-1.496, 0.05694, 3.1125],
      [-1.358, 0.06118, 3.21875],
      [-1.404, -0.03934, 3.07],
      [-1.496, 0.04795, 3.04875],
      [-1.45, 0.08858, 3.155],
      [-1.542, 0.04281, 3.07],
      [-1.473, 0.07276, 3.13375],
      [-1.519, 0.06557, 3.04875],
      [-1.45, -0.0043, 3.09125],
      [-1.542, 0.06064, 3.04875],
      [-1.565, 0.05097, 3.04875],
      [-1.519, 0.01634, 3.09125],
      [-1.519, 0.04004, 3.07],
      [-1.473, 0.01265, 3.07],
      [-1.496, 0.03154, 3.07],
      [-1.542, 0.02089, 3.0275],
      [-1.381, -0.01104, 3.1975],
      [-1.473, 0.01044, 3.04875],
    ],
  },
  {
    id: 'front-middle',
    contacts: [
      [0.958, 0.12146, 3.05],
      [0.613, 0.02433, 3.07125],
      [0.82, 0.09487, 3.0925],
      [0.728, 0.10004, 3.11375],
      [0.889, 0.08995, 3.07125],
      [0.682, 0.06444, 3.02875],
      [1.027, 0.01714, 3.0075],
      [0.751, 0.02807, 3.05],
      [0.705, 0.05819, 3.07125],
      [0.659, 0.04478, 3.07125],
      [1.004, 0.06433, 3.02875],
      [0.636, 0.06069, 3.05],
      [0.866, -0.03431, 3.0075],
      [0.797, -0.02274, 3.0075],
      [0.705, 0.07063, 3.05],
      [0.728, 0.0637, 3.05],
      [0.682, 0.06246, 3.05],
      [0.659, 0.06179, 3.05],
      [0.866, 0.04794, 3.07125],
      [0.728, 0.04913, 3.07125],
      [0.935, 0.04222, 3.05],
      [0.682, 0.04304, 3.07125],
      [0.751, -0.01405, 3.0075],
      [0.636, 0.03446, 3.07125],
    ],
  },
  {
    id: 'right-corner',
    contacts: [
      [2.46, 0.06108, 2.51375],
      [2.54, -0.01341, 2.38625],
      [2.58, -0.02392, 2.51375],
      [2.38, -0.01817, 2.5775],
      [2.5, 0.04332, 2.47125],
      [2.52, 0.02966, 2.51375],
      [2.48, -0.01076, 2.5775],
      [2.44, 0.03738, 2.55625],
      [2.56, 0.00042, 2.45],
      [2.5, 0.04192, 2.4925],
      [2.46, 0.0599, 2.4925],
      [2.52, 0.03428, 2.47125],
      [2.48, 0.03132, 2.535],
      [2.52, 0.02973, 2.42875],
      [2.52, -0.01028, 2.55625],
      [2.46, 0.04522, 2.535],
    ],
  },
] as const

function terraceBedCards(
  lobe: TerraceBedLobe,
  deckY: number,
  seed: number,
): { sprigs: GardenBorderCard[]; trails: GardenBorderCard[] } {
  const sprigs: GardenBorderCard[] = []
  const trails: GardenBorderCard[] = []
  // Fill the measured footprints with taller crowns. Narrow portrait beds
  // retain their low canopy instead of stretching beyond their supported rim.
  appendGardenBorder(
    sprigs,
    trails,
    [lobe.x, deckY + 0.003, lobe.z],
    lobe.radius,
    Math.min(lobe.height * 0.82, lobe.radius * 0.9),
    seed,
  )
  // Darker leaf backing separates the new pale blooms from the marble terrace.
  // Only these ground cards receive the tint; cornices and urns stay unchanged.
  for (const card of sprigs) {
    card.tint = [128, 165, 113]
    card.subdivisions = [2, 1]
  }
  for (const card of trails) {
    card.tint = [128, 165, 113]
    card.subdivisions = [3, 2]
  }
  return { sprigs, trails }
}

/** Low overlapping foliage under the independent, upward-facing small flowers. */
export function appendFirstIslandBeds(
  sprigs: GardenBorderCard[],
  trails: GardenBorderCard[],
  deckY: number,
): void {
  let seed = 31
  for (const bed of FIRST_ISLAND_TERRACE_BEDS)
    for (const lobe of bed.lobes) {
      const cards = terraceBedCards(lobe, deckY, seed++)
      sprigs.push(...cards.sprigs)
      trails.push(...cards.trails)
    }
}

function canopyTop(lobe: TerraceBedLobe, deckY: number, seed: number): number {
  const { sprigs, trails } = terraceBedCards(lobe, deckY, seed)
  const point = new Vector3()
  const rotation = new Euler()
  let top = deckY
  // Measure the same bounded card mesh once at assembly time. Crown lengths
  // are radius-capped, so the requested height alone can leave blooms floating.
  for (const card of [...sprigs, ...trails]) {
    rotation.set(...card.rotation)
    const [columns, rows] = card.subdivisions!
    for (let row = 0; row <= rows; row++)
      for (let column = 0; column <= columns; column++) {
        const u = column / columns
        const v = row / rows
        point
          .set(
            (u - 0.5) * card.size[0],
            -v * card.size[1],
            Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * card.bend,
          )
          .applyEuler(rotation)
        top = Math.max(top, point.y + card.position[1])
      }
  }
  return top
}

function corollaGeometry(): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let petal = 0; petal < 5; petal++) {
    const angle = (petal * Math.PI * 2) / 5
    const offset = positions.length / 3
    positions.push(0, 0.025, 0)
    for (const [azimuth, radius, y] of [
      [angle - 0.45, 0.72, 0.075],
      [angle, 1, 0],
      [angle + 0.45, 0.72, 0.075],
    ] as const)
      positions.push(Math.cos(azimuth) * radius, y, Math.sin(azimuth) * radius)
    indices.push(offset, offset + 2, offset + 1, offset, offset + 3, offset + 2)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

/** One borrowed-material batch; individual petals stay small as beds expand. */
export function createFirstIslandFlowers(
  material: Material,
  ownedGeometries: Set<BufferGeometry>,
  deckY: number,
): InstancedMesh {
  const groundCount = FIRST_ISLAND_TERRACE_BEDS.reduce(
    (total, bed) =>
      total +
      bed.lobes.reduce(
        (sum, lobe) => sum + 2 * (lobe.flowers ?? (lobe.radius < 0.2 ? 6 : 9)),
        0,
      ),
    0,
  )
  const geometry = corollaGeometry()
  ownedGeometries.add(geometry)
  const rimCount = FIRST_ISLAND_RIM_BOUQUETS.reduce(
    (sum, bank) => sum + bank.contacts.length,
    0,
  )
  const flowers = new InstancedMesh(geometry, material, groundCount + rimCount)
  flowers.name = 'first-island-terrace-flowers'
  flowers.castShadow = false
  flowers.receiveShadow = true
  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const color = new Color()
  let instance = 0
  let seed = 31
  for (const [bedIndex, bed] of FIRST_ISLAND_TERRACE_BEDS.entries())
    for (const [lobeIndex, lobe] of bed.lobes.entries()) {
      const population = 2 * (lobe.flowers ?? (lobe.radius < 0.2 ? 6 : 9))
      const foliageTop = canopyTop(lobe, deckY, seed++)
      for (let flower = 0; flower < population; flower++) {
        const cluster = Math.floor(flower / 3)
        const phase = lobeIndex * 1.71 + lobe.x * 1.3 + lobe.z * 0.7
        const clusterAngle = (cluster * Math.PI * 2) / (population / 3) + phase
        const clusterDistance = lobe.radius * (0.3 + cluster * 0.015)
        const angle = (flower % 3) * 2.18 + phase + cluster * 0.73
        const distance = lobe.radius * (0.12 + (flower % 3) * 0.025)
        const radius = 0.038 + (instance % 4) * 0.003
        quaternion.setFromEuler(
          new Euler(
            Math.sin(instance * 1.7) * 0.12,
            angle,
            Math.cos(instance * 2.1) * 0.12,
          ),
        )
        matrix.compose(
          new Vector3(
            lobe.x +
              Math.cos(clusterAngle) * clusterDistance +
              Math.cos(angle) * distance,
            // Clear the foliage envelope with every petal, not only its centre.
            foliageTop + 0.018 + (flower % 3) * 0.005,
            lobe.z +
              Math.sin(clusterAngle) * clusterDistance +
              Math.sin(angle) * distance,
          ),
          quaternion,
          new Vector3(radius, radius, radius),
        )
        flowers.setMatrixAt(instance, matrix)
        // Colour grows in small neighbouring patches rather than isolated dots.
        // Ivory remains the majority, with rose and lilac among the leaf backing.
        const patch = (cluster + lobeIndex * 2 + bedIndex) % 7
        const tint: readonly [number, number, number] =
          patch === 2 || patch === 3
            ? [1, 0.58, 0.72]
            : patch === 5
              ? [0.7, 0.64, 1]
              : [1, 1, 1]
        color.setRGB(tint[0], tint[1], tint[2])
        flowers.setColorAt(instance, color)
        instance++
      }
    }
  for (const [bankIndex, bank] of FIRST_ISLAND_RIM_BOUQUETS.entries())
    for (const [bloom, contact] of bank.contacts.entries()) {
      const radius = (0.045 + (bloom % 4) * 0.003) * 1.3
      quaternion.setFromEuler(
        new Euler(
          Math.sin(bloom * 1.7) * 0.1,
          bloom * 2.4,
          Math.cos(bloom * 2.1) * 0.1,
        ),
      )
      matrix.compose(
        new Vector3(contact[0], deckY + contact[1] + 0.024, contact[2]),
        quaternion,
        new Vector3(radius, radius, radius),
      )
      flowers.setMatrixAt(instance, matrix)
      // Ivory banks keep dark leaf breaks; one short rose patch and a smaller
      // lilac patch sit together instead of alternating across the whole rim.
      const tint: readonly [number, number, number] =
        bankIndex === 0 && contact[0] < -1.48
          ? [1, 0.7, 0.79]
          : bankIndex === 2 && contact[0] > 2.55
            ? [0.78, 0.73, 1]
            : [1, 1, 1]
      color.setRGB(tint[0], tint[1], tint[2])
      flowers.setColorAt(instance++, color)
    }
  flowers.instanceMatrix.needsUpdate = true
  flowers.instanceColor!.needsUpdate = true
  return flowers
}
