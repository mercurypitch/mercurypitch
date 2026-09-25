// Cloudway laboratory platform presentation — install accepted donors transactionally and leave pending crackles on honest fallbacks.

import type { Mesh, MeshStandardMaterial, Object3D } from 'three'
import { DynamicDrawUsage, Group, InstancedMesh, Matrix4, Vector3 } from 'three'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, PlatformRuntimeSnapshot, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'
import { CLOUDWAY_LAB_BUNDLE_IDS, CLOUDWAY_LAB_PLATFORM_RENDER_IDS, CLOUDWAY_LAB_ROOT_NAMES, CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS, } from './cloudway-laboratory-catalog'
import { validateCloudwayLaboratoryStaticDonor } from './cloudway-laboratory-static-contract'
import type { CloudwayScrollAdapter } from './cloudway-scroll-adapter'
import { createCloudwayScrollAdapter } from './cloudway-scroll-adapter'
import { disposeObject } from './dispose'
import { createKitInstance, removeKitGeometry } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

interface InstalledStaticBatch {
  enabledMask: string | undefined
  readonly instances: readonly {
    readonly matrix: Matrix4
    readonly platform: PlatformDefinition
  }[]
  readonly mesh: InstancedMesh
}

interface InstalledScroll {
  readonly adapter: CloudwayScrollAdapter
  readonly platform: PlatformDefinition
}

const EPSILON = 1e-6

function fail(detail: string): never {
  throw new Error(`Cloudway laboratory renderer: ${detail}`)
}

function exactNamedObject(source: Object3D, name: string): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object.name === name) matches.push(object)
  })
  if (matches.length !== 1)
    fail(`expected one donor root "${name}"; found ${matches.length}.`)
  return matches[0]!
}

function platformDimensions(platform: PlatformDefinition): {
  readonly depth: number
  readonly width: number
} {
  return {
    width: platform.maxX - platform.minX,
    depth: platform.maxZ - platform.minZ,
  }
}

function validateStaticPlatform(
  platform: PlatformDefinition,
  width: number,
  depth: number,
  height: number,
): number {
  const turns = platform.renderQuarterTurns ?? 0
  if (!PLATFORM_RENDER_QUARTER_TURNS.includes(turns))
    fail(`platform "${platform.id}" has invalid renderQuarterTurns.`)
  const expectedWidth = turns % 2 === 0 ? width : depth
  const expectedDepth = turns % 2 === 0 ? depth : width
  const dimensions = platformDimensions(platform)
  if (
    Math.abs(dimensions.width - expectedWidth) > EPSILON ||
    Math.abs(dimensions.depth - expectedDepth) > EPSILON ||
    Math.abs(platform.thickness - height) > EPSILON
  )
    fail(
      `platform "${platform.id}" must match certified ${expectedWidth} x ${expectedDepth} x ${height} metre contact.`,
    )
  return turns
}

function excludeDenseCameraCollision(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.userData.excludeFromCameraCollision = true
    mesh.castShadow = false
    mesh.receiveShadow = true
  })
}

function sourceMaterial(
  source: Object3D,
  meshName: string,
  materialLibrary: MaterialLibrary,
): MeshStandardMaterial {
  const mesh = exactNamedObject(source, meshName) as Mesh
  if (!mesh.isMesh || Array.isArray(mesh.material))
    fail(`material-bound node "${meshName}" must be one Mesh.`)
  const material = materialLibrary.clone(mesh.material) as MeshStandardMaterial
  if (!material.isMeshStandardMaterial)
    fail(`material-bound mesh "${meshName}" needs imported PBR material.`)
  return material
}

