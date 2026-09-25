// Cloudway semantic scroll adapter — validated donor roles follow authoritative centered-extent snapshots.

import type { Material, Matrix4, Mesh, MeshPhysicalMaterial, Object3D, } from 'three'
import { Box3, Group, Vector3 } from 'three'
import type { PlatformDefinition, PlatformRenderQuarterTurns, PlatformRuntimeSnapshot, } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'
import type { ValidatedCloudwayScrollDonor } from './cloudway-scroll-contract'
import { validateCloudwayScrollDonor } from './cloudway-scroll-contract'
import { disposeObject } from './dispose'

export {
  CLOUDWAY_SCROLL_COLLIDER_KEY,
  CLOUDWAY_SCROLL_METADATA_KEY,
  CLOUDWAY_SCROLL_ROLE_NAMES,
  type CloudwayScrollAdapterMetadataV1,
  type CloudwayScrollColliderMetadataV1,
} from './cloudway-scroll-contract'

export interface CloudwayScrollSemanticMaterials {
  /** Borrowed physical glass. Texture channels must already be region-approved. */
  readonly glass: MeshPhysicalMaterial
  /** Borrowed gold used only by roller and persistent semantic roles. */
  readonly gold: MeshPhysicalMaterial
}

export interface CloudwayScrollAdapter {
  readonly root: Group
  /** Copies the current visible bounds; empty until the first snapshot. */
  getLiveBounds(target?: Box3): Box3
  /** Applies one authoritative simulation snapshot without advancing a clock. */
  update(snapshot: PlatformRuntimeSnapshot): void
  /** Disposes cloned geometry. Source and semantic materials remain borrowed. */
  dispose(): void
}

export interface CreateCloudwayScrollAdapterOptions {
  readonly source: Object3D
  readonly platform: PlatformDefinition
  readonly materials: CloudwayScrollSemanticMaterials
}

interface InstalledRole {
  readonly role: Object3D
  readonly motion: Group
}

interface ValidatedPlatform {
  readonly minimumLengthRatio: number
  readonly turns: PlatformRenderQuarterTurns
}

const EPSILON = 1e-6
const Y_AXIS = new Vector3(0, 1, 0)

function donorLabel(source: Object3D): string {
  return source.name || '<unnamed>'
}

function fail(source: Object3D, detail: string): never {
  throw new Error(`Cloudway scroll donor "${donorLabel(source)}": ${detail}`)
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON
}

function exactNamedDescendant(source: Object3D, name: string): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object !== source && object.name === name) matches.push(object)
  })
  if (matches.length !== 1)
    fail(
      source,
      `Role node "${name}" must exist exactly once; found ${matches.length}.`,
    )
  return matches[0]!
}

function validateMaterials(
  source: Object3D,
  materials: CloudwayScrollSemanticMaterials,
): void {
  if (!materials.glass?.isMeshPhysicalMaterial)
    fail(source, 'glass semantic slot must use MeshPhysicalMaterial.')
  if (materials.glass.transmission <= 0 || materials.glass.metalness !== 0)
    fail(
      source,
      'glass semantic slot must be transmissive with metalness equal to zero.',
    )
  if (!materials.gold?.isMeshPhysicalMaterial)
    fail(source, 'gold semantic slot must use MeshPhysicalMaterial.')
  if (materials.gold.metalness <= 0 || materials.gold.transmission !== 0)
    fail(source, 'gold semantic slot must be metallic and non-transmissive.')
  if (materials.glass === materials.gold)
    fail(source, 'glass and gold semantic slots must use distinct materials.')
}

function worldAxisFor(turns: PlatformRenderQuarterTurns): 'x' | 'z' {
  return turns % 2 === 0 ? 'x' : 'z'
}

