// ============================================================
// Platform runtime — deterministic transforms and breakaway lifecycles for authored floors.
// ============================================================

import type { CourseSolid, PlatformBehaviorDefinition, PlatformDefinition, PlatformPhase, PlatformRuntimeSnapshot, PlatformSurfaceDefinition, Vec3, } from '../contracts'
import { LEVEL_MOVEMENT_LIMITS, PLATFORM_BEHAVIOR_LIMITS } from '../contracts'
import type { MovingPlatformCollision } from './collision'

const ZERO: Readonly<Vec3> = { x: 0, y: 0, z: 0 }
const NO_MOTIONS: readonly MovingPlatformCollision[] = []
const EPSILON = 1e-10

interface RuntimePlatformState {
  definition: PlatformDefinition
  offset: Vec3
  previousOffset: Vec3
  elapsed: number
  phase: PlatformPhase
  phaseElapsed: number
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

/** Returns an author-facing error instead of allowing malformed data into a clock. */
export function platformRuntimeDefinitionError(
  platform: PlatformDefinition,
): string | undefined {
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
  if (behavior?.kind !== 'crackle') return null
  if (state.phase === 'warning') return behavior.warningSeconds
  if (state.phase === 'released') return behavior.releaseSeconds
  if (state.phase === 'resetting') return behavior.resetSeconds
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

function initialPhase(platform: PlatformDefinition): PlatformPhase {
  if (platform.behavior?.kind === 'glide') return 'moving'
  if (platform.behavior?.kind === 'crackle') return 'intact'
  return 'stable'
}

export function createPlatformRuntime(
  platforms: readonly PlatformDefinition[],
): PlatformRuntime {
  const states = new Map<string, RuntimePlatformState>()
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
    })
  }
  const clockedStates = [...states.values()].filter(
    (state) => state.definition.behavior !== undefined,
  )

  const resetState = (state: RuntimePlatformState): void => {
    state.elapsed = 0
    state.phase = initialPhase(state.definition)
    state.phaseElapsed = 0
    state.offset = { ...ZERO }
    state.previousOffset = { ...ZERO }
  }

  return {
    advance(dt, activePlatformIds) {
      if (!Number.isFinite(dt) || dt <= 0) return
      for (const state of clockedStates) {
        state.previousOffset = { ...state.offset }
        if (!activePlatformIds.has(state.definition.id)) continue
        if (state.definition.behavior?.kind === 'glide') {
          state.elapsed += dt
          state.offset = offsetFor(state)
        } else if (state.definition.behavior?.kind === 'crackle') {
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
        // platformId on props controls progression visibility; it has never
        // meant transform parenting. The first pilot keeps all props/perches static.
        const state = solid.kind === 'prop' ? undefined : states.get(solid.id)
        if (state !== undefined && !collisionEnabled(state)) continue
        if (state === undefined) result.push(solid)
        else if (solid.kind !== 'prop')
          result.push(translatedPlatform(solid, state.offset))
      }
      return result
    },
    motions(activePlatformIds) {
      if (clockedStates.length === 0) return NO_MOTIONS
      const motions: MovingPlatformCollision[] = []
      for (const state of clockedStates) {
        if (
          state.definition.behavior?.kind !== 'glide' ||
          !activePlatformIds.has(state.definition.id) ||
          !collisionEnabled(state)
        )
          continue
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
      const state = id === null ? undefined : states.get(id)
      if (state === undefined || !collisionEnabled(state)) return { ...ZERO }
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
                : Math.max(0, Math.min(1, state.phaseElapsed / duration)),
          collisionEnabled: collisionEnabled(state),
        }
      })
    },
    reset() {
      for (const state of clockedStates) resetState(state)
    },
  }
}
