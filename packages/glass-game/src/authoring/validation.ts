// Authoring validation — actionable structural checks without claiming physical route reachability.

import type { Bounds3, LevelDefinition, PlatformDefinition, SolidPropDefinition, Vec3, } from '../contracts'
import { containsBody } from '../core/collision'
import { MOVEMENT } from '../core/movement'
import { getActiveCourseSolids } from '../core/solid-activation'
import type { ExhibitPlacement, LevelAuthoringDiagnostic, RoomPrefab, } from './contracts'
import { diagnostic, ID_PATTERN } from './internal'

const EPSILON = 1e-6

export function validId(
  value: string,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): boolean {
  if (ID_PATTERN.test(value)) return true
  diagnostic(
    diagnostics,
    'invalid-id',
    path,
    `"${value}" must use lowercase letters, numbers and internal hyphens.`,
  )
  return false
}

export function uniqueIds(
  items: readonly { id: string }[],
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const seen = new Set<string>()
  for (const item of items) {
    validId(item.id, `${path}.${item.id}`, diagnostics)
    if (seen.has(item.id))
      diagnostic(
        diagnostics,
        'duplicate-id',
        `${path}.${item.id}`,
        `Duplicate authored ID "${item.id}".`,
      )
    seen.add(item.id)
  }
}

function finitePoint(value: Vec3): boolean {
  return [value.x, value.y, value.z].every(Number.isFinite)
}

export function validBounds3(bounds: Bounds3): boolean {
  return (
    [
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
      bounds.minZ,
      bounds.maxZ,
    ].every(Number.isFinite) &&
    bounds.minX < bounds.maxX &&
    bounds.minY < bounds.maxY &&
    bounds.minZ < bounds.maxZ
  )
}

function cardinalYaw(yaw: number): boolean {
  if (!Number.isFinite(yaw)) return false
  const turns = yaw / (Math.PI / 2)
  return Math.abs(turns - Math.round(turns)) < EPSILON
}

export function recordRecipe(
  id: string | undefined,
  path: string,
  available: ReadonlySet<string>,
  used: Set<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  if (id === undefined) return
  if (!available.has(id))
    diagnostic(
      diagnostics,
      'missing-asset-recipe',
      path,
      `Asset recipe "${id}" is not present in the supplied catalog keys.`,
    )
  else used.add(id)
}

