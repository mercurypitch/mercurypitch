// Cloudway course compiler — validates measured JSON routes and emits runtime level definitions.

import type { LevelDefinition, LevelMovementDefinition } from '../contracts'
import { LEVEL_MOVEMENT_LIMITS } from '../contracts.ts'
import type { CloudwayCourseProfileCatalog } from './cloudway-course-profiles'
import type { CloudwayCourseDocumentSource } from './cloudway-course-source'
import { array, bounds3, CLOUDWAY_GAP_TOLERANCE, exactKeys, fail, finite, identifierSet, positive, record, string, stringArray, vec3, } from './cloudway-course-validation.ts'
import { compileEncounter, requireKnownReferences, validateEncounterGraph, validateStaticAnchor, } from './compile-cloudway-encounters.ts'
import { compileCloudwayMelodyLesson, validateMelodyRoute, } from './compile-cloudway-melody.ts'
import { compileGap, compilePlatform } from './compile-cloudway-platforms.ts'

const COURSE_SCHEMA = 'mercurypitch.cloudway-course'

function compileMovement(raw: unknown, path: string): LevelMovementDefinition {
  const movement = record(raw, path)
  exactKeys(movement, path, [
    'walkSpeed',
    'runSpeed',
    'runDelaySeconds',
    'runRampSeconds',
  ])
  const compiled = {
    walkSpeed: finite(movement.walkSpeed, `${path}.walkSpeed`),
    runSpeed: finite(movement.runSpeed, `${path}.runSpeed`),
    runDelaySeconds: finite(
      movement.runDelaySeconds,
      `${path}.runDelaySeconds`,
    ),
    runRampSeconds: finite(movement.runRampSeconds, `${path}.runRampSeconds`),
  }
  if (compiled.walkSpeed <= 0) fail(`${path}.walkSpeed`, 'must be positive.')
  if (
    compiled.runSpeed < compiled.walkSpeed ||
    compiled.runSpeed > LEVEL_MOVEMENT_LIMITS.maximumSpeed
  )
    fail(
      `${path}.runSpeed`,
      `must be between walkSpeed and ${LEVEL_MOVEMENT_LIMITS.maximumSpeed}.`,
    )
  if (
    compiled.runDelaySeconds < 0 ||
    compiled.runDelaySeconds > LEVEL_MOVEMENT_LIMITS.maximumRunDelaySeconds
  )
    fail(
      `${path}.runDelaySeconds`,
      `must be between 0 and ${LEVEL_MOVEMENT_LIMITS.maximumRunDelaySeconds}.`,
    )
  if (
    compiled.runRampSeconds <= 0 ||
    compiled.runRampSeconds > LEVEL_MOVEMENT_LIMITS.maximumRunRampSeconds
  )
    fail(
      `${path}.runRampSeconds`,
      `must be positive and at most ${LEVEL_MOVEMENT_LIMITS.maximumRunRampSeconds}.`,
    )
  return compiled
}

