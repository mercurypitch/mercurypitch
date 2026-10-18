// ============================================================
// Garden borders — rooted flower mounds assembled from resident botanical art.
// ============================================================

import { Euler, Matrix4, Vector3 } from 'three'

type Point = readonly [number, number, number]
type Crop = readonly [number, number, number, number]

/** Structural match for the building garden's shared, batched card geometry. */
export interface GardenBorderCard {
  position: Point
  size: readonly [number, number]
  rotation: Point
  crop: Crop
  bend: number
  subdivisions?: readonly [columns: number, rows: number]
  hangingRoot?: boolean
  tint?: readonly [red: number, green: number, blue: number]
}

const CROWN: Crop = [0.14, 0, 0.86, 0.34]
const CROWN_ASPECT = ((0.86 - 0.14) * 683) / (0.34 * 1024)
const LEAVES: readonly Crop[] = [
  [0.02, 0.03, 0.33, 0.46],
  [0.34, 0.03, 0.69, 0.46],
  [0.72, 0.02, 0.99, 0.44],
]
const FLOWERS: readonly Crop[] = [
  [0.34, 0.51, 0.68, 0.96],
  [0.67, 0.5, 0.995, 0.99],
]
const GOLDEN_ANGLE = 2.399963229728653

function rootedCrop(crop: Crop): Crop {
  return [crop[0], crop[3], crop[2], crop[1]]
}

function atlasAspect(crop: Crop): number {
  return (crop[2] - crop[0]) / (crop[3] - crop[1])
}

function plantedRotation(azimuth: number, lean: number): Point {
  const sine = Math.sin(azimuth)
  const cosine = Math.cos(azimuth)
  const tangent = new Vector3(-sine, 0, cosine)
  const growth = new Vector3(
    -cosine * Math.sin(lean),
    Math.cos(lean),
    -sine * Math.sin(lean),
  )
  const normal = new Vector3().crossVectors(growth, tangent)
  // Existing cards grow along local -Y and bow along +Z. The frame keeps
  // their roots level, their tips inward/up and their lit faces outward/up.
  const rotation = new Euler().setFromRotationMatrix(
    new Matrix4().makeBasis(tangent, growth.negate(), normal),
  )
  return [rotation.x, rotation.y, rotation.z]
}

function plantedRoot(
  root: Point,
  azimuth: number,
  distance: number,
  embedding: number,
): Point {
  return [
    root[0] + Math.cos(azimuth) * distance,
    root[1] - embedding,
    root[2] + Math.sin(azimuth) * distance,
  ]
}

/** Append one low mound: four crown patches, sixteen leaves and four accents. */
export function appendGardenBorder(
  sprigs: GardenBorderCard[],
  trails: GardenBorderCard[],
  root: Point,
  radius: number,
  height: number,
  seed: number,
): void {
  if (
    !Number.isFinite(radius) ||
    !Number.isFinite(height) ||
    radius <= 0 ||
    height <= 0
  ) {
    return
  }
  const phase = seed * GOLDEN_ANGLE
  const embedding = Math.min(0.018, height * 0.07)

  // Each crown has its own perimeter root. Its inward reach stops short of
  // the centre, so the textured surfaces never form a full-width crossed X.
  for (let index = 0; index < 4; index++) {
    const azimuth =
      phase + (index * Math.PI) / 2 + Math.sin(seed + index) * 0.12
    const lean = 0.3 + ((index + Math.abs(seed)) % 3) * 0.075
    const length = Math.min(
      (height * (0.85 + index * 0.025)) / Math.cos(lean),
      radius * 0.9,
    )
    trails.push({
      position: plantedRoot(
        root,
        azimuth,
        radius * (0.58 + index * 0.025),
        embedding,
      ),
      size: [length * CROWN_ASPECT, length],
      rotation: plantedRotation(azimuth, lean),
      crop: rootedCrop(CROWN),
      bend: Math.min(radius * 0.07, length * 0.12),
      subdivisions: [4, 3],
    })
  }

  // Smaller independent leaves break the crown silhouettes without inflating
  // their baked blossoms. Two thirds use the atlas's narrow lance-shaped leaf.
  for (let index = 0; index < 16; index++) {
    const azimuth = phase + index * GOLDEN_ANGLE
    const variation = (index * 3 + Math.abs(seed)) % 5
    const crop = LEAVES[index % 3 === 0 ? index % 2 : 2]!
    const length =
      Math.min(height * 0.75, radius * 0.45, 0.12) * (0.78 + variation * 0.05)
    sprigs.push({
      position: plantedRoot(
        root,
        azimuth,
        radius * (0.42 + variation * 0.065),
        embedding * 0.6,
      ),
      size: [length * atlasAspect(crop), length],
      rotation: plantedRotation(azimuth, 0.55 + variation * 0.105),
      crop: rootedCrop(crop),
      bend: length * (0.12 + (index % 3) * 0.025),
      subdivisions: [2, 2],
    })
  }

  // Most flowers already live in the jasmine crown. These few accents retain
  // the atlas proportions and a bounded blossom size instead of scaling into
  // pale flat stickers as the caller widens the whole border.
  for (let index = 0; index < 4; index++) {
    const azimuth = phase + index * GOLDEN_ANGLE + 0.6
    const crop = FLOWERS[index % FLOWERS.length]!
    const length =
      Math.min(height * 0.88, radius * 0.6, 0.175) * (0.84 + index * 0.045)
    sprigs.push({
      position: plantedRoot(
        root,
        azimuth,
        radius * (0.25 + index * 0.075),
        embedding * 0.5,
      ),
      size: [length * atlasAspect(crop), length],
      rotation: plantedRotation(azimuth, 0.45 + index * 0.11),
      crop: rootedCrop(crop),
      bend: length * 0.11,
      subdivisions: [2, 2],
    })
  }
}
