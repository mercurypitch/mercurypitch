// Cloudway platform compiler — materializes certified contacts and measured route gaps.

import type { BoundsXZ, IntentionalGapDefinition, PlatformDefinition, PlatformRenderQuarterTurns, Vec3, } from '../contracts'
import { intentionalGapDefinitionError } from '../core/collision.ts'
import { platformRuntimeDefinitionError } from '../core/platform-runtime.ts'
import type { CloudwayCourseProfileCatalog, CloudwayPlatformProfile, } from './cloudway-course-profiles'
import type { CloudwayCourseGapSource, CloudwayCourseGapState, } from './cloudway-course-source'
import type { JsonRecord } from './cloudway-course-validation.ts'
import { CLOUDWAY_GAP_TOLERANCE, exactKeys, fail, finite, positive, quarterTurns, record, string, vec3, } from './cloudway-course-validation.ts'
import { transformPlatformScrollAxis } from './transform.ts'

function validatePlatformProfile(
  profile: CloudwayPlatformProfile,
  path: string,
): void {
  for (const [name, value] of [
    ['width', profile.width],
    ['depth', profile.depth],
    ['thickness', profile.thickness],
  ] as const)
    if (!Number.isFinite(value) || value <= 0)
      fail(`${path}.${name}`, 'must be finite and positive.')
  if (!Number.isFinite(profile.top)) fail(`${path}.top`, 'must be finite.')
  if (profile.renderId.length === 0)
    fail(`${path}.renderId`, 'must be a non-empty string.')
  if (profile.behaviorKind === 'scroll') {
    if (profile.scrollLocalAxis === undefined)
      fail(`${path}.scrollLocalAxis`, 'is required for a scroll profile.')
    if (profile.scrollEdgeSupports === undefined)
      fail(`${path}.scrollEdgeSupports`, 'is required for a scroll profile.')
  } else if (
    profile.scrollLocalAxis !== undefined ||
    profile.scrollEdgeSupports !== undefined
  ) {
    fail(path, 'declares scroll contact data without scroll behavior.')
  }
}

function platformProfile(
  catalog: CloudwayCourseProfileCatalog,
  id: string,
  path: string,
): CloudwayPlatformProfile {
  const profile = catalog.platforms[id]
  if (profile === undefined)
    fail(path, `references unknown platform profile "${id}".`)
  validatePlatformProfile(profile, `profiles.platforms.${id}`)
  return profile
}

function platformBehavior(
  source: JsonRecord,
  profile: CloudwayPlatformProfile,
  turns: PlatformRenderQuarterTurns,
  path: string,
): PlatformDefinition['behavior'] {
  const raw = source.behavior
  if (profile.behaviorKind === undefined) {
    if (raw !== undefined)
      fail(`${path}.behavior`, 'is not allowed for this profile.')
    return undefined
  }
  const behavior = record(raw, `${path}.behavior`)
  const kind = string(behavior.kind, `${path}.behavior.kind`)
  if (kind !== profile.behaviorKind)
    fail(
      `${path}.behavior.kind`,
      `must match profile behavior "${profile.behaviorKind}".`,
    )
  if (kind === 'glide') {
    exactKeys(behavior, `${path}.behavior`, [
      'kind',
      'translation',
      'travelSeconds',
      'dwellSeconds',
    ])
    return {
      kind,
      translation: vec3(behavior.translation, `${path}.behavior.translation`),
      travelSeconds: positive(
        behavior.travelSeconds,
        `${path}.behavior.travelSeconds`,
      ),
      dwellSeconds: positive(
        behavior.dwellSeconds,
        `${path}.behavior.dwellSeconds`,
      ),
    }
  }
  if (kind === 'crackle') {
    exactKeys(behavior, `${path}.behavior`, [
      'kind',
      'warningSeconds',
      'releaseSeconds',
      'resetSeconds',
    ])
    return {
      kind,
      warningSeconds: positive(
        behavior.warningSeconds,
        `${path}.behavior.warningSeconds`,
      ),
      releaseSeconds: positive(
        behavior.releaseSeconds,
        `${path}.behavior.releaseSeconds`,
      ),
      resetSeconds: positive(
        behavior.resetSeconds,
        `${path}.behavior.resetSeconds`,
      ),
    }
  }
  if (kind !== 'scroll')
    return fail(`${path}.behavior.kind`, `uses unsupported behavior "${kind}".`)
  exactKeys(behavior, `${path}.behavior`, [
    'kind',
    'minLengthRatio',
    'extendedSeconds',
    'retractedSeconds',
    'transitionSeconds',
    'initialState',
  ])
  const initialState = string(
    behavior.initialState,
    `${path}.behavior.initialState`,
  )
  if (initialState !== 'extended' && initialState !== 'retracted')
    return fail(
      `${path}.behavior.initialState`,
      'must be extended or retracted.',
    )
  return {
    kind,
    axis: transformPlatformScrollAxis(profile.scrollLocalAxis!, turns),
    edgeSupports: profile.scrollEdgeSupports!,
    minLengthRatio: finite(
      behavior.minLengthRatio,
      `${path}.behavior.minLengthRatio`,
    ),
    extendedSeconds: positive(
      behavior.extendedSeconds,
      `${path}.behavior.extendedSeconds`,
    ),
    retractedSeconds: positive(
      behavior.retractedSeconds,
      `${path}.behavior.retractedSeconds`,
    ),
    transitionSeconds: positive(
      behavior.transitionSeconds,
      `${path}.behavior.transitionSeconds`,
    ),
    initialState,
  }
}

