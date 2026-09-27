// Cloudway encounter compiler — validates voice exhibits and certified barrier collision.

import { EXHIBIT_PLINTH } from '../content/solid-props.ts'
import type { BreakableDefinition, PlatformDefinition, PlatformRenderQuarterTurns, SolidPropDefinition, Vec3, } from '../contracts'
import { containsBody } from '../core/collision.ts'
import { MOVEMENT } from '../core/movement.ts'
import type { CloudwayBarrierBoxProfile, CloudwayBarrierProfile, CloudwayCourseProfileCatalog, } from './cloudway-course-profiles'
import { boolean, cardinalQuarterTurns, CLOUDWAY_GAP_TOLERANCE, exactKeys, fail, finite, identifierSet, record, string, stringArray, vec3, } from './cloudway-course-validation.ts'
import { compileCloudwayChallenge } from './compile-cloudway-melody.ts'
import { transformPoint } from './transform.ts'

function validateBarrierProfile(
  profile: CloudwayBarrierProfile,
  path: string,
): void {
  if (profile.id.length === 0 || profile.variant.length === 0)
    fail(path, 'must use non-empty profile and variant ids.')
  if (profile.frameSides.length < 2)
    fail(
      `${path}.frameSides`,
      'must contain at least two permanent frame solids.',
    )
  for (const [name, box] of [
    ['gate', profile.gate],
    ...profile.frameSides.map(
      (side, index) => [`frameSides[${index}]`, side] as const,
    ),
  ] as const) {
    if (box.id.length === 0) fail(`${path}.${name}.id`, 'must not be empty.')
    for (const [field, value] of [
      ['bottomCenter.x', box.bottomCenter.x],
      ['bottomCenter.y', box.bottomCenter.y],
      ['bottomCenter.z', box.bottomCenter.z],
      ['width', box.width],
      ['height', box.height],
      ['depth', box.depth],
    ] as const)
      if (!Number.isFinite(value) || (field.indexOf('.') === -1 && value <= 0))
        fail(
          `${path}.${name}.${field}`,
          'must be finite and dimensions positive.',
        )
  }
  identifierSet(
    [profile.gate.id, ...profile.frameSides.map((side) => side.id)],
    path,
  )
}

function barrierSolid(
  encounterId: string,
  targetPosition: Vec3,
  turns: PlatformRenderQuarterTurns,
  box: CloudwayBarrierBoxProfile,
  gate: boolean,
): SolidPropDefinition {
  const center = transformPoint(box.bottomCenter, {
    translate: targetPosition,
    yawQuarterTurns: turns,
  })
  const width = turns % 2 === 0 ? box.width : box.depth
  const depth = turns % 2 === 0 ? box.depth : box.width
  return {
    id: `barrier:${encounterId}:${box.id}`,
    kind: 'prop',
    shape: 'box',
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minZ: center.z - depth / 2,
    maxZ: center.z + depth / 2,
    top: center.y + box.height,
    thickness: box.height,
    activation: gate ? { noneCompleted: [encounterId] } : undefined,
    presentation: box.presentation,
    fallback: box.fallback,
  }
}

export interface CompiledEncounter {
  definition: BreakableDefinition
  solids: readonly SolidPropDefinition[]
}

