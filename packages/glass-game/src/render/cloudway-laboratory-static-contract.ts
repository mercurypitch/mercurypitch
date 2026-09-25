// Cloudway laboratory static contract — validate source-preserving rest geometry before it can replace gameplay fallbacks.

import type { Mesh, MeshPhysicalMaterial, Object3D } from 'three'
import { Matrix4 } from 'three'

export const CLOUDWAY_LAB_STATIC_METADATA_KEY = 'cloudway_lab_asset_json'
export const CLOUDWAY_LAB_STATIC_COLLIDER_KEY = 'collider_json'

export interface CloudwayLaboratoryStaticMetadataV1 {
  readonly schema: 'cloudway-lab-static-v1'
  readonly assetId: string
  readonly kind: 'platform'
  readonly coordinates: {
    readonly upAxis: '+Y'
    readonly units: 'metres'
    readonly origin: 'landing-or-resting-datum'
  }
  readonly contact: {
    readonly kind: 'rectangle'
    readonly width: number
    readonly depth: number
    readonly topY: 0
    readonly height: number
  }
  readonly material: {
    readonly kind: 'provider-pbr'
    readonly appearanceStatus: string
    readonly intendedAppearance: string
  }
  readonly geometry: {
    readonly triangles: number
    readonly decimated: false
    readonly remeshed: false
  }
}

export interface CloudwayLaboratoryStaticColliderV1 {
  readonly shape: 'box'
  readonly width: number
  readonly depth: number
  readonly height: number
  readonly topY: 0
  readonly center: readonly [0, number, 0]
}

export interface ValidatedCloudwayLaboratoryStaticDonor {
  readonly collider: CloudwayLaboratoryStaticColliderV1
  readonly metadata: CloudwayLaboratoryStaticMetadataV1
}

const EPSILON = 1e-6

function fail(source: Object3D, detail: string): never {
  throw new Error(
    `Cloudway laboratory static donor "${source.name || '<unnamed>'}": ${detail}`,
  )
}

function object(
  source: Object3D,
  value: unknown,
  path: string,
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    fail(source, `${path} must be an object.`)
  return value as Record<string, unknown>
}

function encodedObject(source: Object3D, key: string): Record<string, unknown> {
  const encoded: unknown = source.userData[key]
  if (typeof encoded !== 'string')
    fail(source, `${key} must be a string-encoded JSON object.`)
  try {
    return object(source, JSON.parse(encoded), key)
  } catch (error) {
    if (error instanceof SyntaxError)
      fail(source, `${key} contains invalid JSON: ${error.message}`)
    throw error
  }
}

function exact<T>(
  source: Object3D,
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) fail(source, `${path} has an unexpected value.`)
  return expected
}

function positive(source: Object3D, value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    fail(source, `${path} must be a positive finite number.`)
  return value
}

function zero(source: Object3D, value: unknown, path: string): 0 {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    Math.abs(value) > EPSILON
  )
    fail(source, `${path} must equal zero.`)
  return 0
}

function identityRoot(source: Object3D): void {
  const transform = [
    source.position.x,
    source.position.y,
    source.position.z,
    source.quaternion.x,
    source.quaternion.y,
    source.quaternion.z,
    source.quaternion.w,
    source.scale.x,
    source.scale.y,
    source.scale.z,
  ]
  if (
    !transform.every(Number.isFinite) ||
    Math.abs(source.position.x) > EPSILON ||
    Math.abs(source.position.y) > EPSILON ||
    Math.abs(source.position.z) > EPSILON ||
    Math.abs(source.quaternion.x) > EPSILON ||
    Math.abs(source.quaternion.y) > EPSILON ||
    Math.abs(source.quaternion.z) > EPSILON ||
    Math.abs(source.quaternion.w - 1) > EPSILON ||
    Math.abs(source.scale.x - 1) > EPSILON ||
    Math.abs(source.scale.y - 1) > EPSILON ||
    Math.abs(source.scale.z - 1) > EPSILON ||
    (!source.matrixAutoUpdate && !source.matrix.equals(new Matrix4()))
  )
    fail(source, 'root must use the identity transform at its contact datum.')
}

function readCollider(source: Object3D): CloudwayLaboratoryStaticColliderV1 {
  const raw = encodedObject(source, CLOUDWAY_LAB_STATIC_COLLIDER_KEY)
  exact(source, raw.shape, 'box', 'collider_json.shape')
  const width = positive(source, raw.width, 'collider_json.width')
  const depth = positive(source, raw.depth, 'collider_json.depth')
  const height = positive(source, raw.height, 'collider_json.height')
  const topY = zero(source, raw.topY, 'collider_json.topY')
  if (!Array.isArray(raw.center) || raw.center.length !== 3)
    fail(source, 'collider_json.center must contain three finite numbers.')
  const centre = raw.center.map((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value))
      fail(source, `collider_json.center[${index}] must be finite.`)
    return value
  })
  if (
    Math.abs(centre[0]!) > EPSILON ||
    Math.abs(centre[1]! + height / 2) > EPSILON ||
    Math.abs(centre[2]!) > EPSILON
  )
    fail(source, 'collider_json.center must be [0, -height / 2, 0].')
  return {
    shape: 'box',
    width,
    depth,
    height,
    topY,
    center: [0, centre[1]!, 0],
  }
}

