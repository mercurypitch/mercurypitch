// Cloudway scroll donor contract — parse and validate certified contact metadata and semantic role trees without mutating source art.

import type { Mesh, Object3D } from 'three'
import { Matrix4, Vector3 } from 'three'

export const CLOUDWAY_SCROLL_METADATA_KEY = 'platform_adapter_json'
export const CLOUDWAY_SCROLL_COLLIDER_KEY = 'collider_json'

export const CLOUDWAY_SCROLL_ROLE_NAMES = {
  deck: 'ScrollDeck',
  negativeRoller: 'ScrollRollerNegative',
  positiveRoller: 'ScrollRollerPositive',
} as const

export interface CloudwayScrollAdapterMetadataV1 {
  readonly version: 1
  readonly coordinates: {
    readonly upAxis: '+Y'
    readonly units: 'metres'
    readonly origin: 'top-centre-of-fully-extended-support'
  }
  readonly support: {
    readonly state: 'fully-extended'
    readonly topY: 0
    readonly width: number
    readonly depth: number
  }
  readonly motion: {
    readonly kind: 'scroll'
    readonly localExtensionAxis: 'x'
    readonly roles: {
      readonly deck: typeof CLOUDWAY_SCROLL_ROLE_NAMES.deck
      readonly negativeRoller: typeof CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller
      readonly positiveRoller: typeof CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller
      readonly persistent: readonly string[]
    }
    readonly rollerEdgeAnchors: {
      readonly negative: readonly [number, 0, number]
      readonly positive: readonly [number, 0, number]
    }
  }
}

export interface CloudwayScrollColliderMetadataV1 {
  readonly shape: 'box'
  readonly width: number
  readonly depth: number
  readonly height: number
  readonly topY: 0
  readonly center: readonly [0, number, 0]
}

export interface ValidatedCloudwayScrollDonor {
  readonly collider: CloudwayScrollColliderMetadataV1
  readonly metadata: CloudwayScrollAdapterMetadataV1
}

const EPSILON = 1e-6

function donorLabel(source: Object3D): string {
  return source.name || '<unnamed>'
}

function fail(source: Object3D, detail: string): never {
  throw new Error(`Cloudway scroll donor "${donorLabel(source)}": ${detail}`)
}

function record(
  source: Object3D,
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(source, `${path} must be an object.`)
  return value as Record<string, unknown>
}

function finiteNumber(source: Object3D, value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    fail(source, `${path} must be finite.`)
  return value
}

function positiveNumber(
  source: Object3D,
  value: unknown,
  path: string,
): number {
  const result = finiteNumber(source, value, path)
  if (result <= 0) fail(source, `${path} must be positive.`)
  return result
}

function exactString<T extends string>(
  source: Object3D,
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) fail(source, `${path} must be "${expected}".`)
  return expected
}

function parseExtra(source: Object3D, key: string): Record<string, unknown> {
  const encoded: unknown = source.userData[key]
  if (typeof encoded !== 'string')
    fail(source, `${key} must be a string-encoded JSON object.`)
  try {
    return record(source, JSON.parse(encoded), key)
  } catch (error) {
    if (error instanceof SyntaxError)
      fail(source, `${key} contains invalid JSON: ${error.message}`)
    throw error
  }
}

function readVector3(
  source: Object3D,
  value: unknown,
  path: string,
): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3)
    fail(source, `${path} must contain three finite numbers.`)
  return [
    finiteNumber(source, value[0], `${path}[0]`),
    finiteNumber(source, value[1], `${path}[1]`),
    finiteNumber(source, value[2], `${path}[2]`),
  ]
}

function readCollider(source: Object3D): CloudwayScrollColliderMetadataV1 {
  const raw = parseExtra(source, CLOUDWAY_SCROLL_COLLIDER_KEY)
  exactString(source, raw.shape, 'box', 'collider_json.shape')
  const width = positiveNumber(source, raw.width, 'collider_json.width')
  const depth = positiveNumber(source, raw.depth, 'collider_json.depth')
  const height = positiveNumber(source, raw.height, 'collider_json.height')
  const topY = finiteNumber(source, raw.topY, 'collider_json.topY')
  const center = readVector3(source, raw.center, 'collider_json.center')
  if (Math.abs(topY) > EPSILON)
    fail(source, 'collider_json.topY must equal the root landing plane y=0.')
  if (
    Math.abs(center[0]) > EPSILON ||
    Math.abs(center[1] + height / 2) > EPSILON ||
    Math.abs(center[2]) > EPSILON
  )
    fail(
      source,
      'collider_json.center must be [0, -height / 2, 0] below the landing plane.',
    )
  return {
    shape: 'box',
    width,
    depth,
    height,
    topY: 0,
    center: [0, center[1], 0],
  }
}

