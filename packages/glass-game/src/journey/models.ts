// Journey models — assemble four map-scale islands from one reusable authored kit.

import type { Material, Object3D } from 'three'
import { AnimationMixer, Box3, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, } from 'three'
import type { MuseumJourneyBridge, MuseumJourneyDefinition, MuseumJourneyStage, } from '../content/museum-journey'
import type { JourneyGltfDocument } from './resources'
import { loadJourneyGltf } from './resources'

const REQUIRED_NODES = [
  'map_canopy',
  'map_column',
  'map_planter',
  'map_frame',
  'map_platform',
  'map_bridge',
  'map_island_root',
] as const

const MAP_BRIDGE_WIDTH = 1.1
const MAP_BRIDGE_LENGTH = 3.323364

export interface JourneyMapModels {
  root: Group
  selectableRoots: ReadonlyMap<string, Object3D>
  setSelected(stage: MuseumJourneyStage, immediate?: boolean): void
  update(dt: number, reducedMotion: boolean): void
  dispose(): void
}

export function journeyBridgeTransform(bridge: MuseumJourneyBridge) {
  const dx = bridge.to[0] - bridge.from[0]
  const dy = bridge.to[1] - bridge.from[1]
  const dz = bridge.to[2] - bridge.from[2]
  const horizontalLength = Math.hypot(dx, dz)
  const length = Math.hypot(horizontalLength, dy)
  const yaw = Math.atan2(dx, dz)
  const pitch = -Math.atan2(dy, horizontalLength)
  const yawRotation = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    yaw,
  )
  const pitchRotation = new Quaternion().setFromAxisAngle(
    new Vector3(1, 0, 0),
    pitch,
  )
  return {
    position: new Vector3(
      (bridge.from[0] + bridge.to[0]) / 2,
      (bridge.from[1] + bridge.to[1]) / 2,
      (bridge.from[2] + bridge.to[2]) / 2,
    ),
    rotation: yawRotation.multiply(pitchRotation),
    scale: new Vector3(
      bridge.width / MAP_BRIDGE_WIDTH,
      1,
      length / MAP_BRIDGE_LENGTH,
    ),
  }
}

function authoredUnit(document: JourneyGltfDocument, name: string): Object3D {
  const source = document.scene.getObjectByName(name)
  if (source === undefined)
    throw new Error(`Journey map kit is missing ${name}.`)
  const clone = source.clone(true)
  clone.position.set(0, 0, 0)
  clone.rotation.set(0, 0, 0)
  clone.scale.set(1, 1, 1)
  clone.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  return clone
}

function markSelectable(root: Object3D, stageId: string): void {
  root.traverse((object) => {
    object.userData.journeyStageId = stageId
  })
}

function addColumns(
  root: Group,
  document: JourneyGltfDocument,
  positions: readonly (readonly [number, number])[],
  scale = 0.72,
): void {
  for (const [x, z] of positions) {
    const column = authoredUnit(document, 'map_column')
    column.position.set(x, 0.02, z)
    column.scale.setScalar(scale)
    root.add(column)
  }
}