export function validatePrefab(
  prefab: RoomPrefab,
  path: string,
  available: ReadonlySet<string>,
  used: Set<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  if (!validBounds3(prefab.bounds))
    diagnostic(
      diagnostics,
      'invalid-bounds',
      `${path}.bounds`,
      'Room bounds must be finite and have positive size.',
    )
  if (prefab.cameraBounds && !validBounds3(prefab.cameraBounds))
    diagnostic(
      diagnostics,
      'invalid-bounds',
      `${path}.cameraBounds`,
      'Camera bounds must be finite and have positive size.',
    )
  uniqueIds(prefab.platforms, `${path}.platforms`, diagnostics)
  uniqueIds(prefab.solids, `${path}.solids`, diagnostics)
  uniqueIds(prefab.checkpoints, `${path}.checkpoints`, diagnostics)
  uniqueIds(prefab.ports, `${path}.ports`, diagnostics)
  uniqueIds(prefab.exhibitMounts, `${path}.exhibitMounts`, diagnostics)
  uniqueIds(prefab.exits, `${path}.exits`, diagnostics)
  uniqueIds(prefab.visuals, `${path}.visuals`, diagnostics)
  uniqueIds(prefab.decorations ?? [], `${path}.decorations`, diagnostics)
  uniqueIds(prefab.audioRegions, `${path}.audioRegions`, diagnostics)

  const platformIds = new Set(prefab.platforms.map((item) => item.id))
  const solidIds = new Set(prefab.solids.map((item) => item.id))
  const checkpointIds = new Set(prefab.checkpoints.map((item) => item.id))
  for (const platform of prefab.platforms) {
    if (
      ![
        platform.minX,
        platform.maxX,
        platform.minZ,
        platform.maxZ,
        platform.top,
        platform.thickness,
      ].every(Number.isFinite) ||
      platform.minX >= platform.maxX ||
      platform.minZ >= platform.maxZ ||
      platform.thickness <= 0
    )
      diagnostic(
        diagnostics,
        'invalid-solid',
        `${path}.platforms.${platform.id}`,
        'Platform bounds, top and positive thickness must be finite.',
      )
    if ((platform.activation?.noneCompleted?.length ?? 0) > 0)
      diagnostic(
        diagnostics,
        'non-monotonic-platform',
        `${path}.platforms.${platform.id}.activation.noneCompleted`,
        'Platforms may only enable permanently after completion; disappearing floors are unsupported.',
      )
    if (
      platform.catchCheckpointId !== undefined &&
      !checkpointIds.has(platform.catchCheckpointId)
    )
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.platforms.${platform.id}.catchCheckpointId`,
        `Unknown local checkpoint "${platform.catchCheckpointId}".`,
      )
    recordRecipe(
      platform.renderId,
      `${path}.platforms.${platform.id}.renderId`,
      available,
      used,
      diagnostics,
    )
    recordRecipe(
      platform.presentation?.assetRecipeId,
      `${path}.platforms.${platform.id}.presentation.assetRecipeId`,
      available,
      used,
      diagnostics,
    )
  }
  for (const solid of prefab.solids) {
    const validShape =
      solid.shape === 'box'
        ? [solid.minX, solid.maxX, solid.minZ, solid.maxZ].every(
            Number.isFinite,
          ) &&
          solid.minX < solid.maxX &&
          solid.minZ < solid.maxZ
        : [solid.x, solid.z, solid.radiusTop, solid.radiusBottom].every(
            Number.isFinite,
          ) &&
          solid.radiusTop > 0 &&
          solid.radiusBottom > 0
    if (
      !validShape ||
      !Number.isFinite(solid.top) ||
      !Number.isFinite(solid.thickness) ||
      solid.thickness <= 0
    )
      diagnostic(
        diagnostics,
        'invalid-solid',
        `${path}.solids.${solid.id}`,
        'Solid dimensions, top and positive thickness must be finite.',
      )
    if (solid.platformId !== undefined && !platformIds.has(solid.platformId))
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.solids.${solid.id}.platformId`,
        `Unknown local platform "${solid.platformId}".`,
      )
    recordRecipe(
      solid.presentation?.assetRecipeId,
      `${path}.solids.${solid.id}.presentation.assetRecipeId`,
      available,
      used,
      diagnostics,
    )
  }
  for (const checkpoint of prefab.checkpoints)
    if (
      !finitePoint(checkpoint.position) ||
      !Number.isFinite(checkpoint.facingYaw) ||
      !Number.isFinite(checkpoint.radius) ||
      checkpoint.radius <= 0
    )
      diagnostic(
        diagnostics,
        'invalid-anchor',
        `${path}.checkpoints.${checkpoint.id}`,
        'Checkpoint position, facing and positive radius must be finite.',
      )
  for (const port of prefab.ports) {
    if (
      !finitePoint(port.position) ||
      !cardinalYaw(port.facingYaw) ||
      !Number.isFinite(port.width) ||
      !Number.isFinite(port.height) ||
      port.width <= 0 ||
      port.height <= 0
    )
      diagnostic(
        diagnostics,
        'invalid-port',
        `${path}.ports.${port.id}`,
        'Port position and positive dimensions must be finite, with cardinal facingYaw.',
      )
    if (!solidIds.has(port.sealSolidId))
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.ports.${port.id}.sealSolidId`,
        `Unknown local seal solid "${port.sealSolidId}".`,
      )
  }
  for (const mount of prefab.exhibitMounts) {
    if (
      !finitePoint(mount.position) ||
      !finitePoint(mount.anchor) ||
      !Number.isFinite(mount.facingYaw)
    )
      diagnostic(
        diagnostics,
        'invalid-anchor',
        `${path}.exhibitMounts.${mount.id}`,
        'Exhibit position, listening anchor and facing must be finite.',
      )
    if (!platformIds.has(mount.platformId))
      diagnostic(
        diagnostics,
        'missing-reference',
        `${path}.exhibitMounts.${mount.id}.platformId`,
        `Unknown local platform "${mount.platformId}".`,
      )
  }
  for (const exit of prefab.exits)
    if (
      ![exit.minX, exit.maxX, exit.minZ, exit.maxZ, exit.top].every(
        Number.isFinite,
      ) ||
      exit.minX >= exit.maxX ||
      exit.minZ >= exit.maxZ
    )
      diagnostic(
        diagnostics,
        'invalid-bounds',
        `${path}.exits.${exit.id}`,
        'Exit bounds and top must be finite, with ordered horizontal bounds.',
      )
  const coveredSolidOwners = new Map<string, string>()
  const portSealIds = new Set(prefab.ports.map((port) => port.sealSolidId))
  const validateCoveredSolids = (
    itemKind: 'visual' | 'decoration',
    itemId: string,
    coveredSolidIds: readonly string[],
  ) => {
    const itemOwner = `${itemKind} "${itemId}"`
    const covered = new Set<string>()
    for (const solidId of coveredSolidIds) {
      const referencePath = `${path}.${itemKind}s.${itemId}.coversSolidIds`
      if (covered.has(solidId))
        diagnostic(
          diagnostics,
          'duplicate-reference',
          referencePath,
          `Solid "${solidId}" is covered more than once by this ${itemKind}.`,
        )
      covered.add(solidId)
      const owner = coveredSolidOwners.get(solidId)
      if (owner !== undefined && owner !== itemOwner)
        diagnostic(
          diagnostics,
          'duplicate-reference',
          referencePath,
          `Solid "${solidId}" is already covered by ${owner}.`,
        )
      coveredSolidOwners.set(solidId, itemOwner)
      if (portSealIds.has(solidId))
        diagnostic(
          diagnostics,
          'invalid-presentation',
          referencePath,
          `Connection seal "${solidId}" cannot be covered by room art.`,
        )
      if (!solidIds.has(solidId))
        diagnostic(
          diagnostics,
          'missing-reference',
          referencePath,
          `Unknown local solid "${solidId}".`,
        )
      else {
        const solid = prefab.solids.find((item) => item.id === solidId)!
        if (solid.presentation === undefined && solid.fallback === undefined)
          diagnostic(
            diagnostics,
            'invalid-presentation',
            referencePath,
            `Covered solid "${solidId}" needs a visible fallback proxy.`,
          )
      }
    }
  }
  for (const visual of prefab.visuals) {
    const raw = visual as typeof visual & Record<string, unknown>
    if (raw.scale !== undefined)
      diagnostic(
        diagnostics,
        'unsupported-transform',
        `${path}.visuals.${visual.id}.scale`,
        'Visual scale is unsupported; normalize the authored asset recipe.',
      )
    if (!finitePoint(visual.position) || !Number.isFinite(visual.yaw))
      diagnostic(
        diagnostics,
        'invalid-transform',
        `${path}.visuals.${visual.id}`,
        'Visual position and yaw must be finite.',
      )
    recordRecipe(
      visual.recipeId,
      `${path}.visuals.${visual.id}.recipeId`,
      available,
      used,
      diagnostics,
    )
    validateCoveredSolids('visual', visual.id, visual.coversSolidIds ?? [])
  }
  for (const decoration of prefab.decorations ?? []) {
    if (
      !finitePoint(decoration.position) ||
      !Number.isFinite(decoration.yaw) ||
      (decoration.scale !== undefined &&
        (!Number.isFinite(decoration.scale) || decoration.scale <= 0))
    )
      diagnostic(
        diagnostics,
        'invalid-transform',
        `${path}.decorations.${decoration.id}`,
        'Decoration position, yaw and positive scale must be finite.',
      )
    recordRecipe(
      decoration.recipeId,
      `${path}.decorations.${decoration.id}.recipeId`,
      available,
      used,
      diagnostics,
    )
    validateCoveredSolids(
      'decoration',
      decoration.id,
      decoration.coversSolidIds ?? [],
    )
  }
  for (const region of prefab.audioRegions)
    if (!validBounds3(region.bounds))
      diagnostic(
        diagnostics,
        'invalid-bounds',
        `${path}.audioRegions.${region.id}.bounds`,
        'Audio bounds must be finite and have positive size.',
      )
}

export function validateDependencies(
  exhibits: readonly ExhibitPlacement[],
  dependencies: ReadonlyMap<string, readonly string[]>,
  optionalIds: ReadonlySet<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string, trail: readonly string[]): void => {
    if (visiting.has(id)) {
      const start = trail.indexOf(id)
      diagnostic(
        diagnostics,
        'dependency-cycle',
        `exhibits.${id}.requiresCompleted`,
        `Encounter dependency cycle: ${[...trail.slice(start), id].join(
          ' -> ',
        )}.`,
      )
      return
    }
    if (visited.has(id)) return
    visiting.add(id)
    for (const required of dependencies.get(id) ?? [])
      if (dependencies.has(required)) visit(required, [...trail, id])
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of dependencies.keys()) visit(id, [])

  for (const exhibit of exhibits) {
    if (exhibit.optional) continue
    const closure = completionClosure(
      exhibit.requiresCompleted ?? [],
      dependencies,
    )
    for (const optionalId of optionalIds)
      if (closure.has(optionalId))
        diagnostic(
          diagnostics,
          'optional-required',
          `exhibits.${exhibit.id}.requiresCompleted`,
          `Required encounter cannot transitively depend on optional encounter "${optionalId}".`,
        )
  }
}

export function validateExitCoverage(
  exhibits: readonly ExhibitPlacement[],
  exitRequirements: readonly string[],
  dependencies: ReadonlyMap<string, readonly string[]>,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const exitClosure = completionClosure(exitRequirements, dependencies)
  for (const exhibit of exhibits) {
    if (exhibit.optional || exitClosure.has(exhibit.id)) continue
    diagnostic(
      diagnostics,
      'incomplete-exit-requirements',
      'exit.requiresCompleted',
      `Exit prerequisites do not cover required encounter "${exhibit.id}".`,
    )
  }
}

export function completionClosure(
  initial: readonly string[],
  dependencies: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const completed = new Set<string>()
  const add = (id: string): void => {
    if (completed.has(id)) return
    // Mark before recursion so malformed cycles cannot overflow before diagnostics.
    completed.add(id)
    for (const required of dependencies.get(id) ?? []) add(required)
  }
  for (const id of initial) add(id)
  return completed
}

function overlapsBody(position: Vec3, solid: SolidPropDefinition): boolean {
  const vertical =
    position.y + MOVEMENT.height > solid.top - solid.thickness + EPSILON &&
    position.y < solid.top - EPSILON
  if (!vertical) return false
  if (solid.shape === 'cylinder')
    return (
      Math.hypot(position.x - solid.x, position.z - solid.z) <
      Math.max(solid.radiusTop, solid.radiusBottom) + MOVEMENT.radius
    )
  return (
    position.x + MOVEMENT.radius > solid.minX &&
    position.x - MOVEMENT.radius < solid.maxX &&
    position.z + MOVEMENT.radius > solid.minZ &&
    position.z - MOVEMENT.radius < solid.maxZ
  )
}

export function validateSupportedPose(
  level: LevelDefinition,
  position: Vec3,
  completed: ReadonlySet<string>,
  path: string,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const active = getActiveCourseSolids(level, completed)
  const deck = active.find(
    (solid): solid is PlatformDefinition =>
      solid.kind === 'deck' && containsBody(position, MOVEMENT, solid),
  )
  const blocked = active.some(
    (solid) => solid.kind === 'prop' && overlapsBody(position, solid),
  )
  if (!deck || blocked)
    diagnostic(
      diagnostics,
      'unsupported-anchor',
      path,
      blocked
        ? 'The supported pad overlaps an active solid proxy.'
        : 'The pad is not fully supported by an active deck under its prerequisites.',
    )
}
