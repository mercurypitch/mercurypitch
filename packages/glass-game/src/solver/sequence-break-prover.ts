// Sequence-break search — physical gap and gate probes, never a security certificate.
import type { BoundsXZ, LevelDefinition, Vec3 } from '../contracts.ts'
import { MOVEMENT } from '../core/movement.ts'
import { getActiveCourseSolids } from '../core/solid-activation.ts'
import type { SequenceBreakProof } from './contracts.ts'
import type { SequenceBreakOptions } from './security-probe.ts'
import { inconclusiveSecurity, probeBoundary, project, securityOptionsError, } from './security-probe.ts'
import { distXZ, replayTrajectory } from './trajectory-stepper.ts'

export type { SequenceBreakOptions } from './security-probe.ts'

function normalToward(
  from: Vec3,
  to: Vec3,
  explicit: SequenceBreakOptions['direction'],
  cardinal = false,
): { x: number; z: number } | undefined {
  let x = explicit?.x ?? to.x - from.x
  let z = explicit?.z ?? to.z - from.z
  if (cardinal && explicit === undefined) {
    if (Math.abs(x) > Math.abs(z)) z = 0
    else x = 0
  }
  const length = Math.hypot(x, z)
  return length > 0 && Number.isFinite(length)
    ? { x: x / length, z: z / length }
    : undefined
}

function projectedBounds(
  bounds: BoundsXZ,
  normal: { x: number; z: number },
): number[] {
  return [
    project({ x: bounds.minX, z: bounds.minZ }, normal),
    project({ x: bounds.minX, z: bounds.maxZ }, normal),
    project({ x: bounds.maxX, z: bounds.minZ }, normal),
    project({ x: bounds.maxX, z: bounds.maxZ }, normal),
  ]
}

/** Looks for a bypass with the bridge disabled; a negative finite sample is inconclusive. */
export function proveSequenceBreakSecurity(
  level: LevelDefinition,
  bridgePlatformId: string,
  options: SequenceBreakOptions = {},
): SequenceBreakProof {
  const error = securityOptionsError(options)
  if (error !== undefined) return inconclusiveSecurity(bridgePlatformId, error)
  const bridge = level.platforms.find(
    (platform) => platform.id === bridgePlatformId,
  )
  if (bridge === undefined)
    return inconclusiveSecurity(bridgePlatformId, 'Unknown bridge platform.')
  const initial = replayTrajectory(
    level,
    options.savedProgress,
    options.approachInputSequence ?? [],
  )
  if (initial.game.snapshot().enabledPlatformIds.includes(bridgePlatformId))
    return inconclusiveSecurity(
      bridgePlatformId,
      'Bridge is already enabled in the supplied progress.',
    )
  const center = {
    x: (bridge.minX + bridge.maxX) / 2,
    y: bridge.top,
    z: (bridge.minZ + bridge.maxZ) / 2,
  }
  const normal = normalToward(
    initial.player.position,
    center,
    options.direction,
    true,
  )
  if (normal === undefined)
    return inconclusiveSecurity(
      bridgePlatformId,
      'No upstream crossing direction can be established.',
    )
  const projections =
    bridge.supportPolygon?.map((point) => project(point, normal)) ??
    projectedBounds(bridge, normal)
  return probeBoundary(
    level,
    bridgePlatformId,
    {
      normal,
      near: Math.min(...projections),
      far: Math.max(...projections),
      jumpBefore: 0.025,
    },
    options,
  )
}

/** Local gate probe starts at the actual replayed position; callers must supply honest progress/approach. */
export function proveBarrierSecurity(
  level: LevelDefinition,
  gateEncounterId: string,
  spawnPosition: Vec3,
  options: SequenceBreakOptions = {},
): SequenceBreakProof {
  const error = securityOptionsError(options)
  if (error !== undefined) return inconclusiveSecurity(gateEncounterId, error)
  if (
    ![spawnPosition.x, spawnPosition.y, spawnPosition.z].every(Number.isFinite)
  )
    return inconclusiveSecurity(
      gateEncounterId,
      'Requested start must be finite.',
    )
  const gate = level.breakables.find((target) => target.id === gateEncounterId)
  if (gate === undefined)
    return inconclusiveSecurity(gateEncounterId, 'Unknown barrier encounter.')
  const initial = replayTrajectory(
    level,
    options.savedProgress,
    options.approachInputSequence ?? [],
  )
  if (
    distXZ(initial.player.position, spawnPosition) > 0.001 ||
    Math.abs(initial.player.position.y - spawnPosition.y) > 0.001
  ) {
    return inconclusiveSecurity(
      gateEncounterId,
      'Requested start does not match the actual runtime checkpoint/approach; teleporting is not a route proof.',
    )
  }
  const snapshot = initial.game.snapshot()
  if (snapshot.completedBreakableIds.includes(gateEncounterId))
    return inconclusiveSecurity(
      gateEncounterId,
      'Gate encounter is already completed.',
    )
  const solids = getActiveCourseSolids(
    level,
    new Set(snapshot.completedBreakableIds),
  ).filter(
    (solid) =>
      solid.kind === 'prop' &&
      (solid.activation?.noneCompleted?.includes(gateEncounterId) === true ||
        solid.id.startsWith(`barrier:${gateEncounterId}:`)),
  )
  if (solids.length === 0)
    return inconclusiveSecurity(
      gateEncounterId,
      'No active collision solid is associated with this gate.',
    )
  const normal = normalToward(
    initial.player.position,
    gate.position,
    options.direction,
  )
  if (normal === undefined)
    return inconclusiveSecurity(
      gateEncounterId,
      'No upstream crossing direction can be established.',
    )
  const projections = solids.flatMap((solid) => {
    if (solid.kind === 'prop' && solid.shape === 'cylinder') {
      const center = project({ x: solid.x, z: solid.z }, normal)
      const radius = Math.max(solid.radiusTop, solid.radiusBottom)
      return [center - radius, center + radius]
    }
    return projectedBounds(solid, normal)
  })
  return probeBoundary(
    level,
    gateEncounterId,
    {
      normal,
      near: Math.min(...projections),
      far: Math.max(...projections),
      jumpBefore: MOVEMENT.radius + 0.03,
    },
    options,
  )
}