function validatePlatform(
  source: Object3D,
  platform: PlatformDefinition,
  validated: ValidatedCloudwayScrollDonor,
): ValidatedPlatform {
  if (platform.behavior?.kind !== 'scroll')
    fail(source, `platform "${platform.id}" must use scroll behavior.`)
  const turns = platform.renderQuarterTurns ?? 0
  if (!PLATFORM_RENDER_QUARTER_TURNS.includes(turns))
    fail(source, `platform "${platform.id}" has invalid renderQuarterTurns.`)
  const expectedAxis = worldAxisFor(turns)
  if (platform.behavior.axis !== expectedAxis)
    fail(
      source,
      `platform "${platform.id}" world axis must be "${expectedAxis}" after ${turns} render quarter turns.`,
    )
  if (
    !Number.isFinite(platform.behavior.minLengthRatio) ||
    platform.behavior.minLengthRatio <= 0 ||
    platform.behavior.minLengthRatio > 1
  )
    fail(
      source,
      `platform "${platform.id}" minLengthRatio must be greater than zero and at most one.`,
    )
  const worldWidth = platform.maxX - platform.minX
  const worldDepth = platform.maxZ - platform.minZ
  const expectedWidth =
    turns % 2 === 0
      ? validated.metadata.support.width
      : validated.metadata.support.depth
  const expectedDepth =
    turns % 2 === 0
      ? validated.metadata.support.depth
      : validated.metadata.support.width
  if (
    !nearlyEqual(worldWidth, expectedWidth) ||
    !nearlyEqual(worldDepth, expectedDepth)
  )
    fail(
      source,
      `platform "${platform.id}" support dimensions must be ${expectedWidth} x ${expectedDepth} after rotation.`,
    )
  if (!nearlyEqual(platform.thickness, validated.collider.height))
    fail(
      source,
      `platform "${platform.id}" thickness must match collider height ${validated.collider.height}.`,
    )
  if (
    ![
      platform.minX,
      platform.maxX,
      platform.minZ,
      platform.maxZ,
      platform.top,
    ].every(Number.isFinite)
  )
    fail(source, `platform "${platform.id}" bounds and top must be finite.`)
  return {
    minimumLengthRatio: platform.behavior.minLengthRatio,
    turns,
  }
}

function cloneRole(
  sourceClone: Object3D,
  sourceCloneInverse: Matrix4,
  roleName: string,
  material: MeshPhysicalMaterial,
  ownedMeshes: Mesh[],
): InstalledRole {
  const role = exactNamedDescendant(sourceClone, roleName)
  const authoredMatrix = sourceCloneInverse.clone().multiply(role.matrixWorld)
  role.removeFromParent()
  role.matrix.copy(authoredMatrix)
  role.matrixAutoUpdate = false
  role.matrixWorldNeedsUpdate = true
  const staged: { readonly geometry: Mesh['geometry']; readonly mesh: Mesh }[] =
    []
  try {
    role.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const geometry = mesh.geometry.clone()
      staged.push({ geometry, mesh })
      geometry.computeBoundingBox()
      const bounds = geometry.boundingBox
      if (
        bounds === null ||
        bounds.isEmpty() ||
        ![
          bounds.min.x,
          bounds.min.y,
          bounds.min.z,
          bounds.max.x,
          bounds.max.y,
          bounds.max.z,
        ].every(Number.isFinite)
      )
        fail(
          sourceClone,
          `Role mesh "${mesh.name}" has no finite geometry bounds.`,
        )
    })
  } catch (error) {
    staged.forEach(({ geometry }) => geometry.dispose())
    throw error
  }
  for (const item of staged) {
    item.mesh.geometry = item.geometry
    item.mesh.material = material
    ownedMeshes.push(item.mesh)
  }
  const motion = new Group()
  motion.name = `${roleName}__motion`
  motion.add(role)
  return { role, motion }
}

/**
 * Builds a detached adapter. Callers attach `root` only after construction
 * succeeds and keep fallbacks visible until the first authoritative snapshot.
 */