function compileCourse(
  raw: unknown,
  catalog: CloudwayCourseProfileCatalog,
  path: string,
  schemaVersion: 2 | 3,
): LevelDefinition {
  const source = record(raw, path)
  exactKeys(
    source,
    path,
    [
      'id',
      'title',
      'authored',
      'movement',
      'guidance',
      'spawn',
      'platforms',
      'gaps',
      'checkpoints',
      'encounters',
      'camera',
      'exit',
      'fallBelow',
      'presentation',
    ],
    schemaVersion === 3 ? ['melodyLesson'] : [],
  )

  const platformValues = array(source.platforms, `${path}.platforms`).map(
    (platform, index) =>
      compilePlatform(platform, catalog, `${path}.platforms[${index}]`),
  )
  identifierSet(
    platformValues.map((platform) => platform.definition.id),
    `${path}.platforms`,
  )
  const platformMap = new Map(
    platformValues.map((platform) => [platform.definition.id, platform]),
  )
  const platforms = platformValues.map((platform) => platform.definition)

  const gapValues = array(source.gaps, `${path}.gaps`).map((gap, index) =>
    compileGap(gap, platformMap, `${path}.gaps[${index}]`),
  )
  identifierSet(
    gapValues.map((gap) => gap.id),
    `${path}.gaps`,
  )

  const encounterValues = array(source.encounters, `${path}.encounters`).map(
    (encounter, index) =>
      compileEncounter(
        encounter,
        catalog,
        `${path}.encounters[${index}]`,
        schemaVersion,
      ),
  )
  const breakables = encounterValues.map((encounter) => encounter.definition)
  validateEncounterGraph(breakables)
  for (const [index, target] of breakables.entries())
    validateStaticAnchor(
      target.anchor,
      platforms,
      `${path}.encounters[${index}].anchor`,
    )
  const encounterIds = new Set(breakables.map((target) => target.id))

  const authored = record(source.authored, `${path}.authored`)
  exactKeys(authored, `${path}.authored`, [
    'levelId',
    'layoutId',
    'contentRevision',
  ])
  const id = string(source.id, `${path}.id`)
  const levelId = string(authored.levelId, `${path}.authored.levelId`)
  if (id !== levelId)
    fail(`${path}.authored.levelId`, 'must equal the course id.')
  const contentRevision = positive(
    authored.contentRevision,
    `${path}.authored.contentRevision`,
  )
  if (!Number.isInteger(contentRevision))
    fail(`${path}.authored.contentRevision`, 'must be an integer.')

  const movement = compileMovement(source.movement, `${path}.movement`)
  const guidance = record(source.guidance, `${path}.guidance`)
  exactKeys(guidance, `${path}.guidance`, [
    'subtitle',
    'openingNotice',
    'completionTitle',
    'completionNext',
  ])
  const spawn = record(source.spawn, `${path}.spawn`)
  exactKeys(spawn, `${path}.spawn`, ['position', 'facingYaw', 'checkpointId'])
  const spawnPosition = vec3(spawn.position, `${path}.spawn.position`)
  validateStaticAnchor(spawnPosition, platforms, `${path}.spawn.position`)

  const checkpointValues = array(source.checkpoints, `${path}.checkpoints`).map(
    (rawCheckpoint, index) => {
      const checkpointPath = `${path}.checkpoints[${index}]`
      const checkpoint = record(rawCheckpoint, checkpointPath)
      exactKeys(
        checkpoint,
        checkpointPath,
        ['id', 'position', 'radius', 'facingYaw'],
        ['requiresCompleted'],
      )
      const position = vec3(checkpoint.position, `${checkpointPath}.position`)
      validateStaticAnchor(position, platforms, `${checkpointPath}.position`)
      const requiresCompleted =
        checkpoint.requiresCompleted === undefined
          ? undefined
          : stringArray(
              checkpoint.requiresCompleted,
              `${checkpointPath}.requiresCompleted`,
            )
      if (requiresCompleted !== undefined)
        requireKnownReferences(
          requiresCompleted,
          encounterIds,
          `${checkpointPath}.requiresCompleted`,
        )
      return {
        id: string(checkpoint.id, `${checkpointPath}.id`),
        position,
        radius: positive(checkpoint.radius, `${checkpointPath}.radius`),
        facingYaw: finite(checkpoint.facingYaw, `${checkpointPath}.facingYaw`),
        requiresCompleted,
      }
    },
  )
  const checkpointIds = identifierSet(
    checkpointValues.map((checkpoint) => checkpoint.id),
    `${path}.checkpoints`,
  )
  const spawnCheckpointId = string(
    spawn.checkpointId,
    `${path}.spawn.checkpointId`,
  )
  if (!checkpointIds.has(spawnCheckpointId))
    fail(`${path}.spawn.checkpointId`, 'references an unknown checkpoint.')

  const camera = record(source.camera, `${path}.camera`)
  exactKeys(camera, `${path}.camera`, [
    'initialSectionId',
    'landingDwellSeconds',
    'sections',
  ])
  const sections = array(camera.sections, `${path}.camera.sections`).map(
    (rawSection, index) => {
      const sectionPath = `${path}.camera.sections[${index}]`
      const section = record(rawSection, sectionPath)
      exactKeys(
        section,
        sectionPath,
        ['id', 'platformIds', 'lookFromPlatformId', 'lookToPlatformId'],
        ['targetOffset'],
      )
      const platformIds = stringArray(
        section.platformIds,
        `${sectionPath}.platformIds`,
      )
      identifierSet(platformIds, `${sectionPath}.platformIds`)
      for (const [platformIndex, platformId] of platformIds.entries())
        if (!platformMap.has(platformId))
          fail(
            `${sectionPath}.platformIds[${platformIndex}]`,
            `references unknown platform "${platformId}".`,
          )
      const fromId = string(
        section.lookFromPlatformId,
        `${sectionPath}.lookFromPlatformId`,
      )
      const toId = string(
        section.lookToPlatformId,
        `${sectionPath}.lookToPlatformId`,
      )
      const from = platformMap.get(fromId)
      const to = platformMap.get(toId)
      if (from === undefined)
        fail(
          `${sectionPath}.lookFromPlatformId`,
          'references an unknown platform.',
        )
      if (to === undefined)
        fail(
          `${sectionPath}.lookToPlatformId`,
          'references an unknown platform.',
        )
      const dx = to.center.x - from.center.x
      const dz = to.center.z - from.center.z
      if (Math.hypot(dx, dz) <= CLOUDWAY_GAP_TOLERANCE)
        fail(
          sectionPath,
          'look direction platforms must have distinct centres.',
        )
      return {
        id: string(section.id, `${sectionPath}.id`),
        platformIds,
        yaw: Math.atan2(-dx, -dz),
        targetOffset:
          section.targetOffset === undefined
            ? undefined
            : vec3(section.targetOffset, `${sectionPath}.targetOffset`),
      }
    },
  )
  const sectionIds = identifierSet(
    sections.map((section) => section.id),
    `${path}.camera.sections`,
  )
  const cameraPlatformIds = new Set<string>()
  for (const [sectionIndex, section] of sections.entries())
    for (const [platformIndex, platformId] of section.platformIds.entries()) {
      if (cameraPlatformIds.has(platformId))
        fail(
          `${path}.camera.sections[${sectionIndex}].platformIds[${platformIndex}]`,
          `assigns platform "${platformId}" to more than one section.`,
        )
      cameraPlatformIds.add(platformId)
    }
  for (const platform of platforms)
    if (!cameraPlatformIds.has(platform.id))
      fail(
        `${path}.camera.sections`,
        `does not assign platform "${platform.id}".`,
      )
  const initialSectionId = string(
    camera.initialSectionId,
    `${path}.camera.initialSectionId`,
  )
  if (!sectionIds.has(initialSectionId))
    fail(`${path}.camera.initialSectionId`, 'references an unknown section.')

  const exit = record(source.exit, `${path}.exit`)
  exactKeys(exit, `${path}.exit`, [
    'minX',
    'maxX',
    'minZ',
    'maxZ',
    'top',
    'requiresCompleted',
  ])
  const compiledExit = {
    minX: finite(exit.minX, `${path}.exit.minX`),
    maxX: finite(exit.maxX, `${path}.exit.maxX`),
    minZ: finite(exit.minZ, `${path}.exit.minZ`),
    maxZ: finite(exit.maxZ, `${path}.exit.maxZ`),
    top: finite(exit.top, `${path}.exit.top`),
    requiresCompleted: stringArray(
      exit.requiresCompleted,
      `${path}.exit.requiresCompleted`,
    ),
  }
  if (
    compiledExit.minX >= compiledExit.maxX ||
    compiledExit.minZ >= compiledExit.maxZ
  )
    fail(`${path}.exit`, 'must contain ordered horizontal bounds.')
  requireKnownReferences(
    compiledExit.requiresCompleted,
    encounterIds,
    `${path}.exit.requiresCompleted`,
  )
  const exitCenter = {
    x: (compiledExit.minX + compiledExit.maxX) / 2,
    y: compiledExit.top,
    z: (compiledExit.minZ + compiledExit.maxZ) / 2,
  }
  validateStaticAnchor(exitCenter, platforms, `${path}.exit`)

  const presentation = record(source.presentation, `${path}.presentation`)
  exactKeys(presentation, `${path}.presentation`, [
    'worldBounds',
    'lightBounds',
    'audioSceneId',
  ])
  const audioSceneId = presentation.audioSceneId
  if (
    audioSceneId !== 'museum' &&
    audioSceneId !== 'garden' &&
    audioSceneId !== 'gallery'
  )
    fail(`${path}.presentation.audioSceneId`, 'uses an unknown audio scene.')
  const worldBounds = bounds3(
    presentation.worldBounds,
    `${path}.presentation.worldBounds`,
  )
  const lightBounds = bounds3(
    presentation.lightBounds,
    `${path}.presentation.lightBounds`,
  )
  const melodyLesson = compileCloudwayMelodyLesson(
    source.melodyLesson,
    catalog,
    `${path}.melodyLesson`,
  )
  validateMelodyRoute(
    melodyLesson,
    breakables,
    checkpointValues,
    compiledExit.requiresCompleted,
    `${path}.melodyLesson`,
  )
  const assetRecipeIds = Array.from(
    new Set([
      ...platformValues.map((platform) => platform.profile.renderId),
      ...breakables.map((target) => target.variant),
    ]),
  )

  return {
    id,
    melodyLesson,
    title: string(source.title, `${path}.title`),
    authored: {
      levelId,
      layoutId: string(authored.layoutId, `${path}.authored.layoutId`),
      contentRevision,
    },
    movement,
    guidance: {
      subtitle: string(guidance.subtitle, `${path}.guidance.subtitle`),
      openingNotice: string(
        guidance.openingNotice,
        `${path}.guidance.openingNotice`,
      ),
      completionTitle: string(
        guidance.completionTitle,
        `${path}.guidance.completionTitle`,
      ),
      completionNext: string(
        guidance.completionNext,
        `${path}.guidance.completionNext`,
      ),
    },
    spawn: {
      position: spawnPosition,
      facingYaw: finite(spawn.facingYaw, `${path}.spawn.facingYaw`),
      checkpointId: spawnCheckpointId,
    },
    checkpoints: checkpointValues,
    camera: {
      kind: 'route-sections',
      initialSectionId,
      landingDwellSeconds: positive(
        camera.landingDwellSeconds,
        `${path}.camera.landingDwellSeconds`,
      ),
      sections,
    },
    exit: compiledExit,
    fallBelow: finite(source.fallBelow, `${path}.fallBelow`),
    intentionalGaps: gapValues,
    platforms,
    breakables,
    solids: encounterValues.flatMap((encounter) => encounter.solids),
    presentation: {
      theme: 'cloudway',
      worldBounds,
      lightBounds,
      rooms: [],
      audioRegions: [
        {
          id: `${id}-audio`,
          bounds: worldBounds,
          sceneId: audioSceneId,
        },
      ],
      visuals: [],
      assetRecipeIds,
    },
  }
}

/** Compiles strict JSON course data against code-owned certified contact profiles. */
export function compileCloudwayCourseDocument(
  raw: unknown,
  catalog: CloudwayCourseProfileCatalog,
): readonly LevelDefinition[] {
  const document = record(raw, 'courseDocument')
  exactKeys(document, 'courseDocument', ['schema', 'schemaVersion', 'courses'])
  if (document.schema !== COURSE_SCHEMA)
    fail('courseDocument.schema', `must be "${COURSE_SCHEMA}".`)
  if (document.schemaVersion !== 2 && document.schemaVersion !== 3)
    fail('courseDocument.schemaVersion', 'must be 2 or 3.')
  const schemaVersion = document.schemaVersion
  const courses = array(document.courses, 'courseDocument.courses').map(
    (course, index) =>
      compileCourse(
        course,
        catalog,
        `courseDocument.courses[${index}]`,
        schemaVersion,
      ),
  )
  identifierSet(
    courses.map((course) => course.id),
    'courseDocument.courses',
  )
  return courses
}

/** Static type assertion for authored JSON imports after runtime validation. */
export function asCloudwayCourseDocumentSource(
  value: CloudwayCourseDocumentSource,
): CloudwayCourseDocumentSource {
  return value
}
