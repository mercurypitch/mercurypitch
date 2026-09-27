// Living-crystal donor contract — reject wrong support, semantic nodes, depth encoding or runtime cost before installation.

import type { BufferAttribute, Material, Mesh, Object3D } from 'three'
import { Box3, Vector3 } from 'three'
import { LIVING_CRYSTAL_PLATFORM_BUNDLE_ID, LIVING_CRYSTAL_PLATFORM_NODES, LIVING_CRYSTAL_PLATFORM_RUNTIME, LIVING_CRYSTAL_PLATFORM_SUPPORT, } from '../content/living-crystal-profile'

const EPSILON = 6e-5

export interface LivingCrystalPlatformContract {
  readonly root: Object3D
  readonly shell: Mesh
  readonly hardware: Mesh
  readonly interior: Mesh
  readonly triangles: number
  readonly draws: number
}

function fail(detail: string): never {
  throw new Error(`Living-crystal platform donor: ${detail}`)
}

function close(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) <= EPSILON
}

function exactObject(source: Object3D, name: string): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object.name === name) matches.push(object)
  })
  if (matches.length !== 1)
    fail(`expected one node "${name}"; found ${matches.length}.`)
  return matches[0]!
}

function exactMesh(source: Object3D, name: string): Mesh {
  const object = exactObject(source, name) as Mesh
  if (!object.isMesh) fail(`node "${name}" must be one Mesh.`)
  if (Array.isArray(object.material))
    fail(`node "${name}" must use one material and one draw.`)
  return object
}

function vector(
  actual: readonly unknown[] | undefined,
  expected: readonly number[],
  label: string,
): void {
  if (
    actual?.length !== expected.length ||
    expected.some(
      (value, index) =>
        typeof actual[index] !== 'number' ||
        !close(actual[index] as number, value),
    )
  )
    fail(`${label} does not match ${JSON.stringify(expected)}.`)
}

function materialHasTexture(material: Material): boolean {
  const values = material as unknown as Record<string, unknown>
  return [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'aoMap',
    'emissiveMap',
    'alphaMap',
  ].some(
    (key) =>
      (values[key] as { isTexture?: boolean } | null)?.isTexture === true,
  )
}

function triangles(mesh: Mesh): number {
  return (
    (mesh.geometry.getIndex()?.count ??
      mesh.geometry.getAttribute('position').count) / 3
  )
}

function bounds(mesh: Mesh): Box3 {
  mesh.updateWorldMatrix(true, false)
  return new Box3().setFromObject(mesh, true)
}

function checkAxis(
  measured: Box3,
  minimum: readonly number[],
  maximum: readonly number[],
  label: string,
): void {
  const actualMinimum = measured.min.toArray()
  const actualMaximum = measured.max.toArray()
  if (
    minimum.some((value, axis) => !close(actualMinimum[axis]!, value)) ||
    maximum.some((value, axis) => !close(actualMaximum[axis]!, value))
  )
    fail(
      `${label} bounds are ${JSON.stringify(actualMinimum)}..${JSON.stringify(actualMaximum)}.`,
    )
}

function assertInteriorEncoding(attribute: BufferAttribute | undefined): void {
  if (
    attribute === undefined ||
    attribute.itemSize !== 3 ||
    attribute.count === 0
  )
    fail('interior must export one COLOR_0 vec3 phase/depth/pearl attribute.')
  const depths = new Set<number>()
  let pearls = 0
  for (let index = 0; index < attribute.count; index++) {
    const values = [
      attribute.getX(index),
      attribute.getY(index),
      attribute.getZ(index),
    ]
    if (
      values.some((value) => !Number.isFinite(value)) ||
      values.some((value) => value < -EPSILON || value > 1 + EPSILON)
    )
      fail('interior COLOR_0 contains an invalid normalized value.')
    const depth = values[1]!
    if (depth < 0.25) depths.add(0)
    else if (depth > 0.75) depths.add(2)
    else depths.add(1)
    if (values[2]! > 0.72) pearls++
  }
  if (depths.size !== LIVING_CRYSTAL_PLATFORM_RUNTIME.depthLayers)
    fail('interior COLOR_0 does not represent all three depth layers.')
  if (pearls === 0) fail('interior COLOR_0 has no pearl-marked vertices.')
}

