// Procedural Cloudway course generator — compiles Kishōtenketsu modular courses from certified 3D chunks.

import { CLOUDWAY_STUDIO_PROFILES } from '../cloudway-studio.ts'
import { compileCloudwayCourseDocument } from '../compile-cloudway-course.ts'
import type { LevelDefinition } from '../../contracts.ts'
import {
  createArcedViaductChunk,
  createArrivalChunk,
  createAuroraGlideChunk,
  createCascadingDropChunk,
  createCrystalCrossroadsChunk,
  createDiagonalGlideChunk,
  createFinalePavilionChunk,
  createFrostGlissadeChunk,
  createHexCascadeChunk,
  createScrollBridgeChunk,
  createSkyElevatorGlideChunk,
  createSlalomZigzagChunk,
  createSplitForkChunk,
  createTerracedAscentChunk,
  createViaductSCurveChunk,
  createVocalSanctuaryChunk,
  type VocalSanctuaryOptions,
} from './chunk-library.ts'
import {
  hasAssembledPlatformOverlap,
  stitchChunks,
} from './chunk-stitcher.ts'
import type {
  ProceduralChunk,
  ProceduralGeneratorOptions,
} from './contracts.ts'
import { ProceduralPrng } from './prng.ts'

export interface GeneratedCourseResult {
  readonly courseId: string
  readonly title: string
  readonly rawDocument: Record<string, unknown>
  readonly compiledLevel: LevelDefinition
}

function sanitizeIdSegment(raw: string | number): string {
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'seed'
}