function readPersistentRoles(
  source: Object3D,
  value: unknown,
): readonly string[] {
  if (!Array.isArray(value))
    fail(
      source,
      'platform_adapter_json.motion.roles.persistent must be an array.',
    )
  const result = value.map((item, index) => {
    if (typeof item !== 'string' || item.length === 0)
      fail(
        source,
        `platform_adapter_json.motion.roles.persistent[${index}] must be a node name.`,
      )
    return item
  })
  if (new Set(result).size !== result.length)
    fail(
      source,
      'platform_adapter_json.motion.roles.persistent contains duplicate node names.',
    )
  return result
}

function readAdapterMetadata(
  source: Object3D,
): CloudwayScrollAdapterMetadataV1 {
  const raw = parseExtra(source, CLOUDWAY_SCROLL_METADATA_KEY)
  if (raw.version !== 1)
    fail(source, 'platform_adapter_json.version must be 1.')
  const coordinates = record(
    source,
    raw.coordinates,
    'platform_adapter_json.coordinates',
  )
  exactString(
    source,
    coordinates.upAxis,
    '+Y',
    'platform_adapter_json.coordinates.upAxis',
  )
  exactString(
    source,
    coordinates.units,
    'metres',
    'platform_adapter_json.coordinates.units',
  )
  exactString(
    source,
    coordinates.origin,
    'top-centre-of-fully-extended-support',
    'platform_adapter_json.coordinates.origin',
  )
  const support = record(source, raw.support, 'platform_adapter_json.support')
  exactString(
    source,
    support.state,
    'fully-extended',
    'platform_adapter_json.support.state',
  )
  const topY = finiteNumber(
    source,
    support.topY,
    'platform_adapter_json.support.topY',
  )
  if (Math.abs(topY) > EPSILON)
    fail(source, 'platform_adapter_json.support.topY must be 0.')
  const width = positiveNumber(
    source,
    support.width,
    'platform_adapter_json.support.width',
  )
  const depth = positiveNumber(
    source,
    support.depth,
    'platform_adapter_json.support.depth',
  )
  const motion = record(source, raw.motion, 'platform_adapter_json.motion')
  exactString(
    source,
    motion.kind,
    'scroll',
    'platform_adapter_json.motion.kind',
  )
  exactString(
    source,
    motion.localExtensionAxis,
    'x',
    'platform_adapter_json.motion.localExtensionAxis',
  )
  const roles = record(
    source,
    motion.roles,
    'platform_adapter_json.motion.roles',
  )
  const deck = exactString(
    source,
    roles.deck,
    CLOUDWAY_SCROLL_ROLE_NAMES.deck,
    'platform_adapter_json.motion.roles.deck',
  )
  const negativeRoller = exactString(
    source,
    roles.negativeRoller,
    CLOUDWAY_SCROLL_ROLE_NAMES.negativeRoller,
    'platform_adapter_json.motion.roles.negativeRoller',
  )
  const positiveRoller = exactString(
    source,
    roles.positiveRoller,
    CLOUDWAY_SCROLL_ROLE_NAMES.positiveRoller,
    'platform_adapter_json.motion.roles.positiveRoller',
  )
  const persistent = readPersistentRoles(source, roles.persistent)
  const reserved = new Set<string>([deck, negativeRoller, positiveRoller])
  if (persistent.some((name) => reserved.has(name)))
    fail(source, 'Persistent roles must not reuse deck or roller node names.')
  const anchors = record(
    source,
    motion.rollerEdgeAnchors,
    'platform_adapter_json.motion.rollerEdgeAnchors',
  )
  const negative = readVector3(
    source,
    anchors.negative,
    'platform_adapter_json.motion.rollerEdgeAnchors.negative',
  )
  const positive = readVector3(
    source,
    anchors.positive,
    'platform_adapter_json.motion.rollerEdgeAnchors.positive',
  )
  if (
    Math.abs(negative[0] + width / 2) > EPSILON ||
    Math.abs(positive[0] - width / 2) > EPSILON ||
    Math.abs(negative[1]) > EPSILON ||
    Math.abs(negative[2]) > EPSILON ||
    Math.abs(positive[1]) > EPSILON ||
    Math.abs(positive[2]) > EPSILON
  )
    fail(
      source,
      'Roller edge anchors must be [-width / 2, 0, 0] and [width / 2, 0, 0].',
    )
  return {
    version: 1,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'top-centre-of-fully-extended-support',
    },
    support: {
      state: 'fully-extended',
      topY: 0,
      width,
      depth,
    },
    motion: {
      kind: 'scroll',
      localExtensionAxis: 'x',
      roles: { deck, negativeRoller, positiveRoller, persistent },
      rollerEdgeAnchors: {
        negative: [negative[0], 0, negative[2]],
        positive: [positive[0], 0, positive[2]],
      },
    },
  }
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON
}

function localMatrix(object: Object3D): Matrix4 {
  return object.matrixAutoUpdate
    ? new Matrix4().compose(object.position, object.quaternion, object.scale)
    : object.matrix.clone()
}

