// Building gardens — supported jasmine cornices, planted urns and cypress framing using resident botanical art.

import type { Material, Object3D } from 'three'
import { BufferGeometry, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, Uint8BufferAttribute, Vector3, } from 'three'
import type { MuseumJourneyStage } from '../content/museum-journey'
import { appendFirstIslandBeds, createFirstIslandFlowers, FIRST_ISLAND_TERRACE_BEDS, } from './first-island-beds'
import { appendGardenBorder } from './garden-border'
import type { JourneyAuthoredUnit } from './resources'
import { addInstancedDonor } from './vegetation-placement'

type Point = readonly [number, number, number]
type Crop = readonly [number, number, number, number]
interface GardenCard {
  position: Point
  size: readonly [number, number]
  rotation: Point
  crop: Crop
  bend: number
  subdivisions?: readonly [columns: number, rows: number]
  hangingRoot?: boolean
  tint?: readonly [red: number, green: number, blue: number]
}
interface Cornice {
  anchors: readonly Point[]
  /** Omit the statue/door sector; angles are measured from the facade's +Z. */
  angles: readonly number[]
}

// Measured on the decoded donor's cornice, after the same 0.9 scale/0.02 lift as architecture.ts.
const PAVILION_ANCHORS: readonly Point[] = [
  [-0.3639, 1.475, -0.8704],
  [-0.7157, 1.475, -0.3505],
  [-0.6916, 1.475, 0.1755],
  [-0.5141, 1.475, 0.4423],
  [0.4729, 1.475, 0.4352],
  [0.7271, 1.475, 0.0645],
  [0.689, 1.475, -0.4563],
  [0.2989, 1.475, -0.8298],
]

const WHOLE: Crop = [0.12, 0, 0.88, 1]
// The GLTFLoader texture uses flipY=false; these are top-origin atlas crops.
const FLOWERS: readonly Crop[] = [
  [0.34, 0.51, 0.68, 0.96],
  [0.67, 0.5, 0.995, 0.99],
]
const radians = (degrees: number): number => (degrees * Math.PI) / 180

function rootedCrop(crop: Crop): Crop {
  return [crop[0], crop[3], crop[2], crop[1]]
}

function materialNamed(source: Object3D, name: string): Material | undefined {
  let found: Material | undefined
  source.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]
    found ??= materials.find((material) => material.name === name)
  })
  return found
}

