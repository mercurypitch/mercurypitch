// Cloudway laboratory platform presentation — install the bounded first-slice donors as one validated transaction.

import type { Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, } from 'three'
import { Box3, Group, Matrix4, Vector3 } from 'three'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, PlatformRuntimeSnapshot, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'
import type { CloudwayCrackleAdapter } from './cloudway-crackle-adapter'
import { createCloudwayCrackleAdapter } from './cloudway-crackle-adapter'
import { validateCloudwayCrackleDonor } from './cloudway-crackle-contract'
import { CLOUDWAY_LAB_BUNDLE_IDS, CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS, CLOUDWAY_LAB_PEARL_PRESENTATION_FIT, CLOUDWAY_LAB_PLATFORM_RENDER_IDS, CLOUDWAY_LAB_RIGID_MATERIAL_ROLES, CLOUDWAY_LAB_ROOT_NAMES, CLOUDWAY_LAB_SCROLL_MATERIAL_BINDINGS, } from './cloudway-laboratory-catalog'
import { validateCloudwayLaboratoryStaticDonor } from './cloudway-laboratory-static-contract'
import { createCloudwayPlatformViewSelector } from './cloudway-platform-culling'
import type { CloudwayScrollAdapter } from './cloudway-scroll-adapter'
import { createCloudwayScrollAdapter } from './cloudway-scroll-adapter'
import { disposeObject } from './dispose'
import { createKitInstance, removeKitGeometry } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'
import type { RigidPlatformBatch } from './rigid-platform-batch'
import { createRigidPlatformBatch, updateRigidPlatformBatch, } from './rigid-platform-batch'

interface InstalledScroll {
  readonly adapter: CloudwayScrollAdapter
  readonly platform: PlatformDefinition
}

interface InstalledCrackle {
  readonly adapter: CloudwayCrackleAdapter
  readonly platform: PlatformDefinition
}

type CrackleKey = 'roseCrackle' | 'amethystCrackle'

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

