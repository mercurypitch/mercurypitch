// Journey architecture — compose authored kit pieces into palatial halls, medallions and arched paths.

import type { BufferGeometry, Material, Object3D } from 'three'
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, Group, InstancedMesh, Matrix4, Mesh, OctahedronGeometry, PlaneGeometry, QuadraticBezierCurve3, Quaternion, RingGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector3, } from 'three'
import type { MuseumJourneyBridge, MuseumJourneyDefinition, MuseumJourneyPortraitMonument, MuseumJourneyStage, } from '../content/museum-journey'

export interface JourneyArchitectureMaterials {
  gold: Material
  jade: Material
  ivory: Material
  amber: Material
  celadon: Material
  clearGlass: Material
  shadow: Material
  crystal: Material
}

export type JourneyAuthoredUnit = (name: string) => Object3D

interface ArchitectureGeometry {
  base: CylinderGeometry
  step: BoxGeometry
  dome: SphereGeometry
  medallion: CylinderGeometry
  medallionRing: RingGeometry
  connectorArch: TorusGeometry
  portraitPanel: PlaneGeometry
  portraitFace: SphereGeometry
  portraitBust: SphereGeometry
  crystal: OctahedronGeometry
}

export interface JourneyArchitectureAssembly {
  root: Group
  selectableRoots: ReadonlyMap<string, Object3D>
  portraitSurfaces: ReadonlyMap<string, Mesh>
}

