// Level composer — coordinate focused authoring stages into one validated runtime definition.

import type { LevelDefinition } from '../contracts'
import { applyActivationOverrides } from './activation-overrides'
import { compileRoom } from './compile-room'
import { compileConnections } from './connections'
import type { AuthoredLevelSource, LevelAuthoringCatalog, LevelAuthoringDiagnostic, RoomExitDefinition, } from './contracts'
import { LevelAuthoringError } from './contracts'
import { compileExhibits } from './exhibits'
import type { CompiledRoom } from './internal'
import { diagnostic, mapEncounterRefs, resolveRoomMember, runtimePrefix, runtimeRoomId, sortedById, } from './internal'
import { compilePresentation } from './presentation'
import { assertSupportedRoomTransform } from './transform'
import { completionClosure, recordRecipe, uniqueIds, validateDependencies, validateExitCoverage, validatePrefab, validateSupportedPose, validBounds3, validId, } from './validation'

function validateSourceHeader(
  source: AuthoredLevelSource,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  validId(source.levelId, 'levelId', diagnostics)
  validId(source.layoutId, 'layoutId', diagnostics)
  if (!Number.isInteger(source.contentRevision) || source.contentRevision < 1)
    diagnostic(
      diagnostics,
      'invalid-revision',
      'contentRevision',
      'Content revision must be a positive integer.',
    )
  if (!Number.isFinite(source.fallBelow))
    diagnostic(
      diagnostics,
      'invalid-number',
      'fallBelow',
      'Fall threshold must be finite.',
    )
  if (!validBounds3(source.worldBounds))
    diagnostic(
      diagnostics,
      'invalid-bounds',
      'worldBounds',
      'World bounds must be finite and have positive size.',
    )
  if (!validBounds3(source.lightBounds))
    diagnostic(
      diagnostics,
      'invalid-bounds',
      'lightBounds',
      'Light bounds must be finite and have positive size.',
    )
  uniqueIds(source.rooms, 'rooms', diagnostics)
  uniqueIds(source.exhibits, 'exhibits', diagnostics)
}

function validateExhibitPrefabs(
  source: AuthoredLevelSource,
  catalog: LevelAuthoringCatalog,
  runtimeEncounterIds: ReadonlyMap<string, string>,
  optionalEncounterIds: ReadonlySet<string>,
  availableRecipes: ReadonlySet<string>,
  usedRecipes: Set<string>,
  diagnostics: LevelAuthoringDiagnostic[],
): Map<string, readonly string[]> {
  const dependencies = new Map(
    source.exhibits.map((item) => [
      item.id,
      [...(item.requiresCompleted ?? [])],
    ]),
  )
  for (const placement of source.exhibits) {
    const prefab = catalog.exhibits[placement.prefabId]
    if (prefab === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `exhibits.${placement.id}.prefabId`,
        `Unknown exhibit prefab "${placement.prefabId}".`,
      )
    } else {
      recordRecipe(
        prefab.variant,
        `exhibitPrefabs.${prefab.id}.variant`,
        availableRecipes,
        usedRecipes,
        diagnostics,
      )
      if (
        ![
          prefab.plinth.height,
          prefab.plinth.radiusTop,
          prefab.plinth.radiusBottom,
        ].every(Number.isFinite) ||
        prefab.plinth.height <= 0 ||
        prefab.plinth.radiusTop <= 0 ||
        prefab.plinth.radiusBottom <= 0
      )
        diagnostic(
          diagnostics,
          'invalid-solid',
          `exhibitPrefabs.${prefab.id}.plinth`,
          'Plinth height and radii must be finite and positive.',
        )
      if (prefab.plinth.presentation.role !== 'plinth')
        diagnostic(
          diagnostics,
          'invalid-presentation',
          `exhibitPrefabs.${prefab.id}.plinth.presentation.role`,
          'An exhibit mount must use the plinth presentation role.',
        )
      const hold = prefab.hold
      if (
        ![
          hold.requiredSeconds,
          hold.toleranceCents,
          hold.confidenceFloor,
          hold.dropoutGraceSeconds,
          hold.decayPerSecond,
          hold.maximumSampleGapSeconds,
          hold.maximumSampleAgeMs,
        ].every(Number.isFinite) ||
        hold.requiredSeconds <= 0 ||
        hold.toleranceCents <= 0 ||
        hold.confidenceFloor < 0 ||
        hold.confidenceFloor > 1 ||
        hold.dropoutGraceSeconds < 0 ||
        hold.decayPerSecond < 0 ||
        hold.maximumSampleGapSeconds <= 0 ||
        hold.maximumSampleAgeMs <= 0
      )
        diagnostic(
          diagnostics,
          'invalid-hold',
          `exhibitPrefabs.${prefab.id}.hold`,
          'Held-note timing and tolerance must be positive and finite; confidence must be between zero and one.',
        )
      recordRecipe(
        prefab.plinth.presentation.assetRecipeId,
        `exhibitPrefabs.${prefab.id}.plinth.presentation.assetRecipeId`,
        availableRecipes,
        usedRecipes,
        diagnostics,
      )
    }
    for (const required of placement.requiresCompleted ?? [])
      if (!runtimeEncounterIds.has(required))
        diagnostic(
          diagnostics,
          'missing-reference',
          `exhibits.${placement.id}.requiresCompleted`,
          `Unknown encounter "${required}".`,
        )
  }
  validateDependencies(
    source.exhibits,
    dependencies,
    optionalEncounterIds,
    diagnostics,
  )
  return dependencies
}

