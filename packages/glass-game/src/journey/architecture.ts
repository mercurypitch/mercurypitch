// Journey architecture — compose authored kit pieces into palatial halls, medallions and arched paths.

import type { BufferGeometry, Material, Object3D } from 'three'
import { BoxGeometry, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, OctahedronGeometry, Quaternion, RingGeometry, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector3, } from 'three'
import type { MuseumJourneyDefinition, MuseumJourneyPortraitMonument, MuseumJourneyStage, } from '../content/museum-journey'
import { createJourneyBridge } from './bridges'
import { JOURNEY_MEDALLION_FACE_Y, JOURNEY_MEDALLION_SURFACE_Y, } from './landmarks'
import type { JourneyStairway } from './terrace-layout'
import { JOURNEY_STAIR_COUNT, JOURNEY_STAIR_DEPTH, JOURNEY_STAIR_RUN, JOURNEY_STAIRWAYS, } from './terrace-layout'

export interface JourneyArchitectureMaterials {
  gold: Material
  jade: Material
  medallionGlass?: Material
  ivory: Material
  amber: Material
  celadon: Material
  clearGlass: Material
  shadow: Material
  mysteryPortrait?: Material
  crystal: Material
}

export type JourneyAuthoredUnit = (name: string) => Object3D

export const JOURNEY_PORTRAIT_INSET_MATERIAL = 'map_frame_atlas_00'
const JOURNEY_PORTRAIT_SURFACE_CLEARANCE = 0.003

export function findJourneyPortraitInset(frame: Object3D): Mesh {
  const matches: Mesh[] = []
  frame.traverse((object) => {
    const candidate = object as Mesh
    if (
      candidate.isMesh &&
      !Array.isArray(candidate.material) &&
      candidate.material.name === JOURNEY_PORTRAIT_INSET_MATERIAL
    )
      matches.push(candidate)
  })
  if (matches.length !== 1)
    throw new Error(
      `Journey map_frame must contain exactly one portrait inset using material ${JOURNEY_PORTRAIT_INSET_MATERIAL}; found ${matches.length}.`,
    )
  return matches[0]!
}

function minimumFrameZ(frame: Object3D, object: Object3D): number {
  frame.updateWorldMatrix(true, true)
  const frameInverse = frame.matrixWorld.clone().invert()
  const point = new Vector3()
  let minimum = Number.POSITIVE_INFINITY
  object.traverse((candidate) => {
    const mesh = candidate as Mesh
    if (!mesh.isMesh) return
    const positions = mesh.geometry.getAttribute('position')
    if (positions === undefined) return
    const relative = new Matrix4().multiplyMatrices(
      frameInverse,
      mesh.matrixWorld,
    )
    for (let index = 0; index < positions.count; index++) {
      point
        .set(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index),
        )
        .applyMatrix4(relative)
      minimum = Math.min(minimum, point.z)
    }
  })
  if (!Number.isFinite(minimum))
    throw new Error('Journey map_frame has no positioned portrait geometry.')
  return minimum
}

function createJourneyPortraitSurface(
  frame: Object3D,
  inset: Mesh,
  material: Material,
): Mesh {
  frame.updateWorldMatrix(true, true)
  const relative = new Matrix4()
    .copy(frame.matrixWorld)
    .invert()
    .multiply(inset.matrixWorld)
  const frameFrontZ = minimumFrameZ(frame, frame)
  const insetFrontZ = minimumFrameZ(frame, inset)
  const surface = new Mesh(inset.geometry, material)
  relative.decompose(surface.position, surface.quaternion, surface.scale)
  surface.position.z +=
    frameFrontZ - JOURNEY_PORTRAIT_SURFACE_CLEARANCE - insetFrontZ
  surface.visible = false
  surface.castShadow = false
  surface.receiveShadow = false
  surface.userData.journeyPortraitFrontZ =
    frameFrontZ - JOURNEY_PORTRAIT_SURFACE_CLEARANCE
  return surface
}

interface ArchitectureGeometry {
  base: CylinderGeometry
  step: BoxGeometry
  dome: SphereGeometry
  medallion: CylinderGeometry
  medallionRing: RingGeometry
  medallionBeadRing: TorusGeometry
  detailStud: CylinderGeometry
  progressStar: ShapeGeometry
  connectorArch: TorusGeometry
  crystal: OctahedronGeometry
}

export interface JourneyArchitectureAssembly {
  root: Group
  selectableRoots: ReadonlyMap<string, Object3D>
  portraitSurfaces: ReadonlyMap<string, Mesh>
  portraitMysteries: ReadonlyMap<string, Object3D>
  starMarkers: ReadonlyMap<string, JourneyProgressStars>
}

