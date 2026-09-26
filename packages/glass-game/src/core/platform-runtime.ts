// ============================================================
// Platform runtime — deterministic transforms and breakaway lifecycles for authored floors.
// ============================================================

import type { Bounds3, CourseSolid, PlatformBehaviorDefinition, PlatformDefinition, PlatformPhase, PlatformRuntimeSnapshot, PlatformSurfaceDefinition, Vec3, } from '../contracts'
import { LEVEL_MOVEMENT_LIMITS, PLATFORM_BEHAVIOR_LIMITS } from '../contracts'
import type { MovingPlatformCollision } from './collision'

const ZERO: Readonly<Vec3> = { x: 0, y: 0, z: 0 }
const NO_MOTIONS: readonly MovingPlatformCollision[] = []
const EPSILON = 1e-10
const SCROLL_NEGATIVE_SUFFIX = '::scroll-negative'
const SCROLL_POSITIVE_SUFFIX = '::scroll-positive'

type ScrollBehavior = Extract<PlatformBehaviorDefinition, { kind: 'scroll' }>
type ScrollPhase = Extract<
  PlatformPhase,
  'extended' | 'retracting' | 'retracted' | 'extending'
>

interface ScrollState {
  phase: ScrollPhase
  phaseElapsed: number
  lengthRatio: number
}

interface RuntimePlatformState {
  definition: PlatformDefinition
  offset: Vec3
  previousOffset: Vec3
  elapsed: number
  phase: PlatformPhase
  phaseElapsed: number
  lengthRatio: number
  previousLengthRatio: number
}

type ScrollComponent = {
  readonly parentId: string
  readonly side: 'negative' | 'positive'
}

function scrollComponentId(
  parentId: string,
  side: ScrollComponent['side'],
): string {
  return `${parentId}${
    side === 'negative' ? SCROLL_NEGATIVE_SUFFIX : SCROLL_POSITIVE_SUFFIX
  }`
}

function usesReservedScrollComponentSuffix(id: string): boolean {
  return (
    id.endsWith(SCROLL_NEGATIVE_SUFFIX) || id.endsWith(SCROLL_POSITIVE_SUFFIX)
  )
}

export interface PlatformRuntime {
  advance(dt: number, activePlatformIds: ReadonlySet<string>): void
  armCrackle(id: string): void
  materialize(solids: readonly CourseSolid[]): readonly CourseSolid[]
  motions(
    activePlatformIds: ReadonlySet<string>,
  ): readonly MovingPlatformCollision[]
  supportDelta(id: string | null): Vec3
  surface(id: string | null): PlatformSurfaceDefinition | undefined
  snapshots(): PlatformRuntimeSnapshot[]
  reset(): void
}

function finitePositive(value: number, maximum: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= maximum
}

function finiteInRange(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isFinite(value) && value >= minimum && value <= maximum
}