function addArchitecture(
  root: Group,
  document: JourneyGltfDocument,
  stage: MuseumJourneyStage,
  accentMaterials: Readonly<Record<string, Material>>,
  ownedGeometries: Set<CylinderGeometry | SphereGeometry>,
): void {
  const platform = authoredUnit(document, 'map_platform')
  platform.position.y = 0.03
  platform.scale.set(1.18, 1, 1.18)
  root.add(platform)

  if (stage.kind === 'pavilion') {
    const canopy = authoredUnit(document, 'map_canopy')
    canopy.scale.setScalar(0.72)
    root.add(canopy)
    addColumns(
      root,
      document,
      [
        [-0.75, -0.7],
        [0.75, -0.7],
        [-0.75, 0.7],
        [0.75, 0.7],
      ],
      0.58,
    )
    for (const x of [-1.27, 1.27]) {
      const planter = authoredUnit(document, 'map_planter')
      planter.position.set(x, 0.04, 0.48)
      planter.scale.setScalar(0.42)
      root.add(planter)
    }
  } else if (stage.kind === 'rotunda') {
    const canopy = authoredUnit(document, 'map_canopy')
    canopy.scale.set(1.05, 0.88, 1.05)
    root.add(canopy)
    addColumns(root, document, [
      [-1.05, 0],
      [1.05, 0],
      [0, -1.05],
      [0, 1.05],
    ])
    const frame = authoredUnit(document, 'map_frame')
    frame.position.set(0, 0.08, 1.17)
    frame.rotation.y = Math.PI
    frame.scale.setScalar(0.8)
    root.add(frame)
    for (const [x, z] of [
      [-1.38, 0.58],
      [1.38, 0.58],
      [0, -1.42],
    ] as const) {
      const planter = authoredUnit(document, 'map_planter')
      planter.position.set(x, 0.04, z)
      planter.scale.setScalar(0.43)
      root.add(planter)
    }
  } else if (stage.kind === 'twins') {
    for (const x of [-0.78, 0.78]) {
      const canopy = authoredUnit(document, 'map_canopy')
      canopy.position.set(x, 0.02, 0)
      canopy.scale.setScalar(0.53)
      root.add(canopy)
    }
    const domeGeometry = new SphereGeometry(
      0.57,
      24,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    )
    ownedGeometries.add(domeGeometry)
    const amber = new Mesh(domeGeometry, accentMaterials.amber)
    amber.name = 'twin-amber-dome'
    amber.position.set(-0.78, 1.02, 0)
    amber.scale.y = 0.88
    const celadon = new Mesh(domeGeometry, accentMaterials.celadon)
    celadon.name = 'twin-celadon-dome'
    celadon.position.set(0.78, 1.02, 0)
    celadon.scale.y = 0.88
    root.add(amber, celadon)
    for (const [x, z] of [
      [-1.48, 0.68],
      [1.48, 0.68],
      [0, -1.38],
    ] as const) {
      const planter = authoredUnit(document, 'map_planter')
      planter.position.set(x, 0.04, z)
      planter.scale.setScalar(0.4)
      root.add(planter)
    }
  } else {
    const canopy = authoredUnit(document, 'map_canopy')
    canopy.scale.set(1.12, 0.84, 1.12)
    root.add(canopy)
    for (const [x, z, turn] of [
      [-0.9, -0.65, 0],
      [0.9, -0.65, 0.8],
      [-0.95, 0.7, -0.5],
      [0.95, 0.72, 0.35],
      [0, 1.05, 0.1],
    ] as const) {
      const planter = authoredUnit(document, 'map_planter')
      planter.position.set(x, 0.04, z)
      planter.rotation.y = turn
      planter.scale.setScalar(0.66)
      root.add(planter)
    }
  }
}

function createGoldTrail(
  definition: MuseumJourneyDefinition,
  material: Material,
  ownedGeometries: Set<CylinderGeometry | SphereGeometry>,
): InstancedMesh {
  const points = definition.bridges.flatMap((bridge) => {
    const distance = Math.hypot(
      bridge.to[0] - bridge.from[0],
      bridge.to[2] - bridge.from[2],
    )
    const count = Math.max(2, Math.floor(distance / 0.5))
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count
      return new Vector3(
        bridge.from[0] + (bridge.to[0] - bridge.from[0]) * t,
        bridge.from[1] + (bridge.to[1] - bridge.from[1]) * t + 0.08,
        bridge.from[2] + (bridge.to[2] - bridge.from[2]) * t,
      )
    })
  })
  const geometry = new CylinderGeometry(0.055, 0.07, 0.025, 12)
  ownedGeometries.add(geometry)
  const trail = new InstancedMesh(geometry, material, points.length)
  const matrix = new Matrix4()
  points.forEach((position, index) => {
    matrix.makeTranslation(position.x, position.y, position.z)
    trail.setMatrixAt(index, matrix)
  })
  trail.instanceMatrix.needsUpdate = true
  trail.name = 'gold-journey-trail'
  return trail
}

function createAssembly(
  definition: MuseumJourneyDefinition,
  document: JourneyGltfDocument,
) {
  for (const name of REQUIRED_NODES) authoredUnit(document, name)
  const root = new Group()
  root.name = 'floating-museum-architecture'
  const selectableRoots = new Map<string, Object3D>()
  const ownedGeometries = new Set<CylinderGeometry | SphereGeometry>()
  const materials = {
    gold: new MeshStandardMaterial({
      color: 0xbd8e43,
      metalness: 0.72,
      roughness: 0.24,
    }),
    jade: new MeshStandardMaterial({
      color: 0x224943,
      metalness: 0.08,
      roughness: 0.48,
    }),
    amber: new MeshPhysicalMaterial({
      color: 0xedc07a,
      transparent: true,
      opacity: 0.76,
      metalness: 0.16,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      side: DoubleSide,
    }),
    celadon: new MeshPhysicalMaterial({
      color: 0x85bec0,
      transparent: true,
      opacity: 0.76,
      metalness: 0.14,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      side: DoubleSide,
    }),
  }

  for (const stage of definition.stages) {
    const stageRoot = new Group()
    stageRoot.name = stage.id
    stageRoot.position.fromArray(stage.position)
    stageRoot.rotation.y = stage.yaw
    stageRoot.scale.setScalar(stage.scale)
    const island = authoredUnit(document, 'map_island_root')
    island.scale.set(1.75, 1.18, 1.75)
    stageRoot.add(island)
    addArchitecture(stageRoot, document, stage, materials, ownedGeometries)
    markSelectable(stageRoot, stage.id)
    selectableRoots.set(stage.id, stageRoot)
    root.add(stageRoot)
  }

  for (const bridge of definition.bridges) {
    const model = authoredUnit(document, 'map_bridge')
    const transform = journeyBridgeTransform(bridge)
    model.name = bridge.id
    model.position.copy(transform.position)
    model.quaternion.copy(transform.rotation)
    model.scale.copy(transform.scale)
    root.add(model)
  }
  const trail = createGoldTrail(definition, materials.gold, ownedGeometries)
  root.add(trail)
  return { root, selectableRoots, materials, ownedGeometries, trail }
}