export type JourneyProgressStars = readonly [Object3D, Object3D, Object3D]

function own<T extends BufferGeometry>(
  geometry: T,
  owned: Set<BufferGeometry>,
): T {
  owned.add(geometry)
  return geometry
}

function createProgressStarGeometry(): ShapeGeometry {
  const shape = new Shape()
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5
    const radius = point % 2 === 0 ? 0.052 : 0.023
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (point === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return new ShapeGeometry(shape)
}

function createGeometry(owned: Set<BufferGeometry>): ArchitectureGeometry {
  return {
    base: own(new CylinderGeometry(1, 1.08, 0.3, 32), owned),
    step: own(new BoxGeometry(1, 1, 1), owned),
    dome: own(
      new SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      owned,
    ),
    medallion: own(new CylinderGeometry(1, 1, 0.075, 40), owned),
    medallionRing: own(new RingGeometry(0.72, 0.96, 40), owned),
    medallionBeadRing: own(new TorusGeometry(0.365, 0.014, 6, 40), owned),
    detailStud: own(new CylinderGeometry(1, 1, 0.018, 12), owned),
    progressStar: own(createProgressStarGeometry(), owned),
    connectorArch: own(new TorusGeometry(1, 0.075, 8, 32, Math.PI), owned),
    crystal: own(new OctahedronGeometry(0.22, 0), owned),
  }
}

function markSelectable(root: Object3D, stageId: string): void {
  root.traverse((object) => {
    object.userData.journeyStageId = stageId
  })
}

function addColumns(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  positions: readonly (readonly [number, number])[],
  scale: number,
): void {
  for (const [x, z] of positions) {
    const column = authoredUnit('map_column')
    column.position.set(x, 0.02, z)
    column.scale.setScalar(scale)
    root.add(column)
  }
}

function addGlazedHall(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
  options: {
    x?: number
    z?: number
    radius: number
    height: number
    glass: Material
    canopyScale: number
  },
): void {
  const x = options.x ?? 0
  const z = options.z ?? 0
  const base = new Mesh(geometry.base, materials.ivory)
  base.name = 'ivory-masonry-drum'
  base.position.set(x, 0.16, z)
  base.scale.set(options.radius * 1.12, 1, options.radius * 1.12)
  base.castShadow = true
  base.receiveShadow = true
  root.add(base)

  const canopy = authoredUnit('map_canopy')
  canopy.position.set(x, 0.25, z)
  canopy.scale.setScalar(options.canopyScale)
  root.add(canopy)

  const dome = new Mesh(geometry.dome, options.glass)
  dome.name = 'full-glass-dome'
  dome.position.set(x, options.height, z)
  dome.scale.set(options.radius, options.radius * 0.82, options.radius)
  dome.castShadow = true
  root.add(dome)
}

function addStairway(
  root: Group,
  geometry: ArchitectureGeometry,
  material: Material,
  { width, frontZ }: JourneyStairway,
): void {
  const count = JOURNEY_STAIR_COUNT
  const stairs = new InstancedMesh(geometry.step, material, count)
  stairs.name = 'ivory-processional-stairway'
  stairs.castShadow = true
  stairs.receiveShadow = true
  const matrix = new Matrix4()
  for (let index = 0; index < count; index++) {
    const progress = index / Math.max(1, count - 1)
    matrix.compose(
      new Vector3(
        0,
        (0.07 + index * 0.045) / 2,
        frontZ - index * JOURNEY_STAIR_RUN,
      ),
      new Quaternion(),
      new Vector3(
        width - progress * 0.2,
        0.07 + index * 0.045,
        JOURNEY_STAIR_DEPTH,
      ),
    )
    stairs.setMatrixAt(index, matrix)
  }
  stairs.instanceMatrix.needsUpdate = true
  root.add(stairs)
}

function addCrystalCluster(
  root: Group,
  geometry: ArchitectureGeometry,
  material: Material,
  x: number,
  z: number,
): void {
  const crystals = new InstancedMesh(geometry.crystal, material, 5)
  crystals.name = 'museum-crystal-cluster'
  const matrix = new Matrix4()
  for (let index = 0; index < 5; index++) {
    const angle = index * 2.17
    const height = 0.52 + (index % 3) * 0.18
    matrix.compose(
      new Vector3(
        x + Math.cos(angle) * 0.2,
        height * 0.45,
        z + Math.sin(angle) * 0.18,
      ),
      new Quaternion().setFromAxisAngle(
        new Vector3(0, 0, 1),
        (index - 2) * 0.08,
      ),
      new Vector3(0.62, height, 0.62),
    )
    crystals.setMatrixAt(index, matrix)
  }
  crystals.instanceMatrix.needsUpdate = true
  crystals.castShadow = true
  root.add(crystals)
}

function addPavilion(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  const temple = sculpturalUnit?.('map_temple_teal')
  if (temple !== undefined) {
    temple.position.y = 0.02
    temple.scale.setScalar(0.9)
    root.add(temple)
    addCrystalCluster(root, geometry, materials.crystal, 1.12, 0.7)
    return
  }
  addGlazedHall(root, authoredUnit, geometry, materials, {
    radius: 0.78,
    height: 1.42,
    glass: materials.clearGlass,
    canopyScale: 0.63,
  })
  addColumns(
    root,
    authoredUnit,
    [
      [-0.72, -0.58],
      [0.72, -0.58],
      [-0.72, 0.58],
      [0.72, 0.58],
    ],
    0.48,
  )
  addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.pavilion)
  addCrystalCluster(root, geometry, materials.crystal, 1.05, 0.78)
}

