// Journey models — assemble three authored landmasses with four stable chapter medallions.

import type { BufferGeometry, Material, Mesh, Object3D, Texture } from 'three'
import { CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, } from 'three'
import type { MuseumJourneyDefinition, MuseumJourneyStage, } from '../content/museum-journey'
import type { JourneyAuthoredUnit } from './architecture'
import { createJourneyArchitecture, findJourneyPortraitInset, } from './architecture'
import { createJourneyBridgePath } from './bridge-path'
import { createJourneyMerc } from './merc'
import { createJourneyPondBorders } from './ponds'
import { disposeJourneyPortraitTexture, fitJourneyPortraitTexture, loadJourneyPortraitTexture, } from './portrait-texture'
import type { JourneyGltfDocument } from './resources'
import { loadJourneyGltf } from './resources'
import type { JourneyMarbleTextures, JourneyMarbleTextureUrls, } from './surface-textures'
import { loadJourneyMarbleTextures } from './surface-textures'
import { JOURNEY_TERRACE_SURFACE_OFFSET } from './terrace-layout'
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

// Normalize the sculpted 4.5 x 2.464 m top footprint to the original
// 2.622 x 2.602 m kit unit before applying each authored landmass scale.
const SCULPTED_CLIFF_SCALE_X = 2.621731 / 4.5
const SCULPTED_CLIFF_SCALE_Z = 2.602302 / 2.464056
const SCULPTED_CLIFF_SCALE_Y = 2.25
interface JourneyTerraceMaterials {
  ivory: Material
  terraceMarble: Material
  gold: Material
  jade: Material
}