export function createCloudwayScrollAdapter(
  options: CreateCloudwayScrollAdapterOptions,
): CloudwayScrollAdapter {
  const { source, platform, materials } = options
  const validated = validateCloudwayScrollDonor(source)
  validateMaterials(source, materials)
  const validatedPlatform = validatePlatform(source, platform, validated)

  const root = new Group()
  root.name = `${donorLabel(source)}__scroll-adapter`
  root.position.set(
    (platform.minX + platform.maxX) / 2,
    platform.top,
    (platform.minZ + platform.maxZ) / 2,
  )
  root.setRotationFromAxisAngle(Y_AXIS, validatedPlatform.turns * (Math.PI / 2))
  root.visible = false
  const ownedMeshes: Mesh[] = []
  const borrowedMaterials = new Set<Material>([materials.glass, materials.gold])
  let deck: InstalledRole
  let negativeRoller: InstalledRole
  let positiveRoller: InstalledRole
  try {
    const sourceClone = source.clone(true)
    sourceClone.updateMatrixWorld(true)
    const sourceCloneInverse = sourceClone.matrixWorld.clone().invert()
    deck = cloneRole(
      sourceClone,
      sourceCloneInverse,
      validated.metadata.motion.roles.deck,
      materials.glass,
      ownedMeshes,
    )
    root.add(deck.motion)
    negativeRoller = cloneRole(
      sourceClone,
      sourceCloneInverse,
      validated.metadata.motion.roles.negativeRoller,
      materials.gold,
      ownedMeshes,
    )
    root.add(negativeRoller.motion)
    positiveRoller = cloneRole(
      sourceClone,
      sourceCloneInverse,
      validated.metadata.motion.roles.positiveRoller,
      materials.gold,
      ownedMeshes,
    )
    root.add(positiveRoller.motion)
    for (const roleName of validated.metadata.motion.roles.persistent) {
      const persistent = cloneRole(
        sourceClone,
        sourceCloneInverse,
        roleName,
        materials.gold,
        ownedMeshes,
      )
      root.add(persistent.motion)
    }
  } catch (error) {
    disposeObject(root, borrowedMaterials)
    throw error
  }

  const liveBounds = new Box3()
  const transformedBounds = new Box3()
  let disposed = false

  const refreshBounds = () => {
    root.updateMatrixWorld(true)
    liveBounds.makeEmpty()
    for (const mesh of ownedMeshes) {
      const localBounds = mesh.geometry.boundingBox
      if (localBounds === null)
        fail(source, `Role mesh "${mesh.name}" lost its geometry bounds.`)
      transformedBounds.copy(localBounds).applyMatrix4(mesh.matrixWorld)
      liveBounds.union(transformedBounds)
    }
  }

  return {
    root,
    getLiveBounds(target = new Box3()) {
      return target.copy(liveBounds)
    },
    update(snapshot) {
      if (disposed) fail(source, 'adapter is disposed.')
      if (snapshot.id !== platform.id)
        fail(
          source,
          `snapshot "${snapshot.id}" does not match platform "${platform.id}".`,
        )
      if (
        !nearlyEqual(snapshot.offset.x, 0) ||
        !nearlyEqual(snapshot.offset.y, 0) ||
        !nearlyEqual(snapshot.offset.z, 0)
      )
        fail(source, 'scroll snapshots must keep their fixed centre and top.')
      const ratio = snapshot.lengthRatio
      if (
        ratio === undefined ||
        !Number.isFinite(ratio) ||
        ratio < validatedPlatform.minimumLengthRatio ||
        ratio > 1
      )
        fail(
          source,
          `snapshot lengthRatio must stay between ${validatedPlatform.minimumLengthRatio} and 1.`,
        )
      deck.motion.scale.set(ratio, 1, 1)
      const negativeAnchor =
        validated.metadata.motion.rollerEdgeAnchors.negative[0]
      const positiveAnchor =
        validated.metadata.motion.rollerEdgeAnchors.positive[0]
      negativeRoller.motion.position.x = negativeAnchor * (ratio - 1)
      positiveRoller.motion.position.x = positiveAnchor * (ratio - 1)
      root.visible = true
      refreshBounds()
    },
    dispose() {
      if (disposed) return
      disposed = true
      liveBounds.makeEmpty()
      root.visible = false
      disposeObject(root, borrowedMaterials)
    },
  }
}