export function compileEncounter(
  raw: unknown,
  catalog: CloudwayCourseProfileCatalog,
  path: string,
  schemaVersion: 2 | 3 = 2,
): CompiledEncounter {
  const source = record(raw, path)
  exactKeys(
    source,
    path,
    [
      'id',
      'label',
      'variant',
      'position',
      'anchor',
      'optional',
      schemaVersion === 2 ? 'challengeProfileId' : 'challenge',
    ],
    ['requiresCompleted', 'presentation'],
  )
  const id = string(source.id, `${path}.id`)
  const variant = string(source.variant, `${path}.variant`)
  const position = vec3(source.position, `${path}.position`)
  const anchor = vec3(source.anchor, `${path}.anchor`)
  const challenge = compileCloudwayChallenge(source, schemaVersion, path)
  let presentation: BreakableDefinition['presentation']
  let solids: readonly SolidPropDefinition[]
  let barrierFacingYaw: number | undefined
  if (source.presentation === undefined) {
    if (!catalog.encounterVariants.includes(variant))
      fail(
        `${path}.variant`,
        `references unknown encounter variant "${variant}".`,
      )
    solids = [
      {
        id: `plinth:${id}`,
        kind: 'prop',
        shape: 'cylinder',
        x: position.x,
        z: position.z,
        top: position.y + EXHIBIT_PLINTH.height,
        thickness: EXHIBIT_PLINTH.height,
        radiusTop: EXHIBIT_PLINTH.radiusTop,
        radiusBottom: EXHIBIT_PLINTH.radiusBottom,
      },
    ]
    const envelope = catalog.intactExhibits?.[variant]
    if (envelope !== undefined) {
      for (const [field, value] of Object.entries(envelope))
        if (!Number.isFinite(value) || value <= 0)
          fail(`profiles.intactExhibits.${variant}.${field}`, 'must be positive and finite.')
      solids = [...solids, {
        id: `intact:${id}`, kind: 'prop', shape: 'box',
        minX: position.x - envelope.width / 2, maxX: position.x + envelope.width / 2,
        minZ: position.z - envelope.depth / 2, maxZ: position.z + envelope.depth / 2,
        top: position.y + envelope.mountHeight + envelope.height, thickness: envelope.height,
        activation: { noneCompleted: [id] },
      }]
    }
  } else {
    const authored = record(source.presentation, `${path}.presentation`)
    exactKeys(authored, `${path}.presentation`, [
      'kind',
      'profileId',
      'facingYaw',
    ])
    if (authored.kind !== 'barrier')
      fail(`${path}.presentation.kind`, 'must be barrier.')
    const profileId = string(
      authored.profileId,
      `${path}.presentation.profileId`,
    )
    const profile = catalog.barriers[profileId]
    if (profile === undefined)
      fail(
        `${path}.presentation.profileId`,
        `references unknown certified barrier profile "${profileId}".`,
      )
    validateBarrierProfile(profile, `profiles.barriers.${profileId}`)
    if (profile.variant !== variant)
      fail(
        `${path}.variant`,
        `must match barrier variant "${profile.variant}".`,
      )
    const facingYaw = finite(
      authored.facingYaw,
      `${path}.presentation.facingYaw`,
    )
    const turns = cardinalQuarterTurns(
      facingYaw,
      `${path}.presentation.facingYaw`,
    )
    barrierFacingYaw = facingYaw
    presentation = { kind: 'barrier', facingYaw }
    solids = [
      barrierSolid(id, position, turns, profile.gate, true),
      ...profile.frameSides.map((side) =>
        barrierSolid(id, position, turns, side, false),
      ),
    ]
  }
  if (barrierFacingYaw !== undefined) {
    const towardAnchorX = anchor.x - position.x
    const towardAnchorZ = anchor.z - position.z
    const frontX = Math.sin(barrierFacingYaw)
    const frontZ = Math.cos(barrierFacingYaw)
    if (
      towardAnchorX * frontX + towardAnchorZ * frontZ <=
      CLOUDWAY_GAP_TOLERANCE
    )
      fail(
        `${path}.anchor`,
        'must stand on the visual front side of the barrier.',
      )
  }
  return {
    definition: {
      id,
      label: string(source.label, `${path}.label`),
      variant,
      position,
      anchor,
      optional: boolean(source.optional, `${path}.optional`),
      requiresCompleted:
        source.requiresCompleted === undefined
          ? undefined
          : stringArray(source.requiresCompleted, `${path}.requiresCompleted`),
      challenge,
      presentation,
    },
    solids,
  }
}

function supportingStaticPlatform(
  position: Vec3,
  platforms: readonly PlatformDefinition[],
): PlatformDefinition | undefined {
  return platforms.find(
    (platform) =>
      platform.behavior === undefined &&
      platform.surface === undefined &&
      containsBody(
        position,
        { radius: MOVEMENT.radius, height: MOVEMENT.height },
        platform,
      ),
  )
}

export function validateStaticAnchor(
  position: Vec3,
  platforms: readonly PlatformDefinition[],
  path: string,
): void {
  if (supportingStaticPlatform(position, platforms) === undefined)
    fail(
      path,
      'must place Merc fully on a behaviorless static platform without a tuned surface.',
    )
}

export function requireKnownReferences(
  values: readonly string[],
  known: ReadonlySet<string>,
  path: string,
): void {
  for (const [index, value] of values.entries())
    if (!known.has(value))
      fail(`${path}[${index}]`, `references unknown encounter "${value}".`)
}

export function validateEncounterGraph(
  breakables: readonly BreakableDefinition[],
): void {
  const known = identifierSet(
    breakables.map((target) => target.id),
    'encounters',
  )
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(breakables.map((target) => [target.id, target]))
  const visit = (id: string): void => {
    if (visiting.has(id))
      fail(`encounters.${id}.requiresCompleted`, 'forms a cycle.')
    if (visited.has(id)) return
    visiting.add(id)
    const target = byId.get(id)!
    const dependencies = target.requiresCompleted ?? []
    requireKnownReferences(
      dependencies,
      known,
      `encounters.${id}.requiresCompleted`,
    )
    for (const dependency of dependencies) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const target of breakables) visit(target.id)
}