function addEntryGarden(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  const plinth = new Mesh(geometry.base, materials.ivory)
  plinth.name = 'glassworks-entry-garden-plinth'
  plinth.position.y = 0.08
  plinth.scale.set(0.72, 0.48, 0.72)
  plinth.castShadow = true
  plinth.receiveShadow = true
  root.add(plinth)
  const arch = new Mesh(geometry.connectorArch, materials.gold)
  arch.name = 'glassworks-entry-garden-arch'
  arch.position.set(0, 0.66, 0.02)
  arch.scale.set(0.54, 0.62, 1)
  root.add(arch)
  addColumns(
    root,
    authoredUnit,
    [
      [-0.54, 0.02],
      [0.54, 0.02],
    ],
    0.24,
  )
  for (const x of [-0.68, 0.68]) {
    const planter = authoredUnit('map_planter')
    planter.position.set(x, 0.03, 0.18)
    planter.scale.setScalar(0.34)
    root.add(planter)
  }
  addCrystalCluster(root, geometry, materials.crystal, 0, 0.18)
  addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.garden)
}

function addRotunda(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  addGlazedHall(root, authoredUnit, geometry, materials, {
    radius: 0.92,
    height: 1.62,
    glass: materials.amber,
    canopyScale: 0.73,
  })
  addColumns(
    root,
    authoredUnit,
    [
      [-0.82, -0.5],
      [0, -0.94],
      [0.82, -0.5],
      [-0.82, 0.5],
      [0.82, 0.5],
    ],
    0.53,
  )
  addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.rotunda)
}

function addTwinGalleries(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  architecturalUnit: JourneyAuthoredUnit | undefined,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  for (const [x, glass, templeName] of [
    [-0.9, materials.amber, 'map_temple_amber'],
    [0.9, materials.celadon, 'map_temple_teal'],
  ] as const) {
    const temple = sculpturalUnit?.(templeName)
    if (temple !== undefined) {
      temple.position.set(x, 0.02, -0.05)
      temple.scale.setScalar(0.72)
      root.add(temple)
    } else {
      addGlazedHall(root, authoredUnit, geometry, materials, {
        x,
        radius: 0.82,
        height: 1.52,
        glass,
        canopyScale: 0.65,
      })
      addColumns(
        root,
        authoredUnit,
        [
          [x - 0.62, -0.5],
          [x + 0.62, -0.5],
          [x - 0.62, 0.5],
          [x + 0.62, 0.5],
        ],
        0.48,
      )
    }
  }

  const connector = architecturalUnit?.('map_twin_connector')
  if (connector === undefined) {
    const arch = new Mesh(geometry.connectorArch, materials.gold)
    arch.name = 'twin-gallery-canopy-arch'
    arch.position.set(0, 1.46, 0.02)
    arch.scale.set(0.44, 0.34, 1)
    arch.castShadow = true
    root.add(arch)
  } else {
    // The halls nearly meet at their native placement. Set the open connector
    // forward so its piers layer in front of the facades instead of clipping.
    connector.position.set(0, 0.02, 0.44)
    connector.scale.setScalar(0.78)
    root.add(connector)
  }
  addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.twins)
  if (connector === undefined)
    addCrystalCluster(root, geometry, materials.crystal, 0, 0.9)
}