function own<T extends BufferGeometry>(
  geometry: T,
  owned: Set<BufferGeometry>,
): T {
  owned.add(geometry)
  return geometry
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
    connectorArch: own(new TorusGeometry(1, 0.075, 8, 32, Math.PI), owned),
    portraitPanel: own(new PlaneGeometry(0.82, 1.34), owned),
    portraitFace: own(new SphereGeometry(0.16, 14, 8), owned),
    portraitBust: own(new SphereGeometry(0.3, 14, 8), owned),
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
  width: number,
  frontZ: number,
): void {
  const count = 6
  const stairs = new InstancedMesh(geometry.step, material, count)
  stairs.name = 'ivory-processional-stairway'
  stairs.castShadow = true
  stairs.receiveShadow = true
  const matrix = new Matrix4()
  for (let index = 0; index < count; index++) {
    const progress = index / Math.max(1, count - 1)
    matrix.compose(
      new Vector3(0, 0.035 + index * 0.045, frontZ - index * 0.16),
      new Quaternion(),
      new Vector3(width - progress * 0.2, 0.07, 0.25),
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
  const temple = sculpturalUnit?.('map_temple')
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
  addStairway(root, geometry, materials.ivory, 1.55, 1.32)
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
  addStairway(root, geometry, materials.ivory, 1.15, 0.92)
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
  addStairway(root, geometry, materials.ivory, 1.78, 1.5)
}

function addTwinGalleries(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  for (const [x, glass] of [
    [-0.9, materials.amber],
    [0.9, materials.celadon],
  ] as const) {
    const temple = sculpturalUnit?.('map_temple')
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

  const arch = new Mesh(geometry.connectorArch, materials.gold)
  arch.name = 'twin-gallery-canopy-arch'
  arch.position.set(0, 1.46, 0.02)
  arch.scale.set(0.44, 0.34, 1)
  arch.castShadow = true
  root.add(arch)
  addStairway(root, geometry, materials.ivory, 2.25, 1.45)
  addCrystalCluster(root, geometry, materials.crystal, 0, 0.9)
}

function addConservatory(
  root: Group,
  authoredUnit: JourneyAuthoredUnit,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
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
  addStairway(root, geometry, materials.ivory, 2.05, 1.72)
  addCrystalCluster(root, geometry, materials.crystal, -1.24, 0.88)
}

function addMedallion(
  stageRoot: Group,
  stage: MuseumJourneyStage,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
): void {
  const medallion = new Mesh(geometry.medallion, materials.gold)
  medallion.name = `${stage.id}-path-medallion`
  medallion.position.fromArray(stage.position)
  // The authored stairs and promenade sit above the terrace surface. Sink the
  // pedestal into that surface and lift its face clear of those ribbons.
  medallion.position.y += 0.05
  medallion.scale.set(0.5, 2.6, 0.5)
  medallion.castShadow = true
  medallion.receiveShadow = true
  const face = new Mesh(geometry.medallion, materials.jade)
  face.name = `${stage.id}-medallion-face`
  face.position.fromArray(stage.position)
  face.position.y += 0.153
  face.scale.set(0.36, 0.14, 0.36)
  const ring = new Mesh(geometry.medallionRing, materials.gold)
  ring.name = `${stage.id}-medallion-ring`
  ring.rotation.x = -Math.PI / 2
  ring.position.fromArray(stage.position)
  ring.position.y += 0.16
  ring.scale.setScalar(0.52)
  stageRoot.add(medallion, face, ring)
}

function addPortraitMonument(
  stageRoot: Group,
  stageId: string,
  portrait: MuseumJourneyPortraitMonument,
  authoredUnit: JourneyAuthoredUnit,
  geometry: ArchitectureGeometry,
  materials: JourneyArchitectureMaterials,
  portraitSurfaces: Map<string, Mesh>,
): void {
  const monument = new Group()
  monument.name = `${portrait.portraitId}-monument`
  monument.position.fromArray(portrait.position)
  monument.rotation.y = portrait.yaw
  const frame = authoredUnit('map_frame')
  frame.rotation.y = Math.PI
  frame.scale.setScalar(0.72)
  monument.add(frame)

  const surface = new Mesh(geometry.portraitPanel, materials.jade)
  surface.name = `${portrait.portraitId}-surface`
  surface.position.set(0, 0.63, 0.015)
  surface.scale.set(0.72, 0.72, 1)
  surface.userData.journeyPortraitId = portrait.portraitId
  surface.userData.journeyPortraitState = 'mystery'
  monument.add(surface)

  const face = new Mesh(geometry.portraitFace, materials.shadow)
  face.position.set(0, 0.82, 0.04)
  face.scale.set(0.82, 0.96, 0.16)
  const neck = new Mesh(geometry.step, materials.shadow)
  neck.position.set(0, 0.64, 0.04)
  neck.scale.set(0.11, 0.18, 0.03)
  const bust = new Mesh(geometry.portraitBust, materials.shadow)
  bust.position.set(0, 0.48, 0.04)
  bust.scale.set(0.95, 0.48, 0.12)
  monument.add(face, neck, bust)
  portraitSurfaces.set(portrait.portraitId, surface)
  markSelectable(monument, stageId)
  stageRoot.add(monument)
}

function createBridge(
  bridge: MuseumJourneyBridge,
  materials: JourneyArchitectureMaterials,
  owned: Set<BufferGeometry>,
): Group {
  const root = new Group()
  root.name = bridge.id
  const from = new Vector3().fromArray(bridge.from)
  const to = new Vector3().fromArray(bridge.to)
  const delta = to.clone().sub(from)
  const length = delta.length()
  const lateral = new Vector3(-delta.z, 0, delta.x).normalize()
  const midpoint = from.clone().lerp(to, 0.5)
  midpoint.addScaledVector(lateral, bridge.curve)
  midpoint.y += bridge.kind === 'skybridge' ? 0.2 : 0.035
  const curve = new QuadraticBezierCurve3(from, midpoint, to)
  const segmentCount = Math.max(6, Math.ceil(length / 0.32))
  const deckGeometry = own(new BoxGeometry(1, 1, 1), owned)
  const deck = new InstancedMesh(deckGeometry, materials.ivory, segmentCount)
  deck.name = `${bridge.id}-curved-promenade`
  deck.castShadow = true
  deck.receiveShadow = true
  const edgeGeometry = own(new BoxGeometry(1, 1, 1), owned)
  const edges = new InstancedMesh(
    edgeGeometry,
    materials.gold,
    segmentCount * 2,
  )
  edges.name = `${bridge.id}-gold-edges`
  const matrix = new Matrix4()
  const quaternion = new Quaternion()
  const zAxis = new Vector3(0, 0, 1)
  for (let index = 0; index < segmentCount; index++) {
    const t = (index + 0.5) / segmentCount
    const point = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    quaternion.setFromUnitVectors(zAxis, tangent)
    matrix.compose(
      point,
      quaternion,
      new Vector3(bridge.width, 0.12, (length / segmentCount) * 1.18),
    )
    deck.setMatrixAt(index, matrix)
    const side = new Vector3(-tangent.z, 0, tangent.x).normalize()
    for (const sideIndex of [-1, 1] as const) {
      matrix.compose(
        point.clone().addScaledVector(side, sideIndex * bridge.width * 0.46),
        quaternion,
        new Vector3(0.055, 0.055, (length / segmentCount) * 1.2),
      )
      edges.setMatrixAt(index * 2 + (sideIndex === -1 ? 0 : 1), matrix)
    }
  }
  deck.instanceMatrix.needsUpdate = true
  edges.instanceMatrix.needsUpdate = true
  root.add(deck, edges)

  if (bridge.kind === 'skybridge') {
    for (const sideSign of [-1, 1] as const) {
      const side = lateral
        .clone()
        .multiplyScalar(sideSign * bridge.width * 0.42)
      const archCurve = new CatmullRomCurve3([
        from
          .clone()
          .add(side)
          .add(new Vector3(0, -0.72, 0)),
        midpoint
          .clone()
          .add(side)
          .add(new Vector3(0, -0.12, 0)),
        to
          .clone()
          .add(side)
          .add(new Vector3(0, -0.72, 0)),
      ])
      const archGeometry = own(
        new TubeGeometry(archCurve, 20, 0.045, 6, false),
        owned,
      )
      const arch = new Mesh(archGeometry, materials.gold)
      arch.name = `${bridge.id}-supporting-arch`
      arch.castShadow = true
      root.add(arch)
    }
  }
  return root
}

export function createJourneyArchitecture(
  definition: MuseumJourneyDefinition,
  authoredUnit: JourneyAuthoredUnit,
  sculpturalUnit: JourneyAuthoredUnit | undefined,
  materials: JourneyArchitectureMaterials,
  ownedGeometries: Set<BufferGeometry>,
): JourneyArchitectureAssembly {
  const root = new Group()
  root.name = 'floating-museum-palaces'
  const selectableRoots = new Map<string, Object3D>()
  const portraitSurfaces = new Map<string, Mesh>()
  const geometry = createGeometry(ownedGeometries)

  for (const stage of definition.stages) {
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
        geometry,
        materials,
      )
    else addConservatory(building, authoredUnit, geometry, materials)
    stageRoot.add(building)
    addMedallion(stageRoot, stage, geometry, materials)
    if (stage.portrait !== undefined)
      addPortraitMonument(
        stageRoot,
        stage.id,
        stage.portrait,
        authoredUnit,
        geometry,
        materials,
        portraitSurfaces,
      )
    markSelectable(stageRoot, stage.id)
    selectableRoots.set(stage.id, stageRoot)
    root.add(stageRoot)
  }

  for (const bridge of definition.bridges)
    root.add(createBridge(bridge, materials, ownedGeometries))

  return { root, selectableRoots, portraitSurfaces }
}