function createMerc(document: JourneyGltfDocument, first: MuseumJourneyStage) {
  const body = document.scene
  const bounds = new Box3().setFromObject(body)
  const height = Math.max(0.001, bounds.getSize(new Vector3()).y)
  const ground = bounds.min.y
  const scale = 0.68 / height
  body.scale.setScalar(scale)
  body.position.y = -ground * scale
  const metal = new MeshPhysicalMaterial({
    color: 0xf4f7f8,
    metalness: 1,
    roughness: 0.07,
    iridescence: 0.8,
    iridescenceIOR: 1.65,
    iridescenceThicknessRange: [120, 460],
    envMapIntensity: 1.25,
  })
  const replacedMaterials = new Set<Material>()
  body.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (mesh.name === 'merc_body' || mesh.name.startsWith('merc_hand')) {
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        replacedMaterials.add(material)
      mesh.material = metal
    }
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  replacedMaterials.forEach((material) => material.dispose())
  const root = new Group()
  root.name = 'journey-merc'
  root.add(body)
  root.position.fromArray(first.merc)
  const target = new Vector3().fromArray(first.merc)
  const mixer = new AnimationMixer(body)
  const idle =
    document.animations.find((clip) => /listen|idle/i.test(clip.name)) ??
    document.animations[0]
  if (idle !== undefined) mixer.clipAction(idle).play()
  return {
    root,
    setTarget(stage: MuseumJourneyStage, immediate: boolean) {
      target.fromArray(stage.merc)
      if (immediate) root.position.copy(target)
    },
    update(dt: number, reducedMotion: boolean) {
      const safeDt = Math.max(0, Math.min(0.05, dt))
      mixer.update(reducedMotion ? 0 : safeDt)
      if (reducedMotion) root.position.copy(target)
      else root.position.lerp(target, 1 - Math.exp(-4.8 * safeDt))
      root.position.y += reducedMotion ? 0 : Math.sin(mixer.time * 1.6) * 0.0005
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(body)
      document.dispose()
    },
  }
}

export async function loadJourneyMapModels(
  definition: MuseumJourneyDefinition,
  mapUrl: string,
  mercUrl: string,
  signal: AbortSignal,
  options: {
    loadGltf?: typeof loadJourneyGltf
  } = {},
): Promise<JourneyMapModels> {
  const loadGltf = options.loadGltf ?? loadJourneyGltf
  const loaded = await Promise.allSettled([
    loadGltf(mapUrl, signal),
    loadGltf(mercUrl, signal),
  ])
  const rejected = loaded.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (rejected !== undefined) {
    for (const result of loaded)
      if (result.status === 'fulfilled') result.value.dispose()
    throw rejected.reason
  }
  const [kitDocument, mercDocument] = loaded.map(
    (result) => (result as PromiseFulfilledResult<JourneyGltfDocument>).value,
  )
  if (signal.aborted) {
    kitDocument.dispose()
    mercDocument.dispose()
    throw new DOMException('Journey asset load cancelled.', 'AbortError')
  }
  let assembly: ReturnType<typeof createAssembly>
  try {
    assembly = createAssembly(definition, kitDocument)
  } catch (error) {
    kitDocument.dispose()
    mercDocument.dispose()
    throw error
  }
  const merc = createMerc(mercDocument, definition.stages[0]!)
  assembly.root.add(merc.root)
  let disposed = false
  return {
    root: assembly.root,
    selectableRoots: assembly.selectableRoots,
    setSelected(stage, immediate = false) {
      if (!disposed) merc.setTarget(stage, immediate)
    },
    update(dt, reducedMotion) {
      if (!disposed) merc.update(dt, reducedMotion)
    },
    dispose() {
      if (disposed) return
      disposed = true
      assembly.root.removeFromParent()
      merc.dispose()
      kitDocument.dispose()
      assembly.trail.dispose()
      assembly.ownedGeometries.forEach((geometry) => geometry.dispose())
      Object.values(assembly.materials).forEach((material) =>
        material.dispose(),
      )
    },
  }
}
