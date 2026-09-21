// Journey models — assemble three authored landmasses with four stable chapter medallions.

import type { BufferGeometry, Material, Mesh, Object3D } from 'three'
import { AnimationMixer, Box3, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, Quaternion, Vector3, } from 'three'
import type { MuseumJourneyBridge, MuseumJourneyDefinition, MuseumJourneyStage, } from '../content/museum-journey'
import type { JourneyAuthoredUnit } from './architecture'
import { createJourneyArchitecture } from './architecture'
import type { JourneyGltfDocument } from './resources'
import { loadJourneyGltf } from './resources'
import { createJourneyVegetation } from './vegetation'

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
// Normalize the sculpted 4.5 x 2.464 m top footprint to the original
// 2.622 x 2.602 m kit unit before applying each authored landmass scale.
const SCULPTED_CLIFF_SCALE_X = 2.621731 / 4.5
const SCULPTED_CLIFF_SCALE_Z = 2.602302 / 2.464056
const SCULPTED_CLIFF_SCALE_Y = 2.25

export interface JourneyMapModels {
  root: Group
  selectableRoots: ReadonlyMap<string, Object3D>
  /** Stable mystery surfaces that earned portrait art can replace later. */
  portraitSurfaces: ReadonlyMap<string, Mesh>
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

function createLandmasses(
  definition: MuseumJourneyDefinition,
  authored: JourneyAuthoredUnit,
  sculptural: JourneyAuthoredUnit | undefined,
): Group {
  const root = new Group()
  root.name = 'floating-museum-three-landmasses'
  for (const island of definition.landmasses) {
    const islandRoot = new Group()
    islandRoot.name = island.id
    const cliff = sculptural?.('map_cliff') ?? authored('map_island_root')
    cliff.name = `${island.id}-sculpted-cliff`
    cliff.position.fromArray(island.position)
    cliff.rotation.y = island.yaw
    cliff.scale.set(
      island.scale[0] * (sculptural === undefined ? 1 : SCULPTED_CLIFF_SCALE_X),
      island.scale[1] * (sculptural === undefined ? 1 : SCULPTED_CLIFF_SCALE_Y),
      island.scale[2] * (sculptural === undefined ? 1 : SCULPTED_CLIFF_SCALE_Z),
    )
    islandRoot.add(cliff)

    if (sculptural === undefined) {
      for (const [offsetX, offsetZ, scale] of [
        [-0.72, 0.18, 0.68],
        [0.68, -0.22, 0.62],
      ] as const) {
        const shoulder = authored('map_island_root')
        shoulder.name = `${island.id}-cliff-shoulder`
        shoulder.position.set(
          island.position[0] + offsetX * island.scale[0],
          island.position[1] - 0.18,
          island.position[2] + offsetZ * island.scale[2],
        )
        shoulder.rotation.y = island.yaw + offsetX * 0.08
        shoulder.scale.set(
          island.scale[0] * scale,
          island.scale[1] * (0.72 + scale * 0.2),
          island.scale[2] * scale,
        )
        islandRoot.add(shoulder)
      }
    }

    const terrace = authored('map_platform')
    terrace.name = `${island.id}-ivory-terrace`
    terrace.position.fromArray(island.position)
    terrace.position.y += 0.035
    terrace.rotation.y = island.yaw
    terrace.scale.fromArray(island.terraceScale)
    islandRoot.add(terrace)
    root.add(islandRoot)
  }
  return root
}

function createGoldTrail(
  definition: MuseumJourneyDefinition,
  material: Material,
  ownedGeometries: Set<BufferGeometry>,
): InstancedMesh {
  const points = definition.bridges.flatMap((bridge) => {
    const distance = Math.hypot(
      bridge.to[0] - bridge.from[0],
      bridge.to[2] - bridge.from[2],
    )
    const count = Math.max(2, Math.floor(distance / 0.42))
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count
      const bow = Math.sin(t * Math.PI)
      const dx = bridge.to[0] - bridge.from[0]
      const dz = bridge.to[2] - bridge.from[2]
      const horizontalLength = Math.max(0.001, Math.hypot(dx, dz))
      return new Vector3(
        bridge.from[0] + dx * t + (-dz / horizontalLength) * bridge.curve * bow,
        bridge.from[1] +
          (bridge.to[1] - bridge.from[1]) * t +
          (bridge.kind === 'skybridge' ? 0.2 : 0.035) * bow +
          0.11,
        bridge.from[2] + dz * t + (dx / horizontalLength) * bridge.curve * bow,
      )
    })
  })
  const geometry = new CylinderGeometry(0.052, 0.065, 0.026, 12)
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
  sculptureDocument: JourneyGltfDocument | undefined,
) {
  for (const name of REQUIRED_NODES) authoredUnit(document, name)
  if (sculptureDocument !== undefined) {
    authoredUnit(sculptureDocument, 'map_temple')
    authoredUnit(sculptureDocument, 'map_cliff')
    authoredUnit(sculptureDocument, 'map_cypress')
  }
  const root = new Group()
  root.name = 'floating-museum-architecture'
  const ownedGeometries = new Set<BufferGeometry>()
  const materials = {
    gold: new MeshStandardMaterial({
      color: 0xc79a45,
      emissive: 0x4c310b,
      emissiveIntensity: 0.12,
      metalness: 0.72,
      roughness: 0.22,
    }),
    jade: new MeshStandardMaterial({
      color: 0x174d47,
      metalness: 0.08,
      roughness: 0.42,
      side: DoubleSide,
    }),
    ivory: new MeshStandardMaterial({
      color: 0xeee3cf,
      metalness: 0.02,
      roughness: 0.36,
    }),
    amber: new MeshPhysicalMaterial({
      color: 0xf2bd6d,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      metalness: 0.06,
      roughness: 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: DoubleSide,
    }),
    celadon: new MeshPhysicalMaterial({
      color: 0x78c9c2,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      metalness: 0.05,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      side: DoubleSide,
    }),
    clearGlass: new MeshPhysicalMaterial({
      color: 0xd8f4ee,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      side: DoubleSide,
    }),
    shadow: new MeshStandardMaterial({
      color: 0xa68852,
      emissive: 0x3d2a0e,
      emissiveIntensity: 0.1,
      metalness: 0.18,
      roughness: 0.56,
    }),
    crystal: new MeshPhysicalMaterial({
      color: 0xbce6df,
      emissive: 0x2e827b,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      roughness: 0.14,
      side: DoubleSide,
    }),
    foliage: new MeshStandardMaterial({
      color: 0x3c7357,
      roughness: 0.7,
    }),
    darkFoliage: new MeshStandardMaterial({
      color: 0x174f3d,
      roughness: 0.72,
    }),
    trunk: new MeshStandardMaterial({
      color: 0x765c3d,
      roughness: 0.82,
    }),
    blossom: new MeshStandardMaterial({
      color: 0xefd2d1,
      roughness: 0.56,
    }),
  }
  const authored: JourneyAuthoredUnit = (name) => authoredUnit(document, name)
  const sculptural: JourneyAuthoredUnit | undefined =
    sculptureDocument === undefined
      ? undefined
      : (name) => authoredUnit(sculptureDocument, name)
  root.add(createLandmasses(definition, authored, sculptural))
  const architecture = createJourneyArchitecture(
    definition,
    authored,
    sculptural,
    materials,
    ownedGeometries,
  )
  root.add(architecture.root)
  root.add(
    createJourneyVegetation(
      definition,
      authored,
      sculptural,
      materials,
      ownedGeometries,
    ),
  )
  const trail = createGoldTrail(definition, materials.gold, ownedGeometries)
  root.add(trail)
  return {
    root,
    selectableRoots: architecture.selectableRoots,
    portraitSurfaces: architecture.portraitSurfaces,
    materials,
    ownedGeometries,
  }
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
      metal.dispose()
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
    sculptureUrl?: string
  } = {},
): Promise<JourneyMapModels> {
  const loadGltf = options.loadGltf ?? loadJourneyGltf
  const requests = [loadGltf(mapUrl, signal), loadGltf(mercUrl, signal)]
  if (options.sculptureUrl !== undefined)
    requests.push(loadGltf(options.sculptureUrl, signal))
  const loaded = await Promise.allSettled(requests)
  const rejected = loaded.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (rejected !== undefined) {
    for (const result of loaded)
      if (result.status === 'fulfilled') result.value.dispose()
    throw rejected.reason
  }
  const documents = loaded.map(
    (result) => (result as PromiseFulfilledResult<JourneyGltfDocument>).value,
  )
  const kitDocument = documents[0]!
  const mercDocument = documents[1]!
  const sculptureDocument = documents[2]
  if (signal.aborted) {
    for (const document of documents) document.dispose()
    throw new DOMException('Journey asset load cancelled.', 'AbortError')
  }
  let assembly: ReturnType<typeof createAssembly>
  try {
    assembly = createAssembly(definition, kitDocument, sculptureDocument)
  } catch (error) {
    for (const document of documents) document.dispose()
    throw error
  }
  const merc = createMerc(mercDocument, definition.stages[0]!)
  assembly.root.add(merc.root)
  let disposed = false
  return {
    root: assembly.root,
    selectableRoots: assembly.selectableRoots,
    portraitSurfaces: assembly.portraitSurfaces,
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
      assembly.root.traverse((object) => {
        if (object instanceof InstancedMesh) object.dispose()
      })
      merc.dispose()
      kitDocument.dispose()
      sculptureDocument?.dispose()
      assembly.ownedGeometries.forEach((geometry) => geometry.dispose())
      Object.values(assembly.materials).forEach((material) =>
        material.dispose(),
      )
    },
  }
}