function runtimeDependencies(
  level: LevelDefinition,
): Map<string, readonly string[]> {
  return new Map(
    level.breakables.map((item) => [item.id, item.requiresCompleted ?? []]),
  )
}

function validateRuntimeAnchors(
  level: LevelDefinition,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const dependencies = runtimeDependencies(level)
  const allCompleted = new Set(level.breakables.map((item) => item.id))
  validateSupportedPose(
    level,
    level.spawn.position,
    new Set(),
    'spawnCheckpoint',
    diagnostics,
  )
  for (const checkpoint of level.checkpoints) {
    const required = completionClosure(
      checkpoint.requiresCompleted ?? [],
      dependencies,
    )
    validateSupportedPose(
      level,
      checkpoint.position,
      required,
      `checkpoints.${checkpoint.id}`,
      diagnostics,
    )
    if (required.size !== allCompleted.size)
      validateSupportedPose(
        level,
        checkpoint.position,
        allCompleted,
        `checkpoints.${checkpoint.id}.after-completions`,
        diagnostics,
      )
  }
  for (const target of level.breakables)
    validateSupportedPose(
      level,
      target.anchor,
      completionClosure(target.requiresCompleted ?? [], dependencies),
      `exhibits.${target.id}.anchor`,
      diagnostics,
    )
  validateSupportedPose(
    level,
    {
      x: (level.exit.minX + level.exit.maxX) / 2,
      y: level.exit.top,
      z: (level.exit.minZ + level.exit.maxZ) / 2,
    },
    completionClosure(level.exit.requiresCompleted, dependencies),
    'exit.zone',
    diagnostics,
  )
}

function validateRuntimeIds(
  level: LevelDefinition,
  diagnostics: LevelAuthoringDiagnostic[],
): void {
  const ids = new Set<string>()
  for (const item of [
    ...level.platforms,
    ...(level.solids ?? []),
    ...level.checkpoints,
    ...level.breakables,
  ]) {
    if (ids.has(item.id))
      diagnostic(
        diagnostics,
        'duplicate-runtime-id',
        item.id,
        `Compiled runtime ID "${item.id}" is not unique.`,
      )
    ids.add(item.id)
  }
}