export interface JourneyMapModels {
  root: Group
  selectableRoots: ReadonlyMap<string, Object3D>
  /** Save-derived visuals are applied by the scene-owned progress display. */
  portraitSurfaces: ReadonlyMap<string, Mesh>
  portraitMysteries: ReadonlyMap<string, Object3D>
  starMarkers: ReadonlyMap<string, readonly [Object3D, Object3D, Object3D]>
  setSelected(stage: MuseumJourneyStage, immediate?: boolean): void
  update(dt: number, reducedMotion: boolean): void
  dispose(): void
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
  materials: JourneyTerraceMaterials,
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
    terrace.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const finish = (material: Material): Material => {
        if (material.name === 'map_ivory_marble') return materials.ivory
        if (material.name === 'map_archival_marble')
          return materials.terraceMarble
        if (material.name === 'map_champagne_gold') return materials.gold
        if (
          material.name === 'map_celadon_inlay' ||
          material.name === 'map_dark_jade'
        )
          return materials.jade
        return material
      }
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(finish)
        : finish(mesh.material)
    })
    terrace.position.fromArray(island.position)
    terrace.position.y += JOURNEY_TERRACE_SURFACE_OFFSET
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
    const path = createJourneyBridgePath(bridge)
    const count = Math.max(2, Math.floor(path.curve.getLength() / 0.42))
    return Array.from({ length: count }, (_, index) => {
      const t = (index + 0.5) / count
      const point = path.point(
        path.steps === 1 ? t : (Math.floor(t * path.steps) + 0.5) / path.steps,
      )
      point.y += 0.008
      return point
    })
  })
  const geometry = new CylinderGeometry(0.043, 0.046, 0.012, 12)
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
  architectureDocument: JourneyGltfDocument | undefined,
  mysteryTexture: Texture | undefined,
  marbleTextures: JourneyMarbleTextures | undefined,
) {
  for (const name of REQUIRED_NODES) {
    const unit = authoredUnit(document, name)
    if (name === 'map_frame') findJourneyPortraitInset(unit)
  }
  if (sculptureDocument !== undefined) {
    authoredUnit(sculptureDocument, 'map_temple_amber')
    authoredUnit(sculptureDocument, 'map_temple_teal')
    authoredUnit(sculptureDocument, 'map_cliff')
    authoredUnit(sculptureDocument, 'map_cypress')
    authoredUnit(sculptureDocument, 'map_flower_cluster')
  }
  if (architectureDocument !== undefined) {
    authoredUnit(architectureDocument, 'map_twin_connector')
    authoredUnit(architectureDocument, 'map_conservatory')
  }
  const root = new Group()
  root.name = 'floating-museum-architecture'
  const ownedGeometries = new Set<BufferGeometry>()
  const materials = {
    mysteryPortrait: new MeshBasicMaterial({
      color: mysteryTexture === undefined ? 0x235c56 : 0xffffff,
      map: mysteryTexture ?? null,
      side: DoubleSide,
      toneMapped: false,
    }),
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
    medallionGlass: new MeshStandardMaterial({
      color: 0x2d756d,
      emissive: 0x0b403b,
      emissiveIntensity: 0.34,
      metalness: 0.08,
      roughness: 0.2,
    }),
    ivory: new MeshStandardMaterial({
      color: 0xf5eee2,
      map: marbleTextures?.map ?? null,
      normalMap: marbleTextures?.normalMap ?? null,
      normalScale: new Vector2(0.18, 0.18),
      roughnessMap: marbleTextures?.roughnessMap ?? null,
      metalness: 0.02,
      roughness: 0.68,
    }),
    terraceMarble: new MeshStandardMaterial({
      color: 0xf2ebda,
      map: marbleTextures?.map ?? null,
      normalMap: marbleTextures?.normalMap ?? null,
      normalScale: new Vector2(0.14, 0.14),
      roughnessMap: marbleTextures?.roughnessMap ?? null,
      metalness: 0.01,
      roughness: 0.76,
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
  const architectural: JourneyAuthoredUnit | undefined =
    architectureDocument === undefined
      ? undefined
      : (name) => authoredUnit(architectureDocument, name)
  root.add(createLandmasses(definition, authored, sculptural, materials))
  const architecture = createJourneyArchitecture(
    definition,
    authored,
    sculptural,
    architectural,
    materials,
    ownedGeometries,
  )
  if (mysteryTexture !== undefined) {
    const inset = architecture.portraitSurfaces.values().next().value
    if (inset !== undefined) fitJourneyPortraitTexture(mysteryTexture, inset)
  }
  root.add(architecture.root)
  root.add(
    createJourneyPondBorders(definition, materials.ivory, ownedGeometries),
  )
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
    portraitMysteries: architecture.portraitMysteries,
    starMarkers: architecture.starMarkers,
    materials,
    ownedGeometries,
  }
}

function disposeAssembly(assembly: ReturnType<typeof createAssembly>): void {
  assembly.root.removeFromParent()
  assembly.root.traverse((object) => {
    if (object instanceof InstancedMesh) object.dispose()
  })
  assembly.ownedGeometries.forEach((geometry) => geometry.dispose())
  Object.values(assembly.materials).forEach((material) => material.dispose())
}

export async function loadJourneyMapModels(
  definition: MuseumJourneyDefinition,
  mapUrl: string,
  mercUrl: string,
  signal: AbortSignal,
  options: {
    loadGltf?: typeof loadJourneyGltf
    sculptureUrl?: string
    architectureUrl?: string
    mysteryPortraitUrl?: string
    loadTexture?: typeof loadJourneyPortraitTexture
    marbleTextureUrls?: JourneyMarbleTextureUrls
    loadMarbleTextures?: typeof loadJourneyMarbleTextures
  } = {},
): Promise<JourneyMapModels> {
  const loadGltf = options.loadGltf ?? loadJourneyGltf
  const mapRequest = loadGltf(mapUrl, signal)
  const mercRequest = loadGltf(mercUrl, signal)
  const sculptureRequest =
    options.sculptureUrl === undefined
      ? Promise.resolve(undefined)
      : loadGltf(options.sculptureUrl, signal)
  const architectureRequest =
    options.architectureUrl === undefined
      ? Promise.resolve(undefined)
      : loadGltf(options.architectureUrl, signal)
  const portraitRequest =
    options.mysteryPortraitUrl === undefined
      ? Promise.resolve(undefined)
      : (options.loadTexture ?? loadJourneyPortraitTexture)(
          options.mysteryPortraitUrl,
          signal,
        ).then((texture) => ({
          texture,
          dispose: () => disposeJourneyPortraitTexture(texture),
        }))
  const marbleRequest =
    options.marbleTextureUrls === undefined
      ? Promise.resolve(undefined)
      : (options.loadMarbleTextures ?? loadJourneyMarbleTextures)(
          options.marbleTextureUrls,
          signal,
        )
  const loaded = await Promise.allSettled([
    mapRequest,
    mercRequest,
    sculptureRequest,
    architectureRequest,
    portraitRequest,
    marbleRequest,
  ] as const)
  const rejected = loaded.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  )
  if (rejected !== undefined) {
    for (const result of loaded)
      if (result.status === 'fulfilled') result.value?.dispose()
    throw rejected.reason
  }
  const kitDocument = (loaded[0] as PromiseFulfilledResult<JourneyGltfDocument>)
    .value
  const mercDocument = (
    loaded[1] as PromiseFulfilledResult<JourneyGltfDocument>
  ).value
  const sculptureDocument = (
    loaded[2] as PromiseFulfilledResult<JourneyGltfDocument | undefined>
  ).value
  const architectureDocument = (
    loaded[3] as PromiseFulfilledResult<JourneyGltfDocument | undefined>
  ).value
  const portrait = (
    loaded[4] as PromiseFulfilledResult<
      { texture: Texture; dispose(): void } | undefined
    >
  ).value
  const marbleTextures = (
    loaded[5] as PromiseFulfilledResult<JourneyMarbleTextures | undefined>
  ).value
  const retireLoaded = (): void => {
    kitDocument.dispose()
    mercDocument.dispose()
    sculptureDocument?.dispose()
    architectureDocument?.dispose()
    portrait?.dispose()
    marbleTextures?.dispose()
  }
  if (signal.aborted) {
    retireLoaded()
    throw new DOMException('Journey asset load cancelled.', 'AbortError')
  }
  let assembly: ReturnType<typeof createAssembly>
  try {
    assembly = createAssembly(
      definition,
      kitDocument,
      sculptureDocument,
      architectureDocument,
      portrait?.texture,
      marbleTextures,
    )
  } catch (error) {
    retireLoaded()
    throw error
  }
  let merc: ReturnType<typeof createJourneyMerc>
  try {
    merc = createJourneyMerc(mercDocument, definition.stages[0]!)
  } catch (error) {
    disposeAssembly(assembly)
    retireLoaded()
    throw error
  }
  assembly.root.add(merc.root)
  let disposed = false
  return {
    root: assembly.root,
    selectableRoots: assembly.selectableRoots,
    portraitSurfaces: assembly.portraitSurfaces,
    portraitMysteries: assembly.portraitMysteries,
    starMarkers: assembly.starMarkers,
    setSelected(stage, immediate = false) {
      if (!disposed) merc.setTarget(stage, immediate)
    },
    update(dt, reducedMotion) {
      if (!disposed) merc.update(dt, reducedMotion)
    },
    dispose() {
      if (disposed) return
      disposed = true
      disposeAssembly(assembly)
      merc.dispose()
      kitDocument.dispose()
      sculptureDocument?.dispose()
      architectureDocument?.dispose()
      portrait?.dispose()
      marbleTextures?.dispose()
    },
  }
}