/** Returns an author-facing error instead of allowing malformed data into a clock. */
export function platformRuntimeDefinitionError(
  platform: PlatformDefinition,
): string | undefined {
  if (usesReservedScrollComponentSuffix(platform.id))
    return 'platform id uses a reserved runtime scroll component suffix'
  const surface = platform.surface
  if (
    surface !== undefined &&
    (!finitePositive(surface.controlMultiplier, 1) ||
      surface.controlMultiplier <
        PLATFORM_BEHAVIOR_LIMITS.minimumSurfaceMultiplier ||
      !finitePositive(surface.brakingMultiplier, 1) ||
      surface.brakingMultiplier <
        PLATFORM_BEHAVIOR_LIMITS.minimumSurfaceMultiplier ||
      !finitePositive(surface.maximumSpeed, LEVEL_MOVEMENT_LIMITS.maximumSpeed))
  )
    return 'frost control, braking and maximum speed must be finite, positive and within runtime limits'

  const behavior = platform.behavior
  if (behavior === undefined) return undefined
  if (behavior.kind === 'glide') {
    const translation = behavior.translation
    const values = [translation.x, translation.y, translation.z]
    const distance = Math.hypot(...values)
    if (
      !values.every(Number.isFinite) ||
      distance <= 0 ||
      values.some(
        (value) =>
          Math.abs(value) > PLATFORM_BEHAVIOR_LIMITS.maximumTranslation,
      )
    )
      return 'glide translation must be finite, non-zero and within the authored travel bound'
    if (
      !finitePositive(
        behavior.travelSeconds,
        PLATFORM_BEHAVIOR_LIMITS.maximumTravelSeconds,
      ) ||
      !finitePositive(
        behavior.dwellSeconds,
        PLATFORM_BEHAVIOR_LIMITS.maximumDwellSeconds,
      )
    )
      return 'glide travel and dwell durations must be finite, positive and within runtime limits'
    if (
      (Math.PI * distance) / (2 * behavior.travelSeconds) >
      LEVEL_MOVEMENT_LIMITS.maximumSpeed
    )
      return 'glide translation speed exceeds the bounded movement budget'
    return undefined
  }
  if (behavior.kind === 'scroll') {
    if (
      (behavior.axis !== 'x' && behavior.axis !== 'z') ||
      (behavior.initialState !== 'extended' &&
        behavior.initialState !== 'retracted') ||
      !finiteInRange(
        behavior.minLengthRatio,
        PLATFORM_BEHAVIOR_LIMITS.minimumScrollLengthRatio,
        PLATFORM_BEHAVIOR_LIMITS.maximumScrollLengthRatio,
      )
    )
      return 'scroll axis, initial state and minimum length ratio must be valid and within runtime limits'
    if (
      !finiteInRange(
        behavior.extendedSeconds,
        PLATFORM_BEHAVIOR_LIMITS.minimumScrollRestSeconds,
        PLATFORM_BEHAVIOR_LIMITS.maximumScrollRestSeconds,
      ) ||
      !finiteInRange(
        behavior.retractedSeconds,
        PLATFORM_BEHAVIOR_LIMITS.minimumScrollRestSeconds,
        PLATFORM_BEHAVIOR_LIMITS.maximumScrollRestSeconds,
      ) ||
      !finiteInRange(
        behavior.transitionSeconds,
        PLATFORM_BEHAVIOR_LIMITS.minimumScrollTransitionSeconds,
        PLATFORM_BEHAVIOR_LIMITS.maximumScrollTransitionSeconds,
      )
    )
      return 'scroll rest and transition durations must be finite and within runtime limits'
    const edges: unknown = behavior.edgeSupports
    if (edges !== undefined) {
      if (edges === null || typeof edges !== 'object' || Array.isArray(edges))
        return 'scroll edge supports must declare negative and positive contact bounds'
      const edgeRecord = edges as Record<string, unknown>
      for (const edgeValue of [edgeRecord.negative, edgeRecord.positive]) {
        if (
          edgeValue === null ||
          typeof edgeValue !== 'object' ||
          Array.isArray(edgeValue)
        )
          return 'scroll edge supports must declare negative and positive contact bounds'
        const edge = edgeValue as Record<string, unknown>
        if (
          !finitePositive(
            edge.outwardLength as number,
            PLATFORM_BEHAVIOR_LIMITS.maximumTranslation,
          ) ||
          !Number.isFinite(edge.minCrossAxis as number) ||
          !Number.isFinite(edge.maxCrossAxis as number) ||
          (edge.minCrossAxis as number) >= (edge.maxCrossAxis as number) ||
          Math.abs(edge.minCrossAxis as number) >
            PLATFORM_BEHAVIOR_LIMITS.maximumTranslation ||
          Math.abs(edge.maxCrossAxis as number) >
            PLATFORM_BEHAVIOR_LIMITS.maximumTranslation ||
          !Number.isFinite(edge.topOffset as number) ||
          Math.abs(edge.topOffset as number) >
            PLATFORM_BEHAVIOR_LIMITS.maximumTranslation ||
          !finitePositive(
            edge.thickness as number,
            PLATFORM_BEHAVIOR_LIMITS.maximumTranslation,
          )
        )
          return 'scroll edge supports must use finite ordered visible contact bounds'
      }
    }
    return undefined
  }
  if (
    !finitePositive(
      behavior.warningSeconds,
      PLATFORM_BEHAVIOR_LIMITS.maximumPhaseSeconds,
    ) ||
    !finitePositive(
      behavior.releaseSeconds,
      PLATFORM_BEHAVIOR_LIMITS.maximumPhaseSeconds,
    ) ||
    !finitePositive(
      behavior.resetSeconds,
      PLATFORM_BEHAVIOR_LIMITS.maximumPhaseSeconds,
    )
  )
    return 'crackle warning, release and reset durations must be finite, positive and within runtime limits'
  return undefined
}