function cardGeometry(cards: readonly GardenCard[]): BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const colors: number[] = []
  const transform = new Matrix4()
  const point = new Vector3()
  for (const card of cards) {
    transform.compose(
      new Vector3(...card.position),
      new Quaternion().setFromEuler(new Euler(...card.rotation)),
      new Vector3(1, 1, 1),
    )
    const offset = positions.length / 3
    const [columns, rows] = card.subdivisions ?? [4, 5]
    for (let row = 0; row <= rows; row++) {
      const v = row / rows
      for (let column = 0; column <= columns; column++) {
        const u = column / columns
        // Root along the upper edge; the blade bows out from the support.
        point
          .set(
            (u - 0.5) * card.size[0],
            -v * card.size[1],
            Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * card.bend,
          )
          .applyMatrix4(transform)
        positions.push(point.x, point.y, point.z)
        colors.push(...(card.tint ?? [255, 255, 255]), 255)
        uvs.push(
          card.crop[0] + u * (card.crop[2] - card.crop[0]),
          card.crop[1] + v * (card.crop[3] - card.crop[1]),
        )
        if (row < rows && column < columns) {
          const a = offset + row * (columns + 1) + column
          indices.push(
            a,
            a + columns + 1,
            a + 1,
            a + 1,
            a + columns + 1,
            a + columns + 2,
          )
        }
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  // Resident materials multiply the atlas by COLOR_0. Default white preserves
  // authored art; local bed tints deepen leaves without changing shared materials.
  geometry.setAttribute(
    'color',
    new Uint8BufferAttribute(new Uint8Array(colors), 4, true),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function addCornice(
  sprigs: GardenCard[],
  trails: GardenCard[],
  cornice: Cornice,
  seed: number,
): void {
  cornice.angles.forEach((degrees, index) => {
    const angle = radians(degrees)
    const point = cornice.anchors[index]!
    appendGardenBorder(sprigs, trails, point, 0.23, 0.25, index + seed)
    if ((index + seed) % 3 !== 1)
      trails.push({
        position: point,
        size: [0.36 + (index % 2) * 0.035, 0.46 + ((index + seed) % 3) * 0.09],
        rotation: [0, angle, Math.sin(index * 2.1 + seed) * 0.09],
        crop: WHOLE,
        bend: 0.055,
        hangingRoot: true,
      })
  })
}

function addTwinArchFlowers(sprigs: GardenCard[], trails: GardenCard[]): void {
  // Sparse groups follow the decoded connector's upper arc, leaving its sky
  // opening clear. Its existing ivy supplies the green body beneath the flowers.
  const roots: readonly Point[] = [
    [-0.36, 1.98, 0.4901],
    [-0.18, 2.045, 0.5086],
    [0.015, 2.055, 0.556],
    [0.21, 2.02, 0.4947],
    [0.37, 1.96, 0.4958],
  ]
  roots.forEach((root, index) => {
    for (let flower = 0; flower < 3; flower++)
      sprigs.push({
        position: [
          root[0] + (flower - 1) * 0.035,
          root[1] - Math.abs(flower - 1) * 0.015,
          root[2] + (flower % 2) * 0.015,
        ],
        size: [0.115 + (flower % 2) * 0.012, 0.135],
        rotation: [0.4, (flower - 1) * 0.36, Math.PI],
        crop: rootedCrop(FLOWERS[(flower + index) % FLOWERS.length]!),
        bend: 0.015,
        subdivisions: [2, 2],
      })
    if (index === 0 || index === roots.length - 1)
      trails.push({
        position: root,
        size: [0.19, index === 0 ? 0.7 : 0.66],
        rotation: [0, index === 0 ? -0.28 : 0.28, 0],
        crop: WHOLE,
        bend: 0.045,
        hangingRoot: true,
      })
  })
}

function donorTransform(position: Point, scale: number, yaw = 0): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw),
    new Vector3(scale, scale, scale),
  )
}

function addPlanters(
  root: Group,
  authored: JourneyAuthoredUnit,
  sprigs: GardenCard[],
  trails: GardenCard[],
  positions: readonly Point[],
): void {
  addInstancedDonor(
    root,
    authored('map_planter'),
    positions.map((position, index) =>
      new Matrix4().compose(
        new Vector3(...position),
        new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), index * 1.4),
        new Vector3(0.36, 0.24, 0.36),
      ),
    ),
    'museum-building-garden-urns',
  )
  // The low urns visibly support the same small-leaf vocabulary as the cornice.
  positions.forEach((position, index) =>
    appendGardenBorder(
      sprigs,
      trails,
      [position[0], position[1] + 0.215, position[2]],
      0.23,
      0.26,
      index + 7,
    ),
  )
}

