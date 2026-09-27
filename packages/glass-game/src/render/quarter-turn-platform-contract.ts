// Pearl quarter-turn donor contract — validate tiered art against named support, dock and render nodes before installation.

import type { Material, Mesh, Object3D } from 'three'
import { Box3, Vector3 } from 'three'
import { PEARL_QUARTER_TURN_NODES, PEARL_QUARTER_TURN_SUPPORT, PEARL_QUARTER_TURN_TIER_TRIANGLES, } from '../content/pearl-quarter-turn-profile'

export type PearlQuarterTurnTier =
  keyof typeof PEARL_QUARTER_TURN_TIER_TRIANGLES

export interface PearlQuarterTurnContract {
  readonly tier: PearlQuarterTurnTier
  readonly triangles: number
  readonly draws: number
  readonly visual: Object3D
}

// Mesh quantization may move a decoded visual extreme by a few hundredths of a
// millimetre; authored support and dock nodes remain well inside this bound.
const EPSILON = 5e-5

function fail(detail: string): never {
  throw new Error(`Pearl quarter-turn donor: ${detail}`)
}

function exactNamedObject(source: Object3D, name: string): Object3D {
  const matches: Object3D[] = []
  source.traverse((object) => {
    if (object.name === name) matches.push(object)
  })
  if (matches.length !== 1)
    fail(`expected one node "${name}"; found ${matches.length}.`)
  return matches[0]!
}

function close(left: number, right: number): boolean {
  return Number.isFinite(left) && Math.abs(left - right) <= EPSILON
}

function assertVector(
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
    fail(
      `${label} does not match the reviewed glTF-space value (${JSON.stringify(actual)} vs ${JSON.stringify(expected)}).`,
    )
}

function nodePosition(source: Object3D, name: string): readonly number[] {
  const node = exactNamedObject(source, name)
  return [node.position.x, node.position.y, node.position.z]
}

function materials(mesh: Mesh): readonly Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

