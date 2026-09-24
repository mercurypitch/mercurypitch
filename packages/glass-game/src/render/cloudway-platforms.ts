// Cloudway platform presentation — instanced donor art follows authoritative simulation transforms and phases.

import type { Mesh, Object3D } from 'three'
import { Box3, Color, DynamicDrawUsage, Euler, Group, InstancedMesh, MathUtils, Matrix4, Quaternion, Vector3, } from 'three'
import type { GameSnapshot, LevelDefinition, PlatformDefinition, PlatformRuntimeSnapshot, Vec3, } from '../contracts'
import type { CloudwayPlatformRenderId } from './cloudway-catalog'
import { CLOUDWAY_PLATFORM_BUNDLE_ID, CLOUDWAY_PLATFORM_NODES, CLOUDWAY_PLATFORM_RENDER_IDS, isCloudwayPlatformRenderId, } from './cloudway-catalog'
import { CLOUDWAY_FOG_FAR } from './cloudway-scene'
import { disposeObject } from './dispose'
import { createKitInstance, kitFloorDimensions, removeKitGeometry, } from './kit-instance'
import type { MaterialLibrary } from './material-library'
import type { MuseumMaterials } from './materials'

type CloudwayVisualState = 'stable' | 'intact' | 'warning' | 'release'

interface DonorSpec {
  node: string
  renderId: CloudwayPlatformRenderId
  state: CloudwayVisualState
}

interface InstancedPart {
  index: number
  mesh: InstancedMesh
  localMatrix: Matrix4
  localBounds: Box3
  worldMatrix: Matrix4
}

interface InstalledDonor {
  dimensions: Vector3
  platforms: readonly PlatformDefinition[]
  renderId: CloudwayPlatformRenderId
  state: CloudwayVisualState
  parts: readonly InstancedPart[]
}

const DONORS: readonly DonorSpec[] = [
  {
    node: CLOUDWAY_PLATFORM_NODES.marble,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.marble,
    state: 'stable',
  },
  {
    node: CLOUDWAY_PLATFORM_NODES.frost,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.frost,
    state: 'stable',
  },
  {
    node: CLOUDWAY_PLATFORM_NODES.glide,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.glide,
    state: 'stable',
  },
  {
    node: CLOUDWAY_PLATFORM_NODES.crackleIntact,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.crackle,
    state: 'intact',
  },
  {
    node: CLOUDWAY_PLATFORM_NODES.crackleWarning,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.crackle,
    state: 'warning',
  },
  {
    node: CLOUDWAY_PLATFORM_NODES.crackleRelease,
    renderId: CLOUDWAY_PLATFORM_RENDER_IDS.crackle,
    state: 'release',
  },
]

const WARNING_TURNS = 2
const WARNING_YAW_RADIANS = 0.012
const RELEASE_HIDE_PROGRESS = 0.96
export const CLOUDWAY_PLATFORM_FOG_CULL_MARGIN = 2
const CLOUDWAY_PLATFORM_CULL_DISTANCE =
  CLOUDWAY_FOG_FAR + CLOUDWAY_PLATFORM_FOG_CULL_MARGIN

function visualState(
  platform: PlatformDefinition,
  runtime: PlatformRuntimeSnapshot | undefined,
): CloudwayVisualState {
  if (platform.behavior?.kind !== 'crackle') return 'stable'
  if (runtime?.phase === 'warning') return 'warning'
  if (runtime?.phase === 'released' || runtime?.phase === 'resetting')
    return 'release'
  return 'intact'
}

function createInstancedDonor(
  source: Object3D,
  spec: DonorSpec,
  platforms: readonly PlatformDefinition[],
  materials: MuseumMaterials,
  materialLibrary: MaterialLibrary,
): InstalledDonor {
  const dimensions = kitFloorDimensions(source)
  const template = createKitInstance(source, materials, {}, materialLibrary)
  template.updateMatrixWorld(true)
  const parts: InstancedPart[] = []
  template.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    mesh.geometry.computeBoundingBox()
    const localBounds = mesh.geometry.boundingBox?.clone()
    if (localBounds === undefined)
      throw new Error(`Cloudway donor "${spec.node}" has invalid bounds.`)
    const instance = new InstancedMesh(
      mesh.geometry,
      mesh.material,
      platforms.length,
    )
    instance.name = `cloudway-${spec.state}-${mesh.name || spec.node}`
    instance.castShadow = mesh.castShadow
    instance.receiveShadow = mesh.receiveShadow
    instance.frustumCulled = false
    instance.instanceMatrix.setUsage(DynamicDrawUsage)
    instance.count = 0
    parts.push({
      index: parts.length,
      mesh: instance,
      localMatrix: mesh.matrixWorld.clone(),
      localBounds,
      worldMatrix: new Matrix4(),
    })
  })
  if (parts.length === 0)
    throw new Error(`Cloudway donor "${spec.node}" contains no render meshes.`)
  return {
    dimensions,
    platforms,
    renderId: spec.renderId,
    state: spec.state,
    parts,
  }
}