/** Optional resident V11 materials keep older authored-kit fixtures and low-detail fallbacks intact. */
export function createJourneyBuildingGarden(
  stage: MuseumJourneyStage,
  source: Object3D,
  authored: JourneyAuthoredUnit,
  ownedGeometries: Set<BufferGeometry>,
  deckY: number,
  flowerMaterial?: Material,
): Group | undefined {
  if (
    stage.kind !== 'pavilion' &&
    stage.kind !== 'twins' &&
    stage.kind !== 'conservatory'
  )
    return undefined
  const botanical = materialNamed(source, 'Botanical_atlas')
  const jasmine = materialNamed(source, 'Botanical_jasmine')
  if (botanical === undefined || jasmine === undefined) return undefined
  const root = new Group()
  root.name = `${stage.id}-building-garden`
  root.userData.support = 'authored-cornice-planter-and-terrace-anchors'
  root.userData.deckLocalY = deckY
  const sprigs: GardenCard[] = []
  const trails: GardenCard[] = []
  if (stage.kind === 'pavilion') {
    // Temple donor is scaled 0.9 and lifted 0.02 by architecture.ts.
    addCornice(
      sprigs,
      trails,
      {
        anchors: PAVILION_ANCHORS,
        angles: [-155, -110, -69, -44, 42, 78, 118, 158],
      },
      0,
    )
    addPlanters(root, authored, sprigs, trails, [
      [-1.12, deckY, 0.72],
      // Leave the front-right crystals clear, beside the temple's outer plinth.
      [1.45, deckY, -0.2],
    ])
    const cypress = source.getObjectByName('map_cypress')
    if (cypress !== undefined)
      addInstancedDonor(
        root,
        cypress.clone(true),
        [
          donorTransform([-1.1, deckY, -0.62], 0.91, 0.3),
          donorTransform([1.09, deckY, -0.66], 1.06, 1.9),
        ],
        'museum-building-framing-cypresses',
      )
  } else if (stage.kind === 'twins') {
    // Preserve both statue bays; crown the existing open connector instead of obscuring it.
    for (const x of [-0.9, 0.9])
      addCornice(
        sprigs,
        trails,
        {
          anchors: (x < 0
            ? PAVILION_ANCHORS.slice(0, 3)
            : PAVILION_ANCHORS.slice(5)
          ).map(([px, py, pz]) => [
            x + px * 0.8,
            (py - 0.02) * 0.8 + 0.02,
            pz * 0.8 - 0.05,
          ]),
          angles: x < 0 ? [-155, -110, -69] : [78, 118, 158],
        },
        x < 0 ? 1 : 2,
      )
    addCornice(
      sprigs,
      trails,
      {
        anchors: [
          [-0.49, 1.815, 0.498],
          [-0.35, 1.815, 0.554],
          [0, 1.815, 0.748],
          [0.35, 1.815, 0.555],
          [0.49, 1.815, 0.497],
        ],
        angles: [-55, -35, 0, 35, 55],
      },
      2,
    )
    addTwinArchFlowers(sprigs, trails)
    // The right forecourt belongs to the portrait and pond; an urn obscures
    // the artwork there. Keep the supported planter beside the left hall.
    addPlanters(root, authored, sprigs, trails, [[-1.58, deckY, 0.56]])
  } else {
    addCornice(
      sprigs,
      trails,
      {
        anchors: [
          [-0.3742, 1.725, -0.8905],
          [-0.8201, 1.725, -0.5046],
          [-0.9187, 1.725, 0.0466],
          [-0.7642, 1.725, 0.5688],
          [0.6917, 1.725, 0.595],
          [0.9168, 1.725, 0.0626],
          [0.7918, 1.725, -0.5258],
          [0.3712, 1.725, -0.8837],
        ],
        angles: [-156, -119, -84, -51, 47, 83, 121, 156],
      },
      1,
    )
    addPlanters(root, authored, sprigs, trails, [
      [-1.04, deckY, 0.38],
      [1.04, deckY, 0.38],
    ])
  }
  // Connected First Light strips occupy the measured deck shoulder and edges.
  // The open entrance, portrait and crystal sectors stay unplanted.
  if (stage.kind === 'pavilion') appendFirstIslandBeds(sprigs, trails, deckY)
  const borderRoots: readonly [
    x: number,
    z: number,
    radius: number,
    height: number,
  ][] =
    stage.kind === 'conservatory'
      ? [
          [1.4, -0.85, 0.24, 0.24],
          [-1.4, -1, 0.24, 0.18],
          [-1.2, -1.2, 0.24, 0.2],
          [1.35, 1.2, 0.24, 0.22],
        ]
      : []
  borderRoots.forEach(([x, z, radius, height], index) =>
    appendGardenBorder(
      sprigs,
      trails,
      [x, deckY + 0.003, z],
      radius,
      height,
      index + 3,
    ),
  )
  root.userData.terraceGardenRoots = borderRoots.map(([x, z]) => [
    x,
    deckY + 0.003,
    z,
  ])
  if (stage.kind === 'pavilion') {
    root.userData.terraceGardenRoots = FIRST_ISLAND_TERRACE_BEDS.flatMap(
      (bed) => bed.lobes.map(({ x, z }) => [x, deckY + 0.003, z]),
    )
    root.userData.terraceBeds = FIRST_ISLAND_TERRACE_BEDS
    if (flowerMaterial !== undefined)
      root.add(createFirstIslandFlowers(flowerMaterial, ownedGeometries, deckY))
  }
  for (const [name, cards, material] of [
    ['cornice-and-urn-sprigs', sprigs, botanical],
    ['supported-jasmine-trails', trails, jasmine],
  ] as const) {
    const geometry = cardGeometry(cards)
    ownedGeometries.add(geometry)
    const mesh = new Mesh(geometry, material)
    mesh.name = `${stage.id}-${name}`
    mesh.castShadow = false
    mesh.receiveShadow = true
    mesh.userData.buildingGardenCards = cards.length
    mesh.userData.supportedHangingRoots = cards
      .filter((card) => card.hangingRoot === true)
      .map((card) => card.position)
    root.add(mesh)
  }
  root.userData.cardCount = sprigs.length + trails.length
  return root
}