export interface CompiledPlatform {
  center: Vec3
  profile: CloudwayPlatformProfile
  definition: PlatformDefinition
}

export function compilePlatform(
  raw: unknown,
  catalog: CloudwayCourseProfileCatalog,
  path: string,
): CompiledPlatform {
  const source = record(raw, path)
  exactKeys(
    source,
    path,
    ['id', 'profileId', 'center', 'quarterTurns'],
    ['behavior'],
  )
  const id = string(source.id, `${path}.id`)
  const profileId = string(source.profileId, `${path}.profileId`)
  const center = vec3(source.center, `${path}.center`)
  const turns = quarterTurns(source.quarterTurns, `${path}.quarterTurns`)
  const profile = platformProfile(catalog, profileId, `${path}.profileId`)
  const width = turns % 2 === 0 ? profile.width : profile.depth
  const depth = turns % 2 === 0 ? profile.depth : profile.width
  const definition: PlatformDefinition = {
    id,
    minX: center.x - width / 2,
    maxX: center.x + width / 2,
    minZ: center.z - depth / 2,
    maxZ: center.z + depth / 2,
    top: center.y + profile.top,
    thickness: profile.thickness,
    kind: 'deck',
    material: 'stone',
    renderId: profile.renderId,
    renderQuarterTurns: turns,
    surface: profile.surface,
    behavior: platformBehavior(source, profile, turns, path),
  }
  const error = platformRuntimeDefinitionError(definition)
  if (error !== undefined) fail(path, error)
  return {
    center,
    profile,
    definition,
  }
}

interface GapContact {
  bounds: BoundsXZ
  top: number
}

function platformContactAtState(
  platform: CompiledPlatform,
  state: CloudwayCourseGapState,
  axis: 'x' | 'z',
  direction: -1 | 1,
  path: string,
): GapContact {
  const bounds: BoundsXZ = {
    minX: platform.definition.minX,
    maxX: platform.definition.maxX,
    minZ: platform.definition.minZ,
    maxZ: platform.definition.maxZ,
  }
  const behavior = platform.definition.behavior
  if (state === 'base') return { bounds, top: platform.definition.top }
  if (state === 'glide-end') {
    if (behavior?.kind !== 'glide')
      return fail(path, 'requires a glide platform.')
    return {
      bounds: {
        minX: bounds.minX + behavior.translation.x,
        maxX: bounds.maxX + behavior.translation.x,
        minZ: bounds.minZ + behavior.translation.z,
        maxZ: bounds.maxZ + behavior.translation.z,
      },
      top: platform.definition.top + behavior.translation.y,
    }
  }
  if (behavior?.kind !== 'scroll')
    return fail(path, 'requires a scroll platform.')
  if (behavior.axis !== axis)
    return fail(path, `requires a scroll extending on the gap ${axis} axis.`)
  const edge =
    direction < 0
      ? behavior.edgeSupports?.negative
      : behavior.edgeSupports?.positive
  if (edge === undefined) return fail(path, 'requires certified edge supports.')
  const centreX = (bounds.minX + bounds.maxX) / 2
  const centreZ = (bounds.minZ + bounds.maxZ) / 2
  if (axis === 'x') {
    bounds.minZ = centreZ + edge.minCrossAxis
    bounds.maxZ = centreZ + edge.maxCrossAxis
    if (direction < 0) bounds.minX -= edge.outwardLength
    else bounds.maxX += edge.outwardLength
  } else {
    bounds.minX = centreX + edge.minCrossAxis
    bounds.maxX = centreX + edge.maxCrossAxis
    if (direction < 0) bounds.minZ -= edge.outwardLength
    else bounds.maxZ += edge.outwardLength
  }
  return { bounds, top: platform.definition.top + edge.topOffset }
}

function gapAxisInterval(
  bounds: BoundsXZ,
  axis: 'x' | 'z',
): readonly [number, number] {
  return axis === 'x' ? [bounds.minX, bounds.maxX] : [bounds.minZ, bounds.maxZ]
}