function glideProgress(
  behavior: Extract<PlatformBehaviorDefinition, { kind: 'glide' }>,
  elapsed: number,
): number {
  const dwell = behavior.dwellSeconds
  const travel = behavior.travelSeconds
  const cycle = 2 * (dwell + travel)
  const time = ((elapsed % cycle) + cycle) % cycle
  if (time < dwell) return 0
  if (time < dwell + travel) {
    const t = (time - dwell) / travel
    return (1 - Math.cos(Math.PI * t)) / 2
  }
  if (time < 2 * dwell + travel) return 1
  const t = (time - (2 * dwell + travel)) / travel
  return (1 + Math.cos(Math.PI * t)) / 2
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function easedProgress(progress: number): number {
  return (1 - Math.cos(Math.PI * clampUnit(progress))) / 2
}

function scrollCycleSeconds(behavior: ScrollBehavior): number {
  return (
    behavior.extendedSeconds +
    behavior.retractedSeconds +
    2 * behavior.transitionSeconds
  )
}

function scrollStateAt(behavior: ScrollBehavior, elapsed: number): ScrollState {
  const cycle = scrollCycleSeconds(behavior)
  const initialOffset =
    behavior.initialState === 'extended'
      ? 0
      : behavior.extendedSeconds + behavior.transitionSeconds
  let cycleElapsed = (((elapsed + initialOffset) % cycle) + cycle) % cycle
  if (cycleElapsed <= EPSILON || cycle - cycleElapsed <= EPSILON)
    cycleElapsed = 0

  let phase: ScrollPhase
  let phaseElapsed: number
  let phaseDuration: number
  if (cycleElapsed + EPSILON < behavior.extendedSeconds) {
    phase = 'extended'
    phaseElapsed = cycleElapsed
    phaseDuration = behavior.extendedSeconds
  } else {
    cycleElapsed = Math.max(0, cycleElapsed - behavior.extendedSeconds)
    if (cycleElapsed + EPSILON < behavior.transitionSeconds) {
      phase = 'retracting'
      phaseElapsed = cycleElapsed
      phaseDuration = behavior.transitionSeconds
    } else {
      cycleElapsed = Math.max(0, cycleElapsed - behavior.transitionSeconds)
      if (cycleElapsed + EPSILON < behavior.retractedSeconds) {
        phase = 'retracted'
        phaseElapsed = cycleElapsed
        phaseDuration = behavior.retractedSeconds
      } else {
        phase = 'extending'
        phaseElapsed = Math.max(0, cycleElapsed - behavior.retractedSeconds)
        phaseDuration = behavior.transitionSeconds
      }
    }
  }
  const phaseProgress = clampUnit(phaseElapsed / phaseDuration)
  const retraction =
    phase === 'extended'
      ? 0
      : phase === 'retracted'
        ? 1
        : phase === 'retracting'
          ? easedProgress(phaseProgress)
          : 1 - easedProgress(phaseProgress)
  return {
    phase,
    phaseElapsed,
    lengthRatio: 1 - (1 - behavior.minLengthRatio) * retraction,
  }
}

function offsetFor(state: RuntimePlatformState): Vec3 {
  const behavior = state.definition.behavior
  if (behavior?.kind !== 'glide') return { ...ZERO }
  const progress = glideProgress(behavior, state.elapsed)
  return {
    x: behavior.translation.x * progress,
    y: behavior.translation.y * progress,
    z: behavior.translation.z * progress,
  }
}

function collisionEnabled(state: RuntimePlatformState): boolean {
  return state.phase !== 'released' && state.phase !== 'resetting'
}

function phaseDuration(state: RuntimePlatformState): number | null {
  const behavior = state.definition.behavior
  if (behavior?.kind === 'crackle') {
    if (state.phase === 'warning') return behavior.warningSeconds
    if (state.phase === 'released') return behavior.releaseSeconds
    if (state.phase === 'resetting') return behavior.resetSeconds
  }
  if (behavior?.kind === 'scroll') {
    if (state.phase === 'extended') return behavior.extendedSeconds
    if (state.phase === 'retracted') return behavior.retractedSeconds
    if (state.phase === 'retracting' || state.phase === 'extending')
      return behavior.transitionSeconds
  }
  return null
}

function nextCracklePhase(phase: PlatformPhase): PlatformPhase {
  if (phase === 'warning') return 'released'
  if (phase === 'released') return 'resetting'
  return 'intact'
}

function advanceCrackle(state: RuntimePlatformState, dt: number): void {
  let remaining = dt
  while (remaining > EPSILON) {
    const duration = phaseDuration(state)
    if (duration === null) return
    const untilTransition = duration - state.phaseElapsed
    if (remaining + EPSILON < untilTransition) {
      state.phaseElapsed += remaining
      return
    }
    remaining = Math.max(0, remaining - untilTransition)
    state.phase = nextCracklePhase(state.phase)
    state.phaseElapsed = 0
    if (state.phase === 'intact') return
  }
}

function translatedPlatform(
  platform: PlatformDefinition,
  offset: Vec3,
): PlatformDefinition {
  if (offset.x === 0 && offset.y === 0 && offset.z === 0) return platform
  return {
    ...platform,
    minX: platform.minX + offset.x,
    maxX: platform.maxX + offset.x,
    minZ: platform.minZ + offset.z,
    maxZ: platform.maxZ + offset.z,
    top: platform.top + offset.y,
  }
}

function resizedScrollPlatform(
  platform: PlatformDefinition,
  behavior: ScrollBehavior,
  lengthRatio: number,
): PlatformDefinition {
  if (lengthRatio === 1) return platform
  if (behavior.axis === 'x') {
    const center = (platform.minX + platform.maxX) / 2
    const halfLength = ((platform.maxX - platform.minX) * lengthRatio) / 2
    return {
      ...platform,
      minX: center - halfLength,
      maxX: center + halfLength,
    }
  }
  const center = (platform.minZ + platform.maxZ) / 2
  const halfLength = ((platform.maxZ - platform.minZ) * lengthRatio) / 2
  return {
    ...platform,
    minZ: center - halfLength,
    maxZ: center + halfLength,
  }
}

function scrollEdgeParts(
  platform: PlatformDefinition,
  behavior: ScrollBehavior,
  lengthRatio: number,
): readonly PlatformDefinition[] {
  const deck = resizedScrollPlatform(platform, behavior, lengthRatio)
  const edges = behavior.edgeSupports
  if (edges === undefined) return [deck]
  const parts: PlatformDefinition[] = [deck]
  const centreX = (platform.minX + platform.maxX) / 2
  const centreZ = (platform.minZ + platform.maxZ) / 2

  for (const [side, edge] of [
    ['negative', edges.negative],
    ['positive', edges.positive],
  ] as const) {
    const support: PlatformDefinition = {
      ...platform,
      id: scrollComponentId(platform.id, side),
      parentPlatformId: platform.id,
      behavior: undefined,
      renderId: undefined,
      renderQuarterTurns: undefined,
      surface: undefined,
      top: platform.top + edge.topOffset,
      thickness: edge.thickness,
    }
    if (behavior.axis === 'x') {
      support.minZ = centreZ + edge.minCrossAxis
      support.maxZ = centreZ + edge.maxCrossAxis
      if (side === 'negative') {
        support.maxX = deck.minX
        support.minX = support.maxX - edge.outwardLength
      } else {
        support.minX = deck.maxX
        support.maxX = support.minX + edge.outwardLength
      }
    } else {
      support.minX = centreX + edge.minCrossAxis
      support.maxX = centreX + edge.maxCrossAxis
      if (side === 'negative') {
        support.maxZ = deck.minZ
        support.minZ = support.maxZ - edge.outwardLength
      } else {
        support.minZ = deck.maxZ
        support.maxZ = support.minZ + edge.outwardLength
      }
    }
    parts.push(support)
  }
  return parts
}

function materializedPlatforms(
  platform: PlatformDefinition,
  state: RuntimePlatformState,
): readonly PlatformDefinition[] {
  const behavior = state.definition.behavior
  if (behavior?.kind === 'scroll')
    return scrollEdgeParts(platform, behavior, state.lengthRatio)
  return [translatedPlatform(platform, state.offset)]
}

/**
 * Returns the same live physical envelope used by platform collision.
 * Renderer and camera proxies can consume this without reproducing behavior
 * transforms or importing donor geometry.
 */
export function platformBoundsAtRuntime(
  platform: PlatformDefinition,
  runtime: Pick<PlatformRuntimeSnapshot, 'offset' | 'lengthRatio'> | undefined,
): Bounds3 {
  const behavior = platform.behavior
  const parts =
    behavior?.kind === 'scroll'
      ? scrollEdgeParts(platform, behavior, runtime?.lengthRatio ?? 1)
      : [translatedPlatform(platform, runtime?.offset ?? ZERO)]
  return parts.reduce<Bounds3>(
    (bounds, part) => ({
      minX: Math.min(bounds.minX, part.minX),
      maxX: Math.max(bounds.maxX, part.maxX),
      minY: Math.min(bounds.minY, part.top - part.thickness),
      maxY: Math.max(bounds.maxY, part.top),
      minZ: Math.min(bounds.minZ, part.minZ),
      maxZ: Math.max(bounds.maxZ, part.maxZ),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY,
    },
  )
}

function initialPhase(platform: PlatformDefinition): PlatformPhase {
  if (platform.behavior?.kind === 'glide') return 'moving'
  if (platform.behavior?.kind === 'crackle') return 'intact'
  if (platform.behavior?.kind === 'scroll')
    return platform.behavior.initialState
  return 'stable'
}

function initialLengthRatio(platform: PlatformDefinition): number {
  const behavior = platform.behavior
  return behavior?.kind === 'scroll'
    ? scrollStateAt(behavior, 0).lengthRatio
    : 1
}

export function createPlatformRuntime(
  platforms: readonly PlatformDefinition[],
): PlatformRuntime {
  const states = new Map<string, RuntimePlatformState>()
  const scrollComponents = new Map<string, ScrollComponent>()
  for (const definition of platforms) {
    const error = platformRuntimeDefinitionError(definition)
    if (error !== undefined)
      throw new Error(`Invalid platform "${definition.id}": ${error}.`)
    states.set(definition.id, {
      definition,
      offset: { ...ZERO },
      previousOffset: { ...ZERO },
      elapsed: 0,
      phase: initialPhase(definition),
      phaseElapsed: 0,
      lengthRatio: initialLengthRatio(definition),
      previousLengthRatio: initialLengthRatio(definition),
    })
    if (
      definition.behavior?.kind === 'scroll' &&
      definition.behavior.edgeSupports !== undefined
    ) {
      for (const side of ['negative', 'positive'] as const) {
        const id = scrollComponentId(definition.id, side)
        if (states.has(id) || scrollComponents.has(id))
          throw new Error(
            `Invalid platform "${definition.id}": runtime scroll component id "${id}" collides with an authored platform id.`,
          )
        scrollComponents.set(id, { parentId: definition.id, side })
      }
    }
  }
  const clockedStates = [...states.values()].filter(
    (state) => state.definition.behavior !== undefined,
  )

  const resetState = (state: RuntimePlatformState): void => {
    state.elapsed = 0
    state.phase = initialPhase(state.definition)
    state.phaseElapsed = 0
    state.lengthRatio = initialLengthRatio(state.definition)
    state.previousLengthRatio = state.lengthRatio
    state.offset = { ...ZERO }
    state.previousOffset = { ...ZERO }
  }

  return {
    advance(dt, activePlatformIds) {
      if (!Number.isFinite(dt) || dt <= 0) return
      for (const state of clockedStates) {
        state.previousOffset = { ...state.offset }
        state.previousLengthRatio = state.lengthRatio
        if (!activePlatformIds.has(state.definition.id)) continue
        const behavior = state.definition.behavior
        if (behavior?.kind === 'glide') {
          state.elapsed += dt
          state.offset = offsetFor(state)
        } else if (behavior?.kind === 'scroll') {
          state.elapsed = (state.elapsed + dt) % scrollCycleSeconds(behavior)
          const scroll = scrollStateAt(behavior, state.elapsed)
          state.phase = scroll.phase
          state.phaseElapsed = scroll.phaseElapsed
          state.lengthRatio = scroll.lengthRatio
        } else if (behavior?.kind === 'crackle') {
          advanceCrackle(state, dt)
        }
      }
    },
    armCrackle(id) {
      const state = states.get(id)
      if (
        state?.definition.behavior?.kind !== 'crackle' ||
        state.phase !== 'intact'
      )
        return
      state.phase = 'warning'
      state.phaseElapsed = 0
    },
    materialize(solids) {
      if (clockedStates.length === 0) return solids
      const result: CourseSolid[] = []
      for (const solid of solids) {
        if (scrollComponents.has(solid.id))
          throw new Error(
            `Invalid solid "${solid.id}": id is reserved by a runtime scroll component.`,
          )
        // platformId on props controls progression visibility; it has never
        // meant transform parenting. The first pilot keeps all props/perches static.
        const state = solid.kind === 'prop' ? undefined : states.get(solid.id)
        if (state !== undefined && !collisionEnabled(state)) continue
        if (state === undefined) result.push(solid)
        else if (solid.kind !== 'prop')
          result.push(...materializedPlatforms(solid, state))
      }
      return result
    },
    motions(activePlatformIds) {
      if (clockedStates.length === 0) return NO_MOTIONS
      const motions: MovingPlatformCollision[] = []
      for (const state of clockedStates) {
        const behavior = state.definition.behavior
        if (
          !activePlatformIds.has(state.definition.id) ||
          !collisionEnabled(state)
        )
          continue
        if (
          behavior?.kind === 'scroll' &&
          behavior.edgeSupports !== undefined
        ) {
          const previous = scrollEdgeParts(
            state.definition,
            behavior,
            state.previousLengthRatio,
          )
          const current = scrollEdgeParts(
            state.definition,
            behavior,
            state.lengthRatio,
          )
          for (let index = 1; index < current.length; index++) {
            const before = previous[index]!
            const after = current[index]!
            motions.push({
              id: after.id,
              previous: before,
              current: after,
              displacement: {
                x: after.minX - before.minX,
                y: after.top - before.top,
                z: after.minZ - before.minZ,
              },
            })
          }
          continue
        }
        if (behavior?.kind !== 'glide') continue
        const displacement = {
          x: state.offset.x - state.previousOffset.x,
          y: state.offset.y - state.previousOffset.y,
          z: state.offset.z - state.previousOffset.z,
        }
        if (
          displacement.x === 0 &&
          displacement.y === 0 &&
          displacement.z === 0
        )
          continue
        motions.push({
          id: state.definition.id,
          previous: translatedPlatform(state.definition, state.previousOffset),
          current: translatedPlatform(state.definition, state.offset),
          displacement,
        })
      }
      return motions
    },
    supportDelta(id) {
      const component = id === null ? undefined : scrollComponents.get(id)
      const state =
        id === null ? undefined : states.get(component?.parentId ?? id)
      if (state === undefined || !collisionEnabled(state)) return { ...ZERO }
      if (
        component !== undefined &&
        state.definition.behavior?.kind === 'scroll'
      ) {
        const behavior = state.definition.behavior
        const fullLength =
          behavior.axis === 'x'
            ? state.definition.maxX - state.definition.minX
            : state.definition.maxZ - state.definition.minZ
        const direction = component.side === 'negative' ? -1 : 1
        const delta =
          (direction *
            fullLength *
            (state.lengthRatio - state.previousLengthRatio)) /
          2
        return behavior.axis === 'x'
          ? { x: delta, y: 0, z: 0 }
          : { x: 0, y: 0, z: delta }
      }
      return {
        x: state.offset.x - state.previousOffset.x,
        y: state.offset.y - state.previousOffset.y,
        z: state.offset.z - state.previousOffset.z,
      }
    },
    surface(id) {
      const state = id === null ? undefined : states.get(id)
      return state !== undefined && collisionEnabled(state)
        ? state.definition.surface
        : undefined
    },
    snapshots() {
      return [...states.values()].map((state) => {
        const behavior = state.definition.behavior
        const duration = phaseDuration(state)
        return {
          id: state.definition.id,
          offset: { ...state.offset },
          phase: state.phase,
          phaseProgress:
            behavior?.kind === 'glide'
              ? glideProgress(behavior, state.elapsed)
              : duration === null
                ? 0
                : clampUnit(state.phaseElapsed / duration),
          collisionEnabled: collisionEnabled(state),
          ...(behavior?.kind === 'scroll'
            ? { lengthRatio: state.lengthRatio }
            : {}),
        }
      })
    },
    reset() {
      for (const state of clockedStates) resetState(state)
    },
  }
}
