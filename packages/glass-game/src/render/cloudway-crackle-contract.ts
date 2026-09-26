// Cloudway crackle contract — validate authored contact and disjoint visual roles before accepting fracture art.

import type { Mesh, Object3D } from 'three'
import { Matrix4 } from 'three'
import type { PlatformDefinition } from '../contracts'
import { PLATFORM_RENDER_QUARTER_TURNS } from '../contracts'

function check(condition: unknown, detail: string): asserts condition {
  if (condition !== true) throw new Error(`Cloudway crackle donor: ${detail}`)
}

function record(value: unknown): Record<string, unknown> {
  check(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'expected an object.',
  )
  return value as Record<string, unknown>
}

function extra(source: Object3D, key: string): Record<string, unknown> {
  const encoded: unknown = source.userData[key]
  check(typeof encoded === 'string', `${key} must contain JSON metadata.`)
  return record(JSON.parse(encoded))
}

function positive(value: unknown): number {
  check(
    typeof value === 'number' && Number.isFinite(value) && value > 0,
    'dimensions must be positive and finite.',
  )
  return value
}

function near(left: unknown, right: number): boolean {
  return (
    typeof left === 'number' &&
    Number.isFinite(left) &&
    Math.abs(left - right) < 1e-6
  )
}

function names(value: unknown): string[] {
  check(Array.isArray(value), 'roles must be arrays of node names.')
  return value.map((name) => {
    check(
      typeof name === 'string' && name.length > 0,
      'role names must be nonempty strings.',
    )
    return name
  })
}

function role(source: Object3D, name: unknown): Object3D {
  check(typeof name === 'string' && name.length > 0, 'missing role name.')
  const matches: Object3D[] = []
  source.traverse((node) => {
    if (node !== source && node.name === name) matches.push(node)
  })
  check(matches.length === 1, `role ${name} must exist exactly once.`)
  return matches[0]!
}

export function validateCloudwayCrackleDonor(
  source: Object3D,
  platform: PlatformDefinition,
) {
  check(
    platform.behavior?.kind === 'crackle',
    'platform must use crackle behavior.',
  )
  check(
    [
      source.position.x,
      source.position.y,
      source.position.z,
      source.quaternion.x,
      source.quaternion.y,
      source.quaternion.z,
    ].every((value) => near(value, 0)) &&
      near(source.quaternion.w, 1) &&
      source.scale.toArray().every((value) => near(value, 1)) &&
      (source.matrixAutoUpdate || source.matrix.equals(new Matrix4())),
    'root must have an identity transform.',
  )
  const metadata = extra(source, 'platform_adapter_json')
  check(metadata.version === 1, 'unsupported metadata version.')
  const coordinates = record(metadata.coordinates)
  check(
    coordinates.upAxis === '+Y' &&
      coordinates.units === 'metres' &&
      coordinates.origin === 'top-centre-of-fully-extended-support',
    'unsupported coordinate convention.',
  )
  const support = record(metadata.support)
  check(
    support.state === 'intact' && support.topY === 0,
    'support must describe the intact top datum.',
  )
  const width = positive(support.width),
    depth = positive(support.depth)
  const collider = extra(source, 'collider_json')
  const height = positive(collider.height)
  check(
    collider.shape === 'box' &&
      collider.topY === 0 &&
      near(collider.width, width) &&
      near(collider.depth, depth),
    'collider must match certified support.',
  )
  check(
    Array.isArray(collider.center) &&
      collider.center.length === 3 &&
      near(collider.center[0], 0) &&
      near(collider.center[1], -height / 2) &&
      near(collider.center[2], 0),
    'collider center must match its top datum.',
  )
  const turns = platform.renderQuarterTurns ?? 0
  check(
    PLATFORM_RENDER_QUARTER_TURNS.includes(turns),
    'unsupported quarter turns.',
  )
  check(
    near(platform.maxX - platform.minX, turns % 2 ? depth : width) &&
      near(platform.maxZ - platform.minZ, turns % 2 ? width : depth) &&
      near(platform.thickness, height) &&
      [
        platform.minX,
        platform.maxX,
        platform.minZ,
        platform.maxZ,
        platform.top,
      ].every(Number.isFinite),
    'platform bounds must match certified contact without stretching.',
  )
  const motion = record(metadata.motion)
  check(motion.kind === 'crackle', 'motion must be crackle.')
  const roles = record(motion.roles)
  const intact = role(source, roles.intactGlass)
  const contact = role(source, roles.contact)
  const persistent = names(roles.persistent).map((name) => role(source, name))
  const shards = names(roles.shards).map((name) => role(source, name))
  check(
    shards.length >= 2 && shards.length <= 64,
    'expected 2–64 authored shards.',
  )
  const owners = new Map<Object3D, Object3D>()
  const visual = [intact, ...persistent, ...shards]
  for (const owner of [...visual, contact]) {
    owner.traverse((node) => {
      check(
        !owners.has(node),
        'roles must be distinct and may not contain each other.',
      )
      owners.set(node, owner)
    })
    let meshes = 0
    owner.traverse((node) => {
      if ((node as Mesh).isMesh) meshes++
    })
    check(meshes > 0, `role ${owner.name} contains no geometry.`)
  }
  const meshNames = new Set<string>()
  source.traverse((node) => {
    const mesh = node as Mesh
    const flags = node as Object3D & {
      isLine?: boolean
      isPoints?: boolean
      isSprite?: boolean
      isSkinnedMesh?: boolean
      isInstancedMesh?: boolean
    }
    check(
      flags.isLine !== true &&
        flags.isPoints !== true &&
        flags.isSprite !== true &&
        flags.isSkinnedMesh !== true &&
        flags.isInstancedMesh !== true,
      'only ordinary static meshes are supported.',
    )
    check(
      node.matrix.elements.every(Number.isFinite) &&
        node.position.toArray().every(Number.isFinite) &&
        node.quaternion.toArray().every(Number.isFinite) &&
        node.scale
          .toArray()
          .every((value) => Number.isFinite(value) && value > 0),
      'node transforms must be finite with positive scale.',
    )
    if (!mesh.isMesh) return
    check(owners.has(node), `mesh ${node.name} has no declared role.`)
    check(
      node.name.length > 0 && !meshNames.has(node.name),
      'mesh names must be unique.',
    )
    meshNames.add(node.name)
    check(
      mesh.geometry.getAttribute('position')?.count > 0,
      'mesh geometry must contain positions.',
    )
  })
  return {
    intact,
    contact,
    persistent,
    shards,
    visual,
    turns,
    width,
    depth,
    height,
  }
}