function readMetadata(
  source: Object3D,
  expectedAssetId: string,
): CloudwayLaboratoryStaticMetadataV1 {
  const raw = encodedObject(source, CLOUDWAY_LAB_STATIC_METADATA_KEY)
  const schema = exact(
    source,
    raw.schema,
    'cloudway-lab-static-v1',
    'cloudway_lab_asset_json.schema',
  )
  const assetId = exact(
    source,
    raw.assetId,
    expectedAssetId,
    'cloudway_lab_asset_json.assetId',
  )
  const kind = exact(
    source,
    raw.kind,
    'platform',
    'cloudway_lab_asset_json.kind',
  )
  const coordinates = object(
    source,
    raw.coordinates,
    'cloudway_lab_asset_json.coordinates',
  )
  exact(
    source,
    coordinates.upAxis,
    '+Y',
    'cloudway_lab_asset_json.coordinates.upAxis',
  )
  exact(
    source,
    coordinates.units,
    'metres',
    'cloudway_lab_asset_json.coordinates.units',
  )
  exact(
    source,
    coordinates.origin,
    'landing-or-resting-datum',
    'cloudway_lab_asset_json.coordinates.origin',
  )
  const contact = object(source, raw.contact, 'cloudway_lab_asset_json.contact')
  exact(
    source,
    contact.kind,
    'rectangle',
    'cloudway_lab_asset_json.contact.kind',
  )
  const width = positive(
    source,
    contact.width,
    'cloudway_lab_asset_json.contact.width',
  )
  const depth = positive(
    source,
    contact.depth,
    'cloudway_lab_asset_json.contact.depth',
  )
  const topY = zero(
    source,
    contact.topY,
    'cloudway_lab_asset_json.contact.topY',
  )
  const height = positive(
    source,
    contact.height,
    'cloudway_lab_asset_json.contact.height',
  )
  const material = object(
    source,
    raw.material,
    'cloudway_lab_asset_json.material',
  )
  const materialKind = exact(
    source,
    material.kind,
    'provider-pbr',
    'cloudway_lab_asset_json.material.kind',
  )
  if (
    typeof material.appearanceStatus !== 'string' ||
    typeof material.intendedAppearance !== 'string'
  )
    fail(source, 'static material status and intended appearance are required.')
  const geometry = object(
    source,
    raw.geometry,
    'cloudway_lab_asset_json.geometry',
  )
  const triangles = positive(
    source,
    geometry.triangles,
    'cloudway_lab_asset_json.geometry.triangles',
  )
  exact(
    source,
    geometry.decimated,
    false,
    'cloudway_lab_asset_json.geometry.decimated',
  )
  exact(
    source,
    geometry.remeshed,
    false,
    'cloudway_lab_asset_json.geometry.remeshed',
  )
  return {
    schema,
    assetId,
    kind,
    coordinates: {
      upAxis: '+Y',
      units: 'metres',
      origin: 'landing-or-resting-datum',
    },
    contact: { kind: 'rectangle', width, depth, topY, height },
    material: {
      kind: materialKind,
      appearanceStatus: material.appearanceStatus,
      intendedAppearance: material.intendedAppearance,
    },
    geometry: { triangles, decimated: false, remeshed: false },
  }
}

export function validateCloudwayLaboratoryStaticDonor(
  source: Object3D,
  expectedAssetId: string,
): ValidatedCloudwayLaboratoryStaticDonor {
  identityRoot(source)
  const collider = readCollider(source)
  const metadata = readMetadata(source, expectedAssetId)
  if (
    Math.abs(collider.width - metadata.contact.width) > EPSILON ||
    Math.abs(collider.depth - metadata.contact.depth) > EPSILON ||
    Math.abs(collider.height - metadata.contact.height) > EPSILON
  )
    fail(source, 'collider_json must match the certified contact declaration.')
  let triangles = 0
  let meshes = 0
  source.traverse((object) => {
    if (
      'material' in object &&
      (!(object as Mesh).isMesh ||
        'skeleton' in object ||
        'instanceMatrix' in object)
    )
      fail(source, `Node "${object.name}" is not a supported static Mesh.`)
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    if (
      Array.isArray(mesh.material) ||
      !(mesh.material as MeshPhysicalMaterial).isMeshStandardMaterial
    )
      fail(source, `Mesh "${mesh.name}" needs one imported PBR material.`)
    const physical = mesh.material as MeshPhysicalMaterial
    if (
      ![
        physical.opacity,
        physical.roughness,
        physical.metalness,
        physical.color.r,
        physical.color.g,
        physical.color.b,
        ...(physical.isMeshPhysicalMaterial ? [physical.transmission] : []),
      ].every(Number.isFinite)
    )
      fail(source, `Mesh "${mesh.name}" has non-finite PBR material values.`)
    if (physical.transparent || physical.opacity !== 1)
      fail(source, `Mesh "${mesh.name}" must be fully opaque provider PBR.`)
    if (physical.isMeshPhysicalMaterial && physical.transmission !== 0)
      fail(source, `Mesh "${mesh.name}" must preserve opaque provider PBR.`)
    const indexCount = mesh.geometry.index?.count
    if (indexCount === undefined || indexCount % 3 !== 0)
      fail(source, `Mesh "${mesh.name}" needs indexed triangle geometry.`)
    triangles += indexCount / 3
    meshes++
  })
  if (meshes === 0 || triangles !== metadata.geometry.triangles)
    fail(source, 'loaded triangle inventory differs from the runtime metadata.')
  return { collider, metadata }
}