function addConservatory(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  architecturalUnit: JourneyAuthoredUnit | undefined,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  const conservatory = architecturalUnit?.('map_conservatory')
  if (conservatory !== undefined) {
    conservatory.position.y = 0.02
    root.add(conservatory)
    addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.conservatory)
    addCrystalCluster(root, geometry, materials.crystal, -1.24, 0.88)
    return
  }
  addGlazedHall(root, authoredUnit, geometry, materials, {
    radius: 1.12,
    height: 1.72,
    glass: materials.celadon,
    canopyScale: 0.82,
  })
  addColumns(
    root,
    authoredUnit,
    [
      [-0.92, -0.58],
      [0, -1.05],
      [0.92, -0.58],
      [-0.92, 0.58],
      [0, 1.05],
      [0.92, 0.58],
    ],
    0.58,
  )
  addStairway(root, geometry, materials.ivory, JOURNEY_STAIRWAYS.conservatory)
  addCrystalCluster(root, geometry, materials.crystal, -1.24, 0.88)
}

function addMedallion(
  stageRoot: Group,
  stage: MuseumJourneyStage,
  variantIndex: number,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
  starMarkers: Map<string, JourneyProgressStars>,
): void {
  const marker = new Group()
  marker.name = `${stage.id}-journey-medallion`
  marker.position.fromArray(stage.position)
  marker.userData.journeyStageId = stage.id
  marker.userData.journeyMedallionSurfaceY = JOURNEY_MEDALLION_SURFACE_Y

  const medallion = new Mesh(geometry.medallion, materials.gold)
  medallion.name = `${stage.id}-path-medallion`
  // The authored stairs and promenade sit above the terrace surface. Sink the
  // pedestal into that surface and lift its face clear of those ribbons.
  medallion.position.y = 0.11
  medallion.scale.set(0.46, 1, 0.46)
  medallion.castShadow = true
  medallion.receiveShadow = true
  const face = new Mesh(
    geometry.medallion,
    materials.medallionGlass ?? materials.jade,
  )
  face.name = `${stage.id}-medallion-face`
  face.position.y = JOURNEY_MEDALLION_FACE_Y
  face.scale.set(0.36, 0.14, 0.36)
  const ring = new Mesh(geometry.medallionRing, materials.gold)
  ring.name = `${stage.id}-medallion-ring`
  ring.rotation.x = -Math.PI / 2
  ring.position.y = JOURNEY_MEDALLION_SURFACE_Y
  ring.scale.setScalar(0.52)

  const beadRing = new Mesh(geometry.medallionBeadRing, materials.gold)
  beadRing.name = `${stage.id}-engraved-inner-rim`
  beadRing.rotation.x = Math.PI / 2
  beadRing.position.y = JOURNEY_MEDALLION_SURFACE_Y + 0.007

  const inlay = new InstancedMesh(geometry.detailStud, materials.gold, 14)
  inlay.name = `${stage.id}-sun-and-route-inlay`
  const matrix = new Matrix4()
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2 + variantIndex * (Math.PI / 16)
    matrix.compose(
      new Vector3(
        Math.sin(angle) * 0.13,
        JOURNEY_MEDALLION_SURFACE_Y + 0.009,
        Math.cos(angle) * 0.13,
      ),
      new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), angle),
      new Vector3(0.018, 0.25, 0.11),
    )
    inlay.setMatrixAt(index, matrix)
  }
  matrix.compose(
    new Vector3(0, JOURNEY_MEDALLION_SURFACE_Y + 0.011, 0),
    new Quaternion(),
    new Vector3(0.06, 0.25, 0.06),
  )
  inlay.setMatrixAt(8, matrix)
  for (let index = 0; index < 5; index++) {
    const angle = -Math.PI * 0.82 + index * 0.32 + variantIndex * (Math.PI / 20)
    const radius = 0.26 + Math.sin(index * 1.8) * 0.018
    matrix.compose(
      new Vector3(
        Math.cos(angle) * radius,
        JOURNEY_MEDALLION_SURFACE_Y + 0.011,
        Math.sin(angle) * radius,
      ),
      new Quaternion(),
      new Vector3(0.022, 0.22, 0.022),
    )
    inlay.setMatrixAt(index + 9, matrix)
  }
  inlay.instanceMatrix.needsUpdate = true

  const earnedStars = new Group()
  earnedStars.name = `${stage.id}-earned-stars`
  const createStar = (slot: 1 | 2 | 3, x: number): Mesh => {
    const star = new Mesh(geometry.progressStar, materials.gold)
    star.name = `${stage.id}-progress-star-${slot}`
    star.position.set(x, JOURNEY_MEDALLION_SURFACE_Y + 0.012, 0.235)
    star.rotation.x = -Math.PI / 2
    star.visible = false
    star.userData.journeyStageId = stage.id
    star.userData.journeyStarSlot = slot
    return star
  }
  const stars: JourneyProgressStars = [
    createStar(1, -0.115),
    createStar(2, 0),
    createStar(3, 0.115),
  ]
  earnedStars.add(...stars)
  starMarkers.set(stage.id, stars)

  marker.add(medallion, face, ring, beadRing, inlay, earnedStars)
  stageRoot.add(marker)
}