export function validateLivingCrystalPlatformDonor(
  source: Object3D,
): LivingCrystalPlatformContract {
  if (source.name !== LIVING_CRYSTAL_PLATFORM_NODES.root)
    fail(`root must be named "${LIVING_CRYSTAL_PLATFORM_NODES.root}".`)
  const encoded: unknown = source.userData.asset_contract_json
  if (typeof encoded !== 'string') fail('root is missing asset_contract_json.')
  let contract: {
    schema?: unknown
    assetId?: unknown
    coordinateSystem?: unknown
    rootNode?: unknown
    nodes?: Record<string, unknown>
    support?: {
      kind?: unknown
      size?: unknown[]
      topY?: unknown
      centre?: unknown[]
    }
    interior?: {
      minimumSurfaceClearance?: unknown
      pathManifestSha256?: unknown
      depthLayers?: unknown
      pearlCount?: unknown
    }
    render?: {
      meshDrawsPerPass?: unknown
      textures?: unknown
      triangles?: unknown
      materialRoles?: unknown[]
    }
  }
  try {
    contract = JSON.parse(encoded) as typeof contract
  } catch {
    fail('asset_contract_json is not valid JSON.')
  }
  if (
    contract.schema !== 1 ||
    contract.assetId !== LIVING_CRYSTAL_PLATFORM_BUNDLE_ID ||
    contract.coordinateSystem !== 'glTF +Y-up, metres' ||
    contract.rootNode !== LIVING_CRYSTAL_PLATFORM_NODES.root
  )
    fail('identity or coordinate metadata is not the reviewed v2 contract.')
  for (const [role, name] of Object.entries(LIVING_CRYSTAL_PLATFORM_NODES))
    if (role !== 'root' && contract.nodes?.[role] !== name)
      fail(`contract names the wrong ${role} node.`)
  if (
    contract.support?.kind !== 'box' ||
    !close(
      contract.support.topY as number,
      LIVING_CRYSTAL_PLATFORM_SUPPORT.topY,
    )
  )
    fail('support metadata is not the reviewed static box.')
  vector(
    contract.support.size,
    [
      LIVING_CRYSTAL_PLATFORM_SUPPORT.width,
      LIVING_CRYSTAL_PLATFORM_SUPPORT.height,
      LIVING_CRYSTAL_PLATFORM_SUPPORT.depth,
    ],
    'support size',
  )
  vector(
    contract.support.centre,
    LIVING_CRYSTAL_PLATFORM_SUPPORT.centre,
    'support centre',
  )
  const anchor = exactObject(
    source,
    LIVING_CRYSTAL_PLATFORM_NODES.supportAnchor,
  )
  vector(anchor.position.toArray(), [0, 0, 0], 'support anchor node')
  if (
    !close(
      contract.interior?.minimumSurfaceClearance as number,
      LIVING_CRYSTAL_PLATFORM_SUPPORT.minimumInteriorClearance,
    ) ||
    contract.interior?.pathManifestSha256 !==
      LIVING_CRYSTAL_PLATFORM_RUNTIME.pathManifestSha256 ||
    contract.interior?.depthLayers !==
      LIVING_CRYSTAL_PLATFORM_RUNTIME.depthLayers ||
    contract.interior?.pearlCount !== LIVING_CRYSTAL_PLATFORM_RUNTIME.pearlCount
  )
    fail('interior metadata is not the reviewed path delivery.')
  if (
    contract.render?.meshDrawsPerPass !==
      LIVING_CRYSTAL_PLATFORM_RUNTIME.meshDrawsPerPass ||
    contract.render.textures !== LIVING_CRYSTAL_PLATFORM_RUNTIME.textures ||
    contract.render.triangles !== LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles ||
    JSON.stringify(contract.render.materialRoles) !==
      JSON.stringify([
        'rose-crystal-shell',
        'gold-hardware',
        'pearl-root-interior',
      ])
  )
    fail('render inventory is not the reviewed three-role delivery.')

  const shell = exactMesh(source, LIVING_CRYSTAL_PLATFORM_NODES.shell)
  const hardware = exactMesh(source, LIVING_CRYSTAL_PLATFORM_NODES.hardware)
  const interior = exactMesh(source, LIVING_CRYSTAL_PLATFORM_NODES.interior)
  checkAxis(
    bounds(shell),
    [
      -LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
      -LIVING_CRYSTAL_PLATFORM_SUPPORT.height,
      -LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    ],
    [
      LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2,
      0,
      LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2,
    ],
    'shell',
  )
  const interiorBounds = bounds(interior)
  const clearance = LIVING_CRYSTAL_PLATFORM_SUPPORT.minimumInteriorClearance
  const allowedMinimum = new Vector3(
    -LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2 + clearance,
    -LIVING_CRYSTAL_PLATFORM_SUPPORT.height + clearance,
    -LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2 + clearance,
  )
  const allowedMaximum = new Vector3(
    LIVING_CRYSTAL_PLATFORM_SUPPORT.width / 2 - clearance,
    -clearance,
    LIVING_CRYSTAL_PLATFORM_SUPPORT.depth / 2 - clearance,
  )
  if (
    interiorBounds.min.x < allowedMinimum.x - EPSILON ||
    interiorBounds.min.y < allowedMinimum.y - EPSILON ||
    interiorBounds.min.z < allowedMinimum.z - EPSILON ||
    interiorBounds.max.x > allowedMaximum.x + EPSILON ||
    interiorBounds.max.y > allowedMaximum.y + EPSILON ||
    interiorBounds.max.z > allowedMaximum.z + EPSILON
  )
    fail('evaluated interior surface violates the 4 cm shell clearance.')
  assertInteriorEncoding(
    interior.geometry.getAttribute('color') as BufferAttribute | undefined,
  )
  const meshes = [shell, hardware, interior]
  const decodedTriangles = meshes.reduce(
    (total, mesh) => total + triangles(mesh),
    0,
  )
  if (decodedTriangles !== LIVING_CRYSTAL_PLATFORM_RUNTIME.triangles)
    fail(`decoded triangle count is ${decodedTriangles}.`)
  const expectedMaterials = [
    'LivingCrystalV2_Shell_Rose',
    'LivingCrystalV2_Hardware_Gold',
    'LivingCrystalV2_Interior_PearlRoot',
  ]
  meshes.forEach((mesh, index) => {
    const material = mesh.material
    if (Array.isArray(material))
      fail(`node "${mesh.name}" unexpectedly uses multiple materials.`)
    if (material.name !== expectedMaterials[index])
      fail(`node "${mesh.name}" uses unreviewed material "${material.name}".`)
    if (materialHasTexture(material))
      fail(`node "${mesh.name}" unexpectedly ships a texture.`)
  })
  return {
    root: source,
    shell,
    hardware,
    interior,
    triangles: decodedTriangles,
    draws: meshes.length,
  }
}