export function validatePearlQuarterTurnDonor(
  source: Object3D,
): PearlQuarterTurnContract {
  if (source.name !== PEARL_QUARTER_TURN_NODES.root)
    fail(`root must be named "${PEARL_QUARTER_TURN_NODES.root}".`)
  const encoded: unknown = source.userData.asset_contract_json
  if (typeof encoded !== 'string') fail('root is missing asset_contract_json.')
  let contract: {
    schema?: unknown
    assetId?: unknown
    tier?: unknown
    coordinateSystem?: unknown
    rootNode?: unknown
    renderNode?: unknown
    bounds?: { min?: unknown[]; max?: unknown[] }
    render?: {
      triangles?: unknown
      meshDrawsPerPass?: unknown
      materialRoles?: unknown[]
    }
    support?: {
      kind?: unknown
      topY?: unknown
      anchorNode?: unknown
      anchor?: unknown[]
      playableArmWidth?: unknown
      horizontalScale?: unknown
      boxes?: {
        node?: unknown
        centre?: unknown[]
        size?: unknown[]
      }[]
    }
    docks?: {
      node?: unknown
      position?: unknown[]
      outwardAxis?: unknown
    }[]
  }
  try {
    contract = JSON.parse(encoded) as typeof contract
  } catch {
    fail('asset_contract_json is not valid JSON.')
  }
  const tier = contract.tier
  if (tier !== 'desktop' && tier !== 'mobile')
    fail('tier must be desktop or mobile.')
  if (
    contract.schema !== 1 ||
    contract.assetId !== 'pearl-teal-quarter-turn-a-v1' ||
    contract.coordinateSystem !== 'glTF +Y-up, metres' ||
    contract.rootNode !== PEARL_QUARTER_TURN_NODES.root ||
    contract.renderNode !== PEARL_QUARTER_TURN_NODES.visual
  )
    fail('identity or coordinate metadata is not the reviewed v1 contract.')
  if (
    contract.support?.kind !== 'union-boxes' ||
    contract.support.anchorNode !== PEARL_QUARTER_TURN_NODES.supportAnchor ||
    !close(contract.support.topY as number, PEARL_QUARTER_TURN_SUPPORT.topY) ||
    !close(
      contract.support.playableArmWidth as number,
      PEARL_QUARTER_TURN_SUPPORT.playableArmWidth,
    ) ||
    !close(
      contract.support.horizontalScale as number,
      PEARL_QUARTER_TURN_SUPPORT.horizontalScale,
    )
  )
    fail('support metadata is not the reviewed measured union.')
  assertVector(
    contract.support.anchor,
    PEARL_QUARTER_TURN_SUPPORT.anchor,
    'support anchor metadata',
  )
  assertVector(
    nodePosition(source, PEARL_QUARTER_TURN_NODES.supportAnchor),
    PEARL_QUARTER_TURN_SUPPORT.anchor,
    'support anchor node',
  )

  if (contract.support.boxes?.length !== 2)
    fail('support must contain exactly two boxes.')
  PEARL_QUARTER_TURN_SUPPORT.boxes.forEach((expected, index) => {
    const declared = contract.support?.boxes?.[index]
    if (declared?.node !== expected.node)
      fail(`support box ${index} names the wrong node.`)
    assertVector(
      declared.centre,
      expected.centre,
      `support box ${index} centre`,
    )
    assertVector(declared.size, expected.size, `support box ${index} size`)
    assertVector(
      nodePosition(source, expected.node),
      expected.centre,
      `${expected.node} node`,
    )
    const node = exactNamedObject(source, expected.node)
    assertVector(
      node.userData.size_glTF as unknown[] | undefined,
      expected.size,
      `${expected.node} size`,
    )
  })

  if (contract.docks?.length !== 2)
    fail('contract must contain exactly two docks.')
  PEARL_QUARTER_TURN_SUPPORT.docks.forEach((expected, index) => {
    const declared = contract.docks?.[index]
    if (
      declared?.node !== expected.node ||
      declared.outwardAxis !== expected.outwardAxis
    )
      fail(`dock ${index} metadata is not the reviewed endpoint.`)
    assertVector(declared.position, expected.position, `dock ${index} position`)
    assertVector(
      nodePosition(source, expected.node),
      expected.position,
      `${expected.node} node`,
    )
  })

  const expectedTriangles = PEARL_QUARTER_TURN_TIER_TRIANGLES[tier]
  if (
    contract.render?.triangles !== expectedTriangles ||
    contract.render.meshDrawsPerPass !== 3 ||
    JSON.stringify(contract.render.materialRoles) !==
      JSON.stringify(['marble', 'gold-hardware', 'teal-inlay'])
  )
    fail('render inventory is not the reviewed three-role tier.')
  const visual = exactNamedObject(source, PEARL_QUARTER_TURN_NODES.visual)
  let triangles = 0
  let draws = 0
  const materialNames = new Set<string>()
  visual.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return
    const index = mesh.geometry.getIndex()
    triangles +=
      (index?.count ?? mesh.geometry.getAttribute('position').count) / 3
    const groups = mesh.geometry.groups.length
    draws += groups === 0 ? materials(mesh).length : groups
    materials(mesh).forEach((material) => materialNames.add(material.name))
  })
  if (triangles !== expectedTriangles || draws !== 3)
    fail(
      `decoded render inventory is ${triangles} triangles and ${draws} draws.`,
    )
  const suffix = tier === 'desktop' ? 'Desktop' : 'Mobile'
  const expectedMaterials = [
    `QuarterTurnA_Marble_${suffix}`,
    `QuarterTurnA_GoldHardware_${suffix}`,
    `QuarterTurnA_TealInlay_${suffix}`,
  ]
  if (
    materialNames.size !== expectedMaterials.length ||
    expectedMaterials.some((name) => !materialNames.has(name))
  )
    fail('decoded render materials do not match the tiered semantic roles.')

  const bounds = new Box3().setFromObject(visual)
  assertVector(
    contract.bounds?.min,
    bounds.min.toArray(new Array<number>(3)),
    'render bounds minimum',
  )
  assertVector(
    contract.bounds?.max,
    bounds.max.toArray(new Array<number>(3)),
    'render bounds maximum',
  )
  if (bounds.getSize(new Vector3()).lengthSq() === 0)
    fail('visual bounds must contain visible geometry.')
  return { tier, triangles, draws, visual }
}