function gapCrossInterval(
  bounds: BoundsXZ,
  axis: 'x' | 'z',
): readonly [number, number] {
  return axis === 'x' ? [bounds.minZ, bounds.maxZ] : [bounds.minX, bounds.maxX]
}

export function compileGap(
  raw: unknown,
  platforms: ReadonlyMap<string, CompiledPlatform>,
  path: string,
): IntentionalGapDefinition {
  const source = record(raw, path)
  exactKeys(source, path, [
    'id',
    'fromPlatformId',
    'toPlatformId',
    'axis',
    'fromState',
    'toState',
    'distance',
  ])
  const parsed: CloudwayCourseGapSource = {
    id: string(source.id, `${path}.id`),
    fromPlatformId: string(source.fromPlatformId, `${path}.fromPlatformId`),
    toPlatformId: string(source.toPlatformId, `${path}.toPlatformId`),
    axis:
      source.axis === 'x' || source.axis === 'z'
        ? source.axis
        : fail(`${path}.axis`, 'must be x or z.'),
    fromState:
      source.fromState === 'base' ||
      source.fromState === 'scroll-extended' ||
      source.fromState === 'glide-end'
        ? source.fromState
        : fail(`${path}.fromState`, 'uses an unsupported state.'),
    toState:
      source.toState === 'base' ||
      source.toState === 'scroll-extended' ||
      source.toState === 'glide-end'
        ? source.toState
        : fail(`${path}.toState`, 'uses an unsupported state.'),
    distance: positive(source.distance, `${path}.distance`),
  }
  const from = platforms.get(parsed.fromPlatformId)
  const to = platforms.get(parsed.toPlatformId)
  if (from === undefined)
    fail(
      `${path}.fromPlatformId`,
      `references unknown platform "${parsed.fromPlatformId}".`,
    )
  if (to === undefined)
    fail(
      `${path}.toPlatformId`,
      `references unknown platform "${parsed.toPlatformId}".`,
    )
  const fromAxisCentre = parsed.axis === 'x' ? from.center.x : from.center.z
  const toAxisCentre = parsed.axis === 'x' ? to.center.x : to.center.z
  if (Math.abs(toAxisCentre - fromAxisCentre) <= CLOUDWAY_GAP_TOLERANCE)
    fail(path, 'platform centres must be separated on the declared gap axis.')
  const direction = toAxisCentre > fromAxisCentre ? 1 : -1
  const fromContact = platformContactAtState(
    from,
    parsed.fromState,
    parsed.axis,
    direction,
    `${path}.fromState`,
  )
  const toContact = platformContactAtState(
    to,
    parsed.toState,
    parsed.axis,
    direction === 1 ? -1 : 1,
    `${path}.toState`,
  )
  if (Math.abs(fromContact.top - toContact.top) > 0.08 + CLOUDWAY_GAP_TOLERANCE)
    fail(path, 'must connect landing contacts within the walkable step height.')
  const fromBounds = fromContact.bounds
  const toBounds = toContact.bounds
  const [fromMin, fromMax] = gapAxisInterval(fromBounds, parsed.axis)
  const [toMin, toMax] = gapAxisInterval(toBounds, parsed.axis)
  let minimum: number
  let maximum: number
  if (fromMax <= toMin) {
    minimum = fromMax
    maximum = toMin
  } else if (toMax <= fromMin) {
    minimum = toMax
    maximum = fromMin
  } else {
    return fail(path, 'platforms overlap instead of forming a gap.')
  }
  const measured = maximum - minimum
  if (Math.abs(measured - parsed.distance) > CLOUDWAY_GAP_TOLERANCE)
    fail(
      `${path}.distance`,
      `declares ${parsed.distance}m but profile geometry measures ${measured}m.`,
    )
  const [fromCrossMin, fromCrossMax] = gapCrossInterval(fromBounds, parsed.axis)
  const [toCrossMin, toCrossMax] = gapCrossInterval(toBounds, parsed.axis)
  const crossMin = Math.max(fromCrossMin, toCrossMin)
  const crossMax = Math.min(fromCrossMax, toCrossMax)
  if (crossMin >= crossMax) fail(path, 'platforms have no cross-axis overlap.')
  const gap: IntentionalGapDefinition =
    parsed.axis === 'x'
      ? {
          id: parsed.id,
          minX: minimum,
          maxX: maximum,
          minZ: crossMin,
          maxZ: crossMax,
          top: Math.min(fromContact.top, toContact.top),
        }
      : {
          id: parsed.id,
          minX: crossMin,
          maxX: crossMax,
          minZ: minimum,
          maxZ: maximum,
          top: Math.min(fromContact.top, toContact.top),
        }
  const error = intentionalGapDefinitionError(gap)
  if (error !== undefined) fail(path, error)
  return gap
}