export function generateProceduralCourse(
  options: ProceduralGeneratorOptions,
): GeneratedCourseResult {
  const prng = new ProceduralPrng(options.seed)
  const seedSlug = sanitizeIdSegment(options.seed)
  const courseId =
    options.courseId ?? `cloudway-procedural-${prng.int(1000, 9999)}`

  const titleTemplates = [
    `The Resonant Causeway ${options.seed}`,
    `The Celestial Glissade ${options.seed}`,
    `The Prismatic Viaduct ${options.seed}`,
    `The Frostbound Echoes ${options.seed}`,
    `The Aureate Expanse ${options.seed}`,
    `The Starlight Ribbon ${options.seed}`,
    `The Serpentine Colonnade ${options.seed}`,
    `The Arced Meridian ${options.seed}`,
    `The Bifurcated Cloudway ${options.seed}`,
    `The Labyrinthine Terrace ${options.seed}`,
    `The Ascending Spire ${options.seed}`,
    `The Crossroads of Song ${options.seed}`,
  ]
  const title = options.title ?? prng.pick(titleTemplates)
  const lessonProfileId = options.melodyLessonId ?? 'first-arc-v1'
  const includeOptionalAlcoves = options.includeOptionalAlcoves ?? true

  // Fog themes (farMeters must be <= 30m)
  const fogThemes = {
    dawn: { nearMeters: 8, farMeters: 24 },
    celestial: { nearMeters: 10, farMeters: 28 },
    aurora: { nearMeters: 6, farMeters: 22 },
    twilight: { nearMeters: 12, farMeters: 30 },
  }
  const fogThemeKeys = ['dawn', 'celestial', 'aurora', 'twilight'] as const
  const fogKey = options.fogTheme ?? prng.pick(fogThemeKeys)
  const fog = fogThemes[fogKey]

  // Select primary and secondary crystal presets
  const crystalPresets = [
    'aurora-heart',
    'resonance-veins',
    'frost-roots',
  ] as const
  const crystalPreset = prng.pick(crystalPresets)
  const secondaryCrystalPreset =
    crystalPresets[(crystalPresets.indexOf(crystalPreset) + 1) % 3]!

  // Difficulty-informed mechanics timing
  const diff = options.difficulty ?? 'balanced'
  const hexWarningTime = Number(
    (diff === 'virtuoso'
      ? prng.range(0.95, 1.15)
      : diff === 'gentle'
        ? prng.range(1.8, 2.2)
        : prng.range(1.3, 1.6)
    ).toFixed(2),
  )

  const anchorIds =
    lessonProfileId === 'sunlit-steps-v1'
      ? ([
          'sunlit-steps-home',
          'sunlit-steps-two',
          'sunlit-steps-four',
          'sunlit-steps-back-two',
          'sunlit-steps-return',
        ] as const)
      : (['first-arc-home', 'first-arc-rise', 'first-arc-return'] as const)

  const gate1Opts: VocalSanctuaryOptions = {
    barrierProfileId: 'frosted-scroll-wall',
    ...(includeOptionalAlcoves
      ? {
          optionalAlcove: {
            variant: 'goblet',
            label: 'The Whispering Goblet',
            coinId: `proc-${seedSlug}-coin-alcove-1`,
          },
        }
      : {}),
  }

  const gate2Opts: VocalSanctuaryOptions = {
    barrierProfileId: 'frost-gold-arch-breakwall-a',
  }

  // Rich 3D multi-turn topologies featuring terraced ascents, sky-elevator ferries,
  // cascading drops, crystal crossroads, curved viaducts, diagonal slaloms, and split forks:
  const topologies = [
    'celestial-terrace-ascent',
    'serpentine-weave',
    'grand-s-arc',
    'horseshoe-traverse',
    'colonnade-chicane',
    'labyrinth-ascent',
    'aurora-meander',
    'cascading-spire',
  ] as const

  const buildTopologyChunks = (
    topology: (typeof topologies)[number],
  ): ProceduralChunk[] => {
    const baseChunks: ProceduralChunk[] = (() => {
      switch (topology) {
        case 'celestial-terrace-ascent':
          return [
            createArrivalChunk(anchorIds[0]),
            createTerracedAscentChunk('c2a', hexWarningTime),
            createArcedViaductChunk('c2b', 'east', 0.36),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'none', gate1Opts),
            createCrystalCrossroadsChunk('c4a', crystalPreset, hexWarningTime),
            createSkyElevatorGlideChunk('c4b', 0.56),
            createCascadingDropChunk('c5', 'west', hexWarningTime),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'none',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'serpentine-weave':
          return [
            createArrivalChunk(anchorIds[0]),
            createArcedViaductChunk('c2a', 'east', 0.36),
            createSlalomZigzagChunk('c2b', 'hybrid', hexWarningTime),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'none', gate1Opts),
            createCrystalCrossroadsChunk('c4a', crystalPreset, hexWarningTime),
            createArcedViaductChunk('c4b', 'west', 0.36),
            createDiagonalGlideChunk('c5', 'left-to-right'),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'east',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'grand-s-arc':
          return [
            createArrivalChunk(anchorIds[0]),
            createViaductSCurveChunk('c2a'),
            createTerracedAscentChunk('c2b', hexWarningTime),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'west', gate1Opts),
            createSlalomZigzagChunk('c4a', 'frost'),
            createScrollBridgeChunk('c4b', crystalPreset),
            createArcedViaductChunk('c4c', 'east', 0.36),
            createDiagonalGlideChunk('c5', 'right-to-left'),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'west',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'horseshoe-traverse':
          return [
            createArrivalChunk(anchorIds[0]),
            createSlalomZigzagChunk('c2a', 'hybrid', hexWarningTime),
            createScrollBridgeChunk('c2b', crystalPreset),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'east', gate1Opts),
            createTerracedAscentChunk('c4a', hexWarningTime),
            createSplitForkChunk('c4b'),
            createSkyElevatorGlideChunk('c5', 0.56),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'east',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'colonnade-chicane':
          return [
            createArrivalChunk(anchorIds[0]),
            createCrystalCrossroadsChunk('c2', crystalPreset, hexWarningTime),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'east', gate1Opts),
            createScrollBridgeChunk('c4a', secondaryCrystalPreset),
            createCascadingDropChunk('c4b', 'west', hexWarningTime),
            createSkyElevatorGlideChunk('c5a', 0.56),
            createSlalomZigzagChunk('c5b', 'frost'),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'none',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'labyrinth-ascent':
          return [
            createArrivalChunk(anchorIds[0]),
            createArcedViaductChunk('c2a', 'west', 0.36),
            createScrollBridgeChunk('c2b', crystalPreset),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'east', gate1Opts),
            createViaductSCurveChunk('c4a'),
            createTerracedAscentChunk('c4b', hexWarningTime),
            createDiagonalGlideChunk('c5', 'left-to-right'),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'west',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'aurora-meander':
          return [
            createArrivalChunk(anchorIds[0]),
            createFrostGlissadeChunk('c2a'),
            createTerracedAscentChunk('c2b', hexWarningTime),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'east', gate1Opts),
            createSplitForkChunk('c4a'),
            createCrystalCrossroadsChunk(
              'c4b',
              secondaryCrystalPreset,
              hexWarningTime,
            ),
            createDiagonalGlideChunk('c5', 'right-to-left'),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'west',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
        case 'cascading-spire':
          return [
            createArrivalChunk(anchorIds[0]),
            createSkyElevatorGlideChunk('c2a', 0.56),
            createCascadingDropChunk('c2b', 'east', hexWarningTime),
            createVocalSanctuaryChunk('gate1', anchorIds[1], 'none', gate1Opts),
            createTerracedAscentChunk('c4a', hexWarningTime),
            createScrollBridgeChunk('c4b', crystalPreset),
            createArcedViaductChunk('c5', 'west', 0.36),
            createVocalSanctuaryChunk(
              'gate2',
              anchorIds[anchorIds.length - 1]!,
              'east',
              gate2Opts,
            ),
            createFinalePavilionChunk('c-fin'),
          ]
      }
    })()

    if (lessonProfileId === 'sunlit-steps-v1') {
      // Insert 2 additional vocal sanctuaries before the final sanctuary for the 5-station lesson
      const lastSanctuaryIdx = baseChunks.findLastIndex(
        (c) => c.kind === 'vocal-sanctuary',
      )
      const extraChunks: ProceduralChunk[] = [
        createVocalSanctuaryChunk('gate-mid1', 'sunlit-steps-four', 'none', {
          barrierProfileId: 'frost-gold-arch-breakwall-a',
        }),
        createHexCascadeChunk('c-mid1', hexWarningTime),
        createVocalSanctuaryChunk('gate-mid2', 'sunlit-steps-back-two', 'none', {
          barrierProfileId: 'frosted-scroll-wall',
          ...(includeOptionalAlcoves
            ? {
                optionalAlcove: {
                  variant: 'coupe',
                  label: 'The Sunlit Coupe',
                  coinId: `proc-${seedSlug}-coin-alcove-2`,
                },
              }
            : {}),
        }),
        createAuroraGlideChunk('c-mid2'),
      ]
      return [
        ...baseChunks.slice(0, lastSanctuaryIdx),
        ...extraChunks,
        ...baseChunks.slice(lastSanctuaryIdx),
      ]
    }

    return baseChunks
  }

  const startTopologyIdx = prng.int(0, topologies.length - 1)
  let chunks = buildTopologyChunks(topologies[startTopologyIdx]!)
  let assembled = stitchChunks(chunks)

  // Spatial self-avoidance guard: if a candidate layout has any 2D overlap, cycle topologies
  for (
    let attempt = 1;
    attempt < topologies.length &&
    hasAssembledPlatformOverlap(assembled.platforms);
    attempt++
  ) {
    const candidateTopology =
      topologies[(startTopologyIdx + attempt) % topologies.length]!
    chunks = buildTopologyChunks(candidateTopology)
    assembled = stitchChunks(chunks)
  }

  // Dynamically locate required melodic stations and finale
  const melodicEncounters = assembled.encounters.filter(
    (e) => e.role === 'note' || e.role === 'gate',
  )
  const finaleEncounter = assembled.encounters.find(
    (e) => e.role === 'finale',
  )!
  const finaleEncounterId = finaleEncounter.id

  // Melody lesson stations
  const lessonId = `proc-lesson-${seedSlug}`
  const stations = melodicEncounters.map((e, idx) => ({
    encounterId: e.id,
    anchorId: e.noteAnchorId ?? anchorIds[idx]!,
  }))

  // Format encounters for schema 4
  const formattedEncounters = assembled.encounters.map((e) => {
    if (e.role === 'note') {
      return {
        id: e.id,
        label: e.label,
        variant: e.variant,
        position: e.position,
        anchor: e.anchor,
        optional: false,
        challenge: {
          profileId: 'melody-anchor',
          lessonId,
          reference: 'anchor-tone',
          anchorId: e.noteAnchorId!,
        },
        requiresCompleted: e.requiresCompleted,
      }
    }
    if (e.role === 'gate') {
      return {
        id: e.id,
        label: e.label,
        variant: e.variant,
        position: e.position,
        anchor: e.anchor,
        optional: false,
        challenge: {
          profileId: 'melody-anchor',
          lessonId,
          reference: 'anchor-tone',
          anchorId: e.noteAnchorId!,
        },
        requiresCompleted: e.requiresCompleted,
        presentation: {
          kind: 'barrier',
          profileId: e.presentationBarrier!.profileId,
          facingYaw: e.presentationBarrier!.facingYaw,
        },
      }
    }
    if (e.role === 'optional-discovery') {
      return {
        id: e.id,
        label: e.label,
        variant: e.variant,
        position: e.position,
        anchor: e.anchor,
        optional: true,
        challenge: {
          profileId: 'comfortable-hold',
        },
        requiresCompleted: e.requiresCompleted,
      }
    }
    // Finale
    return {
      id: e.id,
      label: e.label,
      variant: e.variant,
      position: e.position,
      anchor: e.anchor,
      optional: false,
      challenge: {
        profileId: 'melody-contour',
        lessonId,
        reference: 'whole-melody',
      },
      requiresCompleted: e.requiresCompleted,
    }
  })

  // Optional discovery reward coins
  const optionalDiscoveries = assembled.encounters
    .filter(
      (e) =>
        e.role === 'optional-discovery' &&
        e.discoveryCoinIds !== undefined &&
        e.discoveryCoinIds.length > 0,
    )
    .map((e) => ({
      encounterId: e.id,
      coinIds: [...e.discoveryCoinIds!],
    }))

  // Format platforms for schema 4
  const formattedPlatforms = assembled.platforms.map((p) => {
    const entry: Record<string, unknown> = {
      id: p.id,
      profileId: p.profileId,
      center: p.center,
      quarterTurns: p.quarterTurns,
    }
    if (p.behavior) {
      entry.behavior = p.behavior
    }
    return entry
  })

  // Camera configuration — partitioned into balanced sections ensuring distinct look centres
  const platformIds = assembled.platforms.map((p) => p.id)
  const sectionTargetSize = Math.max(4, Math.floor(platformIds.length / 4))
  const cameraSections: {
    id: string
    platformIds: string[]
    lookFromPlatformId: string
    lookToPlatformId: string
  }[] = []

  let start = 0
  let secIdx = 1
  while (start < platformIds.length) {
    const end = Math.min(platformIds.length, start + sectionTargetSize)
    const remaining = platformIds.length - end
    const effectiveEnd = remaining <= 2 ? platformIds.length : end
    const secPlatforms = platformIds.slice(start, effectiveEnd)
    cameraSections.push({
      id: `proc-cam-sec-${secIdx}`,
      platformIds: secPlatforms,
      lookFromPlatformId: secPlatforms[0]!,
      lookToPlatformId: secPlatforms[secPlatforms.length - 1]!,
    })
    secIdx++
    start = effectiveEnd
  }

  // Exit bounds at the finale platform
  const lastPlat = assembled.platforms[assembled.platforms.length - 1]!
  const exitBounds = assembled.exitBounds
    ? {
        ...assembled.exitBounds,
        requiresCompleted: [finaleEncounterId],
      }
    : {
        minX: Number((lastPlat.center.x - 0.8).toFixed(3)),
        maxX: Number((lastPlat.center.x + 0.8).toFixed(3)),
        minZ: Number((lastPlat.center.z - 0.18).toFixed(3)),
        maxZ: Number((lastPlat.center.z + 0.18).toFixed(3)),
        top: lastPlat.center.y,
        requiresCompleted: [finaleEncounterId],
      }

  // Crystal interiors across all gilt-scroll platforms in the course
  const crystalInteriors = assembled.platforms
    .filter((p) => p.crystalInterior !== undefined)
    .slice(0, 16)
    .map((p) => ({
      platformId: p.id,
      preset: p.crystalInterior!.preset,
      seed: p.crystalInterior!.seed,
    }))

  const courseSource: Record<string, unknown> = {
    id: courseId,
    title,
    authored: {
      levelId: courseId,
      layoutId: `proc-layout-${seedSlug}`,
      contentRevision: 1,
    },
    movement: {
      walkSpeed: 1.65,
      runSpeed: 2.6,
      runDelaySeconds: 0.65,
      runRampSeconds: 0.85,
    },
    guidance: {
      subtitle: 'A procedurally orchestrated 3D causeway of glass and song',
      openingNotice:
        'Listen to the root tone, then ascend across frost, crystal and cloud.',
      completionTitle: 'The awakened arch rings in full harmony.',
      completionNext: 'Your resonance echoes through the museum.',
    },
    spawn: {
      position: { x: 0, y: 0, z: 0 },
      facingYaw: Math.PI,
      checkpointId: assembled.checkpoints[0]!.id,
    },
    platforms: formattedPlatforms,
    gaps: [],
    checkpoints: assembled.checkpoints,
    encounters: formattedEncounters,
    ...(optionalDiscoveries.length > 0
      ? {
          rewards: {
            revision: 1,
            discoveries: optionalDiscoveries,
          },
        }
      : {}),
    melodyLesson: {
      profileId: lessonProfileId,
      id: lessonId,
      revision: 1,
      defaultPace: 1.25,
      comfortableOffsetSemitones: 2,
      stations,
      finaleEncounterId,
    },
    camera: {
      initialSectionId: cameraSections[0]!.id,
      landingDwellSeconds: 0.75,
      sections: cameraSections,
    },
    exit: exitBounds,
    fallBelow: Math.min(-4.0, assembled.bounds.minY + 1),
    presentation: {
      worldBounds: assembled.bounds,
      lightBounds: {
        minX: assembled.bounds.minX + 2,
        maxX: assembled.bounds.maxX - 2,
        minY: assembled.bounds.minY + 3,
        maxY: assembled.bounds.maxY - 2,
        minZ: assembled.bounds.minZ + 2,
        maxZ: assembled.bounds.maxZ - 2,
      },
      audioSceneId: 'garden',
      fog: {
        kind: 'linear',
        nearMeters: fog.nearMeters,
        farMeters: fog.farMeters,
      },
      crystalInteriors,
    },
  }

  const rawDocument = {
    schema: 'mercurypitch.cloudway-course',
    schemaVersion: 4,
    courses: [courseSource],
  }

  // Compile through the authoritative compiler to certify validity
  const compiledLevels = compileCloudwayCourseDocument(
    rawDocument,
    CLOUDWAY_STUDIO_PROFILES,
  )
  const compiledLevel = compiledLevels[0]
  if (!compiledLevel) {
    throw new Error(`Failed to compile generated course: ${courseId}`)
  }

  return {
    courseId,
    title,
    rawDocument,
    compiledLevel,
  }
}