export function fitCloudwayLaboratoryRigidPresentation(
  template: Object3D,
  key: 'pearlRest' | 'frostLily' | 'auroraGlide',
  contact: { readonly width: number; readonly depth: number },
): void {
  if (key !== 'pearlRest') return
  template.scale.set(
    contact.width / CLOUDWAY_LAB_PEARL_PRESENTATION_FIT.sourceSupportWidth,
    1,
    contact.depth / CLOUDWAY_LAB_PEARL_PRESENTATION_FIT.sourceSupportDepth,
  )
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

function crackleMaterialBindings(
  source: Object3D,
  platform: PlatformDefinition,
  kinds: Readonly<Record<string, 'glass' | 'opaque'>>,
  materialLibrary: MaterialLibrary,
) {
  const validated = validateCloudwayCrackleDonor(source, platform)
  const declaration = JSON.parse(
    source.userData.platform_adapter_json as string,
  ) as {
    motion?: { materials?: Record<string, unknown> }
  }
  const declared = Object.values(declaration.motion?.materials ?? {})
  const expected = Object.keys(kinds)
  if (
    declared.length !== expected.length ||
    new Set(declared).size !== expected.length ||
    expected.some((name) => !declared.includes(name))
  )
    fail('crackle material metadata must match the reviewed binding set.')

  const bindings: {
    kind: 'glass' | 'opaque'
    material: MeshStandardMaterial
    mesh: string
  }[] = []
  const represented = new Set<string>()
  for (const role of validated.visual)
    role.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      if (Array.isArray(mesh.material))
        fail(`crackle mesh "${mesh.name}" must use one material.`)
      const kind = kinds[mesh.material.name]
      if (kind === undefined)
        fail(
          `crackle mesh "${mesh.name}" uses unreviewed material "${mesh.material.name}".`,
        )
      const material = materialLibrary.clone(
        mesh.material,
      ) as MeshStandardMaterial
      if (!material.isMeshStandardMaterial)
        fail(`crackle mesh "${mesh.name}" needs imported PBR material.`)
      represented.add(mesh.material.name)
      bindings.push({ mesh: mesh.name, kind, material })
    })
  if (expected.some((name) => !represented.has(name)))
    fail('crackle donor does not render every reviewed material region.')
  return bindings
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
  const rosePlatforms = level.platforms.filter(
    (platform) =>
      platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.roseCrackle,
  )
  const amethystPlatforms = level.platforms.filter(
    (platform) =>
      platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.amethystCrackle,
  )
  const frostPlatforms = level.platforms.filter(
    (platform) =>
      platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.frostLily,
  )
  const auroraPlatforms = level.platforms.filter(
    (platform) =>
      platform.renderId === CLOUDWAY_LAB_PLATFORM_RENDER_IDS.auroraGlide,
  )
  const expectedBundles = new Set<string>()
  if (pearlPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.pearlRest)
  if (scrollPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.scroll)
  if (rosePlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.roseCrackle)
  if (amethystPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.amethystCrackle)
  if (frostPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.frostLily)
  if (auroraPlatforms.length > 0)
    expectedBundles.add(CLOUDWAY_LAB_BUNDLE_IDS.auroraGlide)
  const coveredPlatformIds = new Set([
    ...pearlPlatforms.map((platform) => platform.id),
    ...frostPlatforms.map((platform) => platform.id),
    ...auroraPlatforms.map((platform) => platform.id),
    ...scrollPlatforms.map((platform) => platform.id),
    ...rosePlatforms.map((platform) => platform.id),
    ...amethystPlatforms.map((platform) => platform.id),
  ])
  const runtimeById = new Map<string, PlatformRuntimeSnapshot>()
  const root = new Group()
  root.name = 'cloudway-laboratory-platform-art'
  root.visible = false
  const stagedBundles = new Set<string>()
  const installedStatic: RigidPlatformBatch[] = []
  const installedScroll: InstalledScroll[] = []
  const installedCrackle: InstalledCrackle[] = []
  let attached = false
  let committed = false
  let activePlatformIds: ReadonlySet<string> = new Set()
  const viewSelector = createCloudwayPlatformViewSelector({
    shadowDirection: { x: 0, y: -1, z: 0 },
    shadowReceiverMinimumY: 0,
  })
  const movingBounds = new Box3()
  const movingSelection = new WeakMap<Group, boolean>()

  function selectMovingRoot(
    movingRoot: Group,
    bounds: Box3 | undefined,
  ): boolean {
    const wasSelected = movingSelection.get(movingRoot)
    const visible = bounds !== undefined && viewSelector.includes(bounds)
    movingSelection.set(movingRoot, visible)
    movingRoot.visible = visible
    return wasSelected !== visible
  }

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

  function stageRigid(
    sourceScene: Object3D,
    key: 'pearlRest' | 'frostLily' | 'auroraGlide',
    platforms: readonly PlatformDefinition[],
  ): void {
    const source = exactNamedObject(sourceScene, CLOUDWAY_LAB_ROOT_NAMES[key])
    const validated = validateCloudwayLaboratoryStaticDonor(
      source,
      {
        pearlRest: 'pearl-marble-long',
        frostLily: 'frost-lily-step',
        auroraGlide: 'aurora-glide-raft',
      }[key],
      key === 'pearlRest' ? undefined : CLOUDWAY_LAB_RIGID_MATERIAL_ROLES[key],
    )
    if (
      key === 'pearlRest' &&
      (validated.metadata.material.appearanceStatus !==
        'provider-pbr-preserved' ||
        validated.metadata.material.intendedAppearance !== 'opaque')
    )
      fail(
        'pearl rest must retain its accepted opaque provider PBR appearance.',
      )
    const template = createKitInstance(source, materials, {}, materialLibrary)
    fitCloudwayLaboratoryRigidPresentation(template, key, validated.collider)
    excludeDenseCameraCollision(template)
    template.updateMatrixWorld(true)
    const placements = platforms.map((platform) => {
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
    const staged: RigidPlatformBatch[] = []
    try {
      template.traverse((object) => {
        const sourceMesh = object as Mesh
        if (!sourceMesh.isMesh) return
        staged.push(createRigidPlatformBatch(sourceMesh, placements))
      })
      if (staged.length === 0) fail(`${key} has no static Mesh geometry.`)
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

  function stageCrackle(
    sourceScene: Object3D,
    key: CrackleKey,
    platforms: readonly PlatformDefinition[],
  ): void {
    const source = exactNamedObject(sourceScene, CLOUDWAY_LAB_ROOT_NAMES[key])
    const staged: InstalledCrackle[] = []
    try {
      for (const platform of platforms) {
        const bindings = crackleMaterialBindings(
          source,
          platform,
          CLOUDWAY_LAB_CRACKLE_MATERIAL_KINDS[key],
          materialLibrary,
        )
        const adapter = createCloudwayCrackleAdapter({
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
    installedCrackle.push(...staged)
    staged.forEach((item) => root.add(item.adapter.root))
  }

  return {
    install(sourceScene: Object3D, bundle: string): ReadonlySet<string> {
      if (!expectedBundles.has(bundle) || stagedBundles.has(bundle))
        return new Set()
      if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.pearlRest)
        stageRigid(sourceScene, 'pearlRest', pearlPlatforms)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.frostLily)
        stageRigid(sourceScene, 'frostLily', frostPlatforms)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.auroraGlide)
        stageRigid(sourceScene, 'auroraGlide', auroraPlatforms)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.scroll)
        stageScroll(sourceScene)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.roseCrackle)
        stageCrackle(sourceScene, 'roseCrackle', rosePlatforms)
      else if (bundle === CLOUDWAY_LAB_BUNDLE_IDS.amethystCrackle)
        stageCrackle(sourceScene, 'amethystCrackle', amethystPlatforms)
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
      activePlatformIds = active
      for (const batch of installedStatic)
        updateRigidPlatformBatch(
          batch,
          committed,
          active,
          runtimeById,
          viewSelector.includes,
        )
      for (const item of installedScroll) {
        const state = runtimeById.get(item.platform.id)
        item.adapter.root.visible = false
        if (!committed || !active.has(item.platform.id) || state === undefined)
          continue
        item.adapter.update(state)
      }
      for (const item of installedCrackle) {
        const state = runtimeById.get(item.platform.id)
        item.adapter.root.visible = false
        if (!committed || !active.has(item.platform.id) || state === undefined)
          continue
        item.adapter.update(state)
      }
    },
    cullForView(camera: PerspectiveCamera | undefined): boolean {
      // Laboratory donors deliberately do not cast shadows: no hidden caster
      // needs retention outside the expanded camera/fog volume.
      viewSelector.update(camera, [])
      let changed = false
      for (const batch of installedStatic)
        changed =
          updateRigidPlatformBatch(
            batch,
            committed,
            activePlatformIds,
            runtimeById,
            viewSelector.includes,
          ) || changed
      for (const item of installedScroll) {
        const bounds = item.adapter.root.visible
          ? item.adapter.getLiveBounds(movingBounds)
          : undefined
        changed = selectMovingRoot(item.adapter.root, bounds) || changed
      }
      for (const item of installedCrackle) {
        const bounds = item.adapter.root.visible
          ? movingBounds.setFromObject(item.adapter.root)
          : undefined
        changed = selectMovingRoot(item.adapter.root, bounds) || changed
      }
      return changed
    },
    dispose(): void {
      installedScroll.forEach((item) => item.adapter.dispose())
      installedCrackle.forEach((item) => item.adapter.dispose())
      installedStatic.forEach((item) => item.mesh.dispose())
      disposeObject(root, materialLibrary.materials)
      installedScroll.length = 0
      installedCrackle.length = 0
      installedStatic.length = 0
    },
  }
}