/** Computes a descendant matrix without updating or otherwise mutating source. */
function relativeMatrix(object: Object3D, root: Object3D): Matrix4 {
  const chain: Object3D[] = []
  let cursor: Object3D | null = object
  while (cursor !== root) {
    if (cursor === null)
      fail(root, `Role node "${object.name}" is outside the donor root.`)
    chain.push(cursor)
    cursor = cursor.parent
  }
  const result = new Matrix4()
  for (let index = chain.length - 1; index >= 0; index--)
    result.multiply(localMatrix(chain[index]!))
  return result
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

function isWithin(object: Object3D, ancestor: Object3D): boolean {
  let cursor: Object3D | null = object
  while (cursor !== null) {
    if (cursor === ancestor) return true
    cursor = cursor.parent
  }
  return false
}

function validateIdentityRoot(source: Object3D): void {
  if (
    !nearlyEqual(source.position.x, 0) ||
    !nearlyEqual(source.position.y, 0) ||
    !nearlyEqual(source.position.z, 0) ||
    !nearlyEqual(source.quaternion.x, 0) ||
    !nearlyEqual(source.quaternion.y, 0) ||
    !nearlyEqual(source.quaternion.z, 0) ||
    !nearlyEqual(source.quaternion.w, 1) ||
    !nearlyEqual(source.scale.x, 1) ||
    !nearlyEqual(source.scale.y, 1) ||
    !nearlyEqual(source.scale.z, 1) ||
    (!source.matrixAutoUpdate && !source.matrix.equals(new Matrix4()))
  )
    fail(
      source,
      'family root must have an identity transform at the support top-centre.',
    )
}

function validateRoleTree(
  source: Object3D,
  metadata: CloudwayScrollAdapterMetadataV1,
): readonly string[] {
  const roleNames = [
    metadata.motion.roles.deck,
    metadata.motion.roles.negativeRoller,
    metadata.motion.roles.positiveRoller,
    ...metadata.motion.roles.persistent,
  ]
  if (new Set(roleNames).size !== roleNames.length)
    fail(source, 'Semantic role node names must be unique.')
  const roleRoots = roleNames.map((name) => exactNamedDescendant(source, name))
  for (const roleRoot of roleRoots) {
    const overlapping = roleRoots.find(
      (candidate) =>
        candidate !== roleRoot &&
        (isWithin(roleRoot, candidate) || isWithin(candidate, roleRoot)),
    )
    if (overlapping !== undefined)
      fail(
        source,
        `Role nodes "${roleRoot.name}" and "${overlapping.name}" overlap.`,
      )
    let meshCount = 0
    roleRoot.traverse((object) => {
      if ((object as Mesh).isMesh) meshCount++
    })
    if (meshCount === 0)
      fail(source, `Role node "${roleRoot.name}" contains no render mesh.`)
  }
  source.traverse((object) => {
    if (!(object as Mesh).isMesh) return
    const owners = roleRoots.filter((roleRoot) => isWithin(object, roleRoot))
    if (owners.length !== 1)
      fail(
        source,
        `Render mesh "${object.name || '<unnamed>'}" must belong to exactly one semantic role.`,
      )
  })
  const deckPosition = new Vector3().setFromMatrixPosition(
    relativeMatrix(roleRoots[0]!, source),
  )
  if (deckPosition.length() > EPSILON)
    fail(
      source,
      'ScrollDeck role origin must be the support top-centre [0, 0, 0].',
    )
  const negativePosition = new Vector3().setFromMatrixPosition(
    relativeMatrix(roleRoots[1]!, source),
  )
  const positivePosition = new Vector3().setFromMatrixPosition(
    relativeMatrix(roleRoots[2]!, source),
  )
  const negativeAnchor = metadata.motion.rollerEdgeAnchors.negative
  const positiveAnchor = metadata.motion.rollerEdgeAnchors.positive
  if (
    !nearlyEqual(negativePosition.x, negativeAnchor[0]) ||
    !nearlyEqual(negativePosition.y, negativeAnchor[1]) ||
    !nearlyEqual(negativePosition.z, negativeAnchor[2]) ||
    !nearlyEqual(positivePosition.x, positiveAnchor[0]) ||
    !nearlyEqual(positivePosition.y, positiveAnchor[1]) ||
    !nearlyEqual(positivePosition.z, positiveAnchor[2])
  )
    fail(source, 'Roller role origins must match their certified edge anchors.')
  return roleNames
}

export function validateCloudwayScrollDonor(
  source: Object3D,
): ValidatedCloudwayScrollDonor {
  validateIdentityRoot(source)
  const collider = readCollider(source)
  const metadata = readAdapterMetadata(source)
  if (
    !nearlyEqual(collider.width, metadata.support.width) ||
    !nearlyEqual(collider.depth, metadata.support.depth)
  )
    fail(
      source,
      'collider_json and platform_adapter_json support dimensions must match.',
    )
  validateRoleTree(source, metadata)
  return { collider, metadata }
}