function disposeDonors(donors: readonly InstalledDonor[]): void {
  for (const donor of donors)
    for (const part of donor.parts) part.mesh.dispose()
}

function releaseProgress(runtime: PlatformRuntimeSnapshot | undefined): number {
  const progress = MathUtils.clamp(runtime?.phaseProgress ?? 0, 0, 1)
  return runtime?.phase === 'resetting' ? 1 - progress : progress
}

function fragmentMotion(
  target: Matrix4,
  partIndex: number,
  progress: number,
  offset: Vector3,
  rotation: Euler,
  quaternion: Quaternion,
  scale: Vector3,
): Matrix4 {
  const fall = progress * progress
  const direction = partIndex % 2 === 0 ? -1 : 1
  const side = (0.11 + (partIndex % 3) * 0.045) * direction * fall
  const forward = (0.06 + ((partIndex + 1) % 3) * 0.04) * fall
  offset.set(side, -1.85 * fall, forward * (partIndex % 4 < 2 ? -1 : 1))
  rotation.set(
    direction * progress * (0.24 + (partIndex % 3) * 0.08),
    progress * (0.18 + (partIndex % 4) * 0.07),
    -direction * progress * (0.2 + (partIndex % 2) * 0.09),
  )
  quaternion.setFromEuler(rotation)
  const size = Math.max(0.025, 1 - MathUtils.smoothstep(progress, 0.62, 1))
  scale.setScalar(size)
  return target.compose(offset, quaternion, scale)
}

/**
 * The fallback floors stay visible until the complete GLB has been validated.
 * Installation is transactional; repeated donor pieces share one geometry and
 * material per authored submesh through InstancedMesh batches.
 */