/** Compile authored room data, rejecting only errors this static layer can prove. */
export function composeLevel(
  source: AuthoredLevelSource,
  catalog: LevelAuthoringCatalog,
): LevelDefinition {
  const diagnostics: LevelAuthoringDiagnostic[] = []
  const availableRecipes = new Set(catalog.availableAssetRecipeIds)
  const usedRecipes = new Set<string>()
  validateSourceHeader(source, diagnostics)

  const roomPlacements = sortedById(source.rooms)
  const invalidRoomIds = new Set<string>()
  const validatedPrefabs = new Set<string>()
  for (const placement of roomPlacements) {
    try {
      assertSupportedRoomTransform(placement, `rooms.${placement.id}`)
    } catch (error) {
      invalidRoomIds.add(placement.id)
      diagnostic(
        diagnostics,
        'unsupported-transform',
        `rooms.${placement.id}`,
        error instanceof Error ? error.message : String(error),
      )
    }
    const prefab = catalog.rooms[placement.prefabId]
    if (prefab === undefined) {
      diagnostic(
        diagnostics,
        'missing-reference',
        `rooms.${placement.id}.prefabId`,
        `Unknown room prefab "${placement.prefabId}".`,
      )
      continue
    }
    if (!validatedPrefabs.has(prefab.id)) {
      validatePrefab(
        prefab,
        `roomPrefabs.${prefab.id}`,
        availableRecipes,
        usedRecipes,
        diagnostics,
      )
      validatedPrefabs.add(prefab.id)
    }
  }

  const exhibitPlacements = sortedById(source.exhibits)
  const runtimeEncounterIds = new Map(
    exhibitPlacements.map((item) => [
      item.id,
      runtimeRoomId(source, item.roomId, 'encounter', item.id),
    ]),
  )
  const optionalEncounterIds = new Set(
    exhibitPlacements.filter((item) => item.optional).map((item) => item.id),
  )
  const authoredDependencies = validateExhibitPrefabs(
    source,
    catalog,
    runtimeEncounterIds,
    optionalEncounterIds,
    availableRecipes,
    usedRecipes,
    diagnostics,
  )
  validateExitCoverage(
    source.exhibits,
    source.exit.requiresCompleted,
    authoredDependencies,
    diagnostics,
  )

  const rooms = new Map<string, CompiledRoom>()
  for (const placement of roomPlacements) {
    const prefab = catalog.rooms[placement.prefabId]
    if (prefab === undefined || invalidRoomIds.has(placement.id)) continue
    rooms.set(
      placement.id,
      compileRoom(source, placement, prefab, runtimeEncounterIds, diagnostics),
    )
  }
  applyActivationOverrides(
    source,
    rooms,
    runtimeEncounterIds,
    optionalEncounterIds,
    diagnostics,
  )
  const exhibits = compileExhibits(
    source,
    exhibitPlacements,
    catalog,
    rooms,
    runtimeEncounterIds,
    diagnostics,
  )
  const connections = compileConnections(
    source,
    rooms,
    runtimeEncounterIds,
    optionalEncounterIds,
    availableRecipes,
    usedRecipes,
    diagnostics,
  )

  const spawn = resolveRoomMember(
    source.spawnCheckpoint,
    'spawnCheckpoint',
    rooms,
    (room) => room.checkpointsByLocal,
    diagnostics,
  )
  const exit = resolveRoomMember(
    source.exit.zone,
    'exit.zone',
    rooms,
    (room) => room.exits,
    diagnostics,
  )
  const exitRequirements =
    mapEncounterRefs(
      source.exit.requiresCompleted,
      runtimeEncounterIds,
      'exit.requiresCompleted',
      diagnostics,
    ) ?? []
  for (const ref of source.exit.requiresCompleted)
    if (optionalEncounterIds.has(ref))
      diagnostic(
        diagnostics,
        'optional-required',
        'exit.requiresCompleted',
        `Exit cannot require optional encounter "${ref}".`,
      )

  const checkpoints = [...rooms.values()].flatMap((room) => room.checkpoints)
  const fallbackExit: RoomExitDefinition = {
    id: 'invalid-exit',
    minX: 0,
    maxX: 1,
    minZ: 0,
    maxZ: 1,
    top: 0,
  }
  const resolvedExit = exit?.value ?? fallbackExit
  const level: LevelDefinition = {
    id: runtimePrefix(source),
    title: source.title,
    authored: {
      levelId: source.levelId,
      layoutId: source.layoutId,
      contentRevision: source.contentRevision,
    },
    spawn: {
      position: { ...(spawn?.value.position ?? { x: 0, y: 0, z: 0 }) },
      facingYaw: spawn?.value.facingYaw ?? 0,
      checkpointId: spawn?.value.id,
    },
    platforms: [...rooms.values()].flatMap((room) => room.platforms),
    solids: [
      ...[...rooms.values()].flatMap((room) =>
        room.solids.filter(
          (solid) => !connections.removedSealIds.has(solid.id),
        ),
      ),
      ...exhibits.plinths,
      ...connections.solids,
    ],
    checkpoints,
    breakables: exhibits.breakables,
    exit: {
      minX: resolvedExit.minX,
      maxX: resolvedExit.maxX,
      minZ: resolvedExit.minZ,
      maxZ: resolvedExit.maxZ,
      top: resolvedExit.top,
      requiresCompleted: exitRequirements,
    },
    fallBelow: source.fallBelow,
    presentation: compilePresentation(source, rooms, usedRecipes),
  }

  validateRuntimeIds(level, diagnostics)
  if (spawn && exit) validateRuntimeAnchors(level, diagnostics)
  if (diagnostics.length > 0) throw new LevelAuthoringError(diagnostics)
  return level
}