export function createCloudwayLaboratoryPlatformRenderer(
  level: LevelDefinition,
  sceneRoot: Group,
  floors: ReadonlyMap<string, Group>,
  materials: MuseumMaterials,
  materialLibrary: MaterialLibrary,
) {
  const pearlPlatforms = level.platforms.filter(
    (platform) =>
      platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.pearlRest,
  )
  const scrollPlatforms = level.platforms.filter(
    (platform) => platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.scroll,
  )
  const expectedBundles = new Set<string>()
  if (pearlPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.pearlRest)
  if (scrollPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.scroll)
  const coveredPlatformIds = new Set([
    ...pearlPlatforms.map((platform) => platform.id),
    ...scrollPlatforms.map((platform) => platform.id),
  ])
  const runtimeById = new Map<string, PlatformRuntimeSnapshot>()
  const root = new Group()
  root.name = 'cloudway-laboratory-platform-art'
  root.visible = false
  const stagedBundles = new Set<string>()
  const installedStatic: InstalledStaticBatch[] = []
  const installedScroll: InstalledScroll[] = []
  let attached = false
  let committed = false

  function attach(): void {
    if (attached) return
    sceneRoot.add(root)
    attached = true
  }

  function commitIfComplete(): void {
    if (
      committed ||
      [...expectedBundles].some((bundle) => !stagedBundles.has(bundle))
    )
      return
    for (const id of coveredPlatformIds)
      if (!floors.has(id)) fail(`platform "${id}" has no fallback floor.`)
    for (const id of coveredPlatformIds) removeKitGeometry(floors.get(id)!)
    root.visible = true
    committed = true
  }

  function stagePearl(sourceScene: Object3D): void {
    const source = exactNamedObject(
      sourceScene,
      CLOUDWAY_LAB_ROOT_NAMES.pearlRest,
    )
    const validated = validateCloudwayLaboratoryStaticDonor(
      source,
      'pearl-marble-long',
    )
    if (
      validated.metadata.material.appearanceStatus !==
        'provider-pbr-preserved' ||
      validated.metadata.material.intendedAppearance !== 'opaque'
    )
      fail(
        'pearl rest must retain its accepted opaque provider PBR appearance.',
      )
    const template = createKitInstance(source, materials, {}, materialLibrary)
    excludeDenseCameraCollision(template)
    template.updateMatrixWorld(true)
    const placements = pearlPlatforms.map((platform) => {
      const turns = validateStaticPlatform(
        platform,
        validated.collider.width,
        validated.collider.depth,
        validated.collider.height,
      )
      const placement = new Matrix4().makeRotationY(turns * (Math.PI / 2))
      placement.setPosition(
        new Vector3(
          (platform.minX + platform.maxX) / 2,
          platform.top,
          (platform.minZ + platform.maxZ) / 2,
        ),
      )
      return { placement, platform }
    })
    const staged: InstalledStaticBatch[] = []
    try {
      template.traverse((object) => {
        const sourceMesh = object as Mesh
        if (!sourceMesh.isMesh) return
        const mesh = new InstancedMesh(
          sourceMesh.geometry,
          sourceMesh.material,
          placements.length,
        )
        mesh.name = `${sourceMesh.name || 'mesh'}__pearl-rest-instances`
        mesh.instanceMatrix.setUsage(DynamicDrawUsage)
        const instances = placements.map(({ placement, platform }, index) => {
          const matrix = placement.clone().multiply(sourceMesh.matrixWorld)
          mesh.setMatrixAt(index, matrix)
          return { matrix, platform }
        })
        mesh.computeBoundingBox()
        mesh.computeBoundingSphere()
        mesh.count = 0
        staged.push({ enabledMask: undefined, instances, mesh })
      })
      if (staged.length === 0) fail('pearl rest has no static Mesh geometry.')
    } catch (error) {
      staged.forEach((item) => item.mesh.dispose())
      disposeObject(template, materialLibrary.materials)
      throw error
    }
    template.clear()
    installedStatic.push(...staged)
    staged.forEach((item) => root.add(item.mesh))
    excludeDenseCameraCollision(root)
  }

  function stageScroll(sourceScene: Object3D): void {
    const source = exactNamedObject(sourceScene, CLOUDWAY_LAB_ROOT_NAMES.scroll)
    const bindings = CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS.map((binding) => ({
      ...binding,
      material: sourceMaterial(source, binding.mesh, materialLibrary),
    }))
    const staged: InstalledScroll[] = []
    try {
      for (const platform of scrollPlatforms) {
        const adapter = createCloudwayScrollAdapter({
          source,
          platform,
          materials: bindings,
        })
        excludeDenseCameraCollision(adapter.root)
        staged.push({ adapter, platform })
      }
    } catch (error) {
      staged.forEach((item) => item.adapter.dispose())
      throw error
    }
    installedScroll.push(...staged)
    staged.forEach((item) => root.add(item.adapter.root))
  }

  return {
    install(sourceScene: Object3D, bundle: string): ReadonlySet<string> {
      if (!expectedBundles.has(bundle) || stagedBundles.has(bundle))
        return new Set()
      if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.pearlRest) stagePearl(sourceScene)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.scroll)
        stageScroll(sourceScene)
      else return new Set()
      attach()
      stagedBundles.add(bundle)
      commitIfComplete()
      return coveredPlatformIds
    },
    update(snapshot: GameSnapshot): void {
      runtimeById.clear()
      for (const state of snapshot.platformStates ?? [])
        runtimeById.set(state.id, state)
      const active = new Set(snapshot.enabledPlatformIds)
      for (const batch of installedStatic) {
        const enabledMask = committed
          ? batch.instances
              .map((instance) => (active.has(instance.platform.id) ? '1' : '0'))
              .join('')
          : ''
        if (enabledMask === batch.enabledMask) continue
        let count = 0
        if (committed)
          for (const instance of batch.instances)
            if (active.has(instance.platform.id))
              batch.mesh.setMatrixAt(count++, instance.matrix)
        batch.mesh.count = count
        batch.mesh.instanceMatrix.needsUpdate = true
        batch.enabledMask = enabledMask
      }
      for (const item of installedScroll) {
        const state = runtimeById.get(item.platform.id)
        item.adapter.root.visible = false
        if (!committed || !active.has(item.platform.id) || state === undefined)
          continue
        item.adapter.update(state)
      }
    },
    dispose(): void {
      installedScroll.forEach((item) => item.adapter.dispose())
      installedStatic.forEach((item) => item.mesh.dispose())
      disposeObject(root, materialLibrary.materials)
      installedScroll.length = 0
      installedStatic.length = 0
    },
  }
}