function addPortraitMonument(
  stageRoot: Group,
  stageId: string,
  portrait: MuseumJourneyPortraitMonument,
  authoredUnit: JourneyAuthoredUnit,
  materials: JourneyArchitectureMaterials,
  portraitSurfaces: Map<string, Mesh>,
  portraitMysteries: Map<string, Object3D>,
): void {
  const monument = new Group()
  monument.name = `${portrait.portraitId}-monument`
  monument.position.fromArray(portrait.position)
  monument.rotation.y = portrait.yaw
  const frame = authoredUnit('map_frame')
  frame.rotation.y = Math.PI
  frame.scale.setScalar(0.72)
  monument.add(frame)

  const inset = findJourneyPortraitInset(frame)
  const surface = createJourneyPortraitSurface(frame, inset, materials.jade)
  surface.name = `${portrait.portraitId}-surface`
  surface.userData.journeyPortraitId = portrait.portraitId
  surface.userData.journeyPortraitState = 'mystery'
  surface.userData.journeyPortraitUv = 'authored'
  frame.add(surface)

  // Both states use the measured arched inset. A separate flat mystery insert
  // lets the progress owner swap earned art without mutating donor materials.
  const mystery = new Mesh(
    surface.geometry,
    materials.mysteryPortrait ?? materials.jade,
  )
  mystery.position.copy(surface.position)
  mystery.quaternion.copy(surface.quaternion)
  mystery.scale.copy(surface.scale)
  mystery.castShadow = false
  mystery.receiveShadow = false
  mystery.name = `${portrait.portraitId}-mystery`
  mystery.userData.journeyPortraitId = portrait.portraitId
  mystery.userData.journeyPortraitUv = 'authored'
  frame.add(mystery)
  portraitSurfaces.set(portrait.portraitId, surface)
  portraitMysteries.set(portrait.portraitId, mystery)
  markSelectable(monument, stageId)
  stageRoot.add(monument)
}

export function createJourneyArchitecture(
  definition: MuseumJourneyDefinition,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  architecturalUnit: JourneyAuthoredUnit | undefined,
  materials: JourneyArchitectureMaterials,
  ownedGeometries: Set<BufferGeometry>,
): JourneyArchitectureAssembly {
  const root = new Group()
  root.name = 'floating-museum-palaces'
  const selectableRoots = new Map<string, Object3D>()
  const portraitSurfaces = new Map<string, Mesh>()
  const portraitMysteries = new Map<string, Object3D>()
  const starMarkers = new Map<string, JourneyProgressStars>()
  const geometry = createGeometry(ownedGeometries)

  for (const [stageIndex, stage] of definition.stages.entries()) {
    const stageRoot = new Group()
    stageRoot.name = stage.id
    const building = new Group()
    building.name = `${stage.id}-architecture`
    building.position.fromArray(stage.architecturePosition)
    building.rotation.y = stage.yaw
    building.scale.setScalar(stage.scale)
    if (stage.kind === 'pavilion')
      addPavilion(building, authoredUnit, sculpturalUnit, geometry, materials)
    else if (stage.kind === 'garden')
      addEntryGarden(building, authoredUnit, geometry, materials)
    else if (stage.kind === 'rotunda')
      addRotunda(building, authoredUnit, geometry, materials)
    else if (stage.kind === 'twins')
      addTwinGalleries(
        building,
        authoredUnit,
        sculpturalUnit,
        architecturalUnit,
        geometry,
        materials,
      )
    else
      addConservatory(
        building,
        authoredUnit,
        architecturalUnit,
        geometry,
        materials,
      )
    stageRoot.add(building)
    addMedallion(stageRoot, stage, stageIndex, geometry, materials, starMarkers)
    if (stage.portrait !== undefined)
      addPortraitMonument(
        stageRoot,
        stage.id,
        stage.portrait,
        authoredUnit,
        materials,
        portraitSurfaces,
        portraitMysteries,
      )
    markSelectable(stageRoot, stage.id)
    selectableRoots.set(stage.id, stageRoot)
    root.add(stageRoot)
  }

  for (const bridge of definition.bridges)
    root.add(createJourneyBridge(bridge, materials, ownedGeometries))

  return {
    root,
    selectableRoots,
    portraitSurfaces,
    portraitMysteries,
    starMarkers,
  }
}