export function createCloudwayPlatformRenderer(
  level: LevelDefinition,
  sceneRoot: Group,
  floors: ReadonlyMap<string, Group>,
  materials: MuseumMaterials,
  materialLibrary: MaterialLibrary,
) {
  const platforms = level.platforms.filter((platform) =>
    isCloudwayPlatformRenderId(platform.renderId),
  )
  const platformIds = new Set(platforms.map((platform) => platform.id))
  const runtimeById = new Map<string, PlatformRuntimeSnapshot>()
  const rootMatrix = new Matrix4()
  const motionMatrix = new Matrix4()
  const partBounds = new Box3()
  const platformBounds = new Box3()
  const scale = new Vector3()
  const position = new Vector3()
  const motionOffset = new Vector3()
  const motionRotation = new Euler()
  const motionQuaternion = new Quaternion()
  const motionScale = new Vector3()
  const viewPosition = new Vector3()
  const warningColor = new Color()
  let installedRoot: Group | undefined
  let installedDonors: readonly InstalledDonor[] = []
  let latestSnapshot: GameSnapshot | undefined

  function install(sourceScene: Object3D, bundle: string): ReadonlySet<string> {
    if (bundle !== CLOUDWAY_PLATFORM_BUNDLE_ID || platforms.length === 0)
      return new Set()
    if (installedRoot !== undefined) return platformIds

    const stagedRoot = new Group()
    stagedRoot.name = 'cloudway-platform-art'
    const stagedDonors: InstalledDonor[] = []
    try {
      platforms.forEach((platform) => {
        if (!floors.has(platform.id))
          throw new Error(
            `Cloudway platform "${platform.id}" has no fallback render floor.`,
          )
      })
      for (const spec of DONORS) {
        const matches = platforms.filter(
          (platform) => platform.renderId === spec.renderId,
        )
        if (matches.length === 0) continue
        const source = sourceScene.getObjectByName(spec.node)
        if (source === undefined)
          throw new Error(
            `Cloudway platform kit is missing required node "${spec.node}".`,
          )
        const donor = createInstancedDonor(
          source,
          spec,
          matches,
          materials,
          materialLibrary,
        )
        stagedDonors.push(donor)
        donor.parts.forEach(({ mesh }) => stagedRoot.add(mesh))
      }
    } catch (error) {
      disposeDonors(stagedDonors)
      disposeObject(stagedRoot, materialLibrary.materials)
      throw error
    }

    // Do not reveal a partial family. Only replace the honest fallback floors
    // after every node needed by this level has been prepared successfully.
    sceneRoot.add(stagedRoot)
    platforms.forEach((platform) => removeKitGeometry(floors.get(platform.id)!))
    installedRoot = stagedRoot
    installedDonors = stagedDonors
    return platformIds
  }

  function writeInstances(snapshot: GameSnapshot, viewpoint?: Vec3): void {
    if (installedRoot === undefined) return
    if (viewpoint !== undefined)
      viewPosition.set(viewpoint.x, viewpoint.y, viewpoint.z)
    runtimeById.clear()
    for (const state of snapshot.platformStates ?? [])
      runtimeById.set(state.id, state)

    for (const donor of installedDonors) {
      let instanceIndex = 0
      for (const platform of donor.platforms) {
        const runtime = runtimeById.get(platform.id)
        const active = snapshot.enabledPlatformIds.includes(platform.id)
        if (!active || visualState(platform, runtime) !== donor.state) continue

        const released = donor.state === 'release'
        const release = released ? releaseProgress(runtime) : 0
        if (released && release >= RELEASE_HIDE_PROGRESS) continue

        position.set(
          (platform.minX + platform.maxX) / 2 + (runtime?.offset.x ?? 0),
          platform.top + (runtime?.offset.y ?? 0),
          (platform.minZ + platform.maxZ) / 2 + (runtime?.offset.z ?? 0),
        )
        scale.set(
          (platform.maxX - platform.minX) / donor.dimensions.x,
          1,
          (platform.maxZ - platform.minZ) / donor.dimensions.z,
        )
        const warning =
          donor.state === 'warning'
            ? MathUtils.clamp(runtime?.phaseProgress ?? 0, 0, 1)
            : 0
        rootMatrix.makeRotationY(
          Math.sin(warning * Math.PI * 2 * WARNING_TURNS) * WARNING_YAW_RADIANS,
        )
        rootMatrix.scale(scale)
        rootMatrix.setPosition(position)
        platformBounds.makeEmpty()
        for (const part of donor.parts) {
          if (released) {
            fragmentMotion(
              motionMatrix,
              part.index,
              release,
              motionOffset,
              motionRotation,
              motionQuaternion,
              motionScale,
            )
            part.worldMatrix.multiplyMatrices(rootMatrix, motionMatrix)
            part.worldMatrix.multiply(part.localMatrix)
          } else {
            part.worldMatrix.multiplyMatrices(rootMatrix, part.localMatrix)
          }
          partBounds.copy(part.localBounds).applyMatrix4(part.worldMatrix)
          platformBounds.union(partBounds)
        }
        if (
          viewpoint !== undefined &&
          platformBounds.distanceToPoint(viewPosition) >
            CLOUDWAY_PLATFORM_CULL_DISTANCE
        )
          continue

        for (const part of donor.parts) {
          part.mesh.setMatrixAt(instanceIndex, part.worldMatrix)
          if (donor.state !== 'warning') continue
          const pulse = 0.5 + 0.5 * Math.sin(warning * Math.PI * 4)
          warningColor.setRGB(
            1.06 + pulse * 0.12,
            0.9 + pulse * 0.08,
            0.72 + pulse * 0.14,
          )
          part.mesh.setColorAt(instanceIndex, warningColor)
        }
        instanceIndex++
      }
      for (const part of donor.parts) {
        part.mesh.count = instanceIndex
        part.mesh.instanceMatrix.needsUpdate = true
        if (part.mesh.instanceColor !== null)
          part.mesh.instanceColor.needsUpdate = true
        // Raycasting uses the cached sphere even with frustum culling disabled.
        // Refresh it so the moving raft and falling shards remain camera blockers.
        part.mesh.computeBoundingSphere()
      }
    }
  }

  return {
    owns(platformId: string): boolean {
      return platformIds.has(platformId)
    },
    install,
    update(snapshot: GameSnapshot): void {
      latestSnapshot = snapshot
      // Camera occlusion needs every current transform before its raycasts.
      // The final presentation pass compacts fully fogged instances afterward.
      writeInstances(snapshot)
    },
    cullForView(viewpoint: Vec3): void {
      if (latestSnapshot !== undefined)
        writeInstances(latestSnapshot, viewpoint)
    },
    dispose(): void {
      disposeDonors(installedDonors)
      if (installedRoot !== undefined) {
        disposeObject(installedRoot, materialLibrary.materials)
        installedRoot.removeFromParent()
      }
      installedRoot = undefined
      installedDonors = []
      latestSnapshot = undefined
    },
  }
}
