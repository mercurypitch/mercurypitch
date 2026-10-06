// Procedural Cloudway course generator — compiles Kishōtenketsu modular courses from certified chunks.

import { CLOUDWAY_STUDIO_PROFILES } from '../cloudway-studio.ts'
import { compileCloudwayCourseDocument } from '../compile-cloudway-course.ts'
import type { LevelDefinition } from '../../contracts.ts'
import {
  createArrivalChunk,
  createAuroraGlideChunk,
  createFinalePavilionChunk,
  createFrostGlissadeChunk,
  createHexCascadeChunk,
  createScrollBridgeChunk,
  createVocalSanctuaryChunk,
} from './chunk-library.ts'
import { stitchChunks } from './chunk-stitcher.ts'
import type { ProceduralChunk, ProceduralGeneratorOptions } from './contracts.ts'
import { ProceduralPrng } from './prng.ts'

export interface GeneratedCourseResult {
  readonly courseId: string
  readonly title: string
  readonly rawDocument: Record<string, unknown>
  readonly compiledLevel: LevelDefinition
}

export function generateProceduralCourse(
  options: ProceduralGeneratorOptions,
): GeneratedCourseResult {
  const prng = new ProceduralPrng(options.seed)
  const courseId = options.courseId ?? `cloudway-procedural-${prng.int(1000, 9999)}`
  
  const titleTemplates = [
    `The Resonant Causeway ${options.seed}`,
    `The Celestial Glissade ${options.seed}`,
    `The Prismatic Ascent ${options.seed}`,
    `The Frostbound Echoes ${options.seed}`,
    `The Aureate Expanse ${options.seed}`,
    `The Starlight Ribbon ${options.seed}`,
  ]
  const title = options.title ?? prng.pick(titleTemplates)
  const lessonProfileId = options.melodyLessonId ?? 'first-arc-v1'

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

  // Select crystal preset
  const crystalPresets = ['aurora-heart', 'resonance-veins', 'frost-roots'] as const
  const crystalPreset = prng.pick(crystalPresets)

  // Difficulty-informed mechanics timing
  const diff = options.difficulty ?? 'balanced'
  const hexWarningTime =
    diff === 'virtuoso'
      ? prng.range(0.9, 1.1)
      : diff === 'gentle'
        ? prng.range(1.8, 2.2)
        : prng.range(1.3, 1.6)

  // Topological archetypes:
  // 'east-hook': Sanctuary 1 turns East, Sanctuary 2 turns East (relative right -> headings: N -> E -> S)
  // 'west-hook': Sanctuary 1 turns West, Sanctuary 2 turns West (relative left -> headings: N -> W -> S)
  // 's-curve': Sanctuary 1 turns East, Sanctuary 2 turns West (relative right then left -> headings: N -> E -> N)
  // 'straight': Sanctuary 1 turns None, Sanctuary 2 turns None (headings: N -> N -> N)
  const topologies = ['east-hook', 'west-hook', 's-curve', 'straight'] as const
  const topology = prng.pick(topologies)

  const turn1: 'none' | 'east' | 'west' =
    topology === 'straight' ? 'none' : topology === 'west-hook' ? 'west' : 'east'

  const turn2: 'none' | 'east' | 'west' =
    topology === 'straight'
      ? 'none'
      : topology === 's-curve'
        ? 'west'
        : topology === 'west-hook'
          ? 'west'
          : 'east'

  // Act 2 (Shō / Agility Introduction)
  const act2Choices = ['frost', 'hex', 'scroll'] as const
  const act2Type = prng.pick(act2Choices)
  const act2Chunk =
    act2Type === 'frost'
      ? createFrostGlissadeChunk('c2')
      : act2Type === 'hex'
        ? createHexCascadeChunk('c2', Number((hexWarningTime + 0.3).toFixed(2)))
        : createScrollBridgeChunk('c2', crystalPreset)

  // Act 4 (Ten / Tension Escalation)
  const act4Variants = [0, 1, 2] as const
  const act4Variant = prng.pick(act4Variants)
  const act4Chunks: ProceduralChunk[] =
    act4Variant === 0
      ? [
          createHexCascadeChunk('c4', Number(hexWarningTime.toFixed(2))),
          createScrollBridgeChunk('c5', crystalPreset),
        ]
      : act4Variant === 1
        ? [
            createScrollBridgeChunk('c4', crystalPreset),
            createHexCascadeChunk('c5', Number(hexWarningTime.toFixed(2))),
          ]
        : [
            createFrostGlissadeChunk('c4'),
            createHexCascadeChunk('c5', Number(hexWarningTime.toFixed(2))),
          ]

  // Act 5 (Ten / Chasm Climax with Kinematic Ferry Raft)
  const act5Chunk = createAuroraGlideChunk('c6')

  // Chunk sequence implementing Kishōtenketsu macro progression:
  // Act 1 (Ki / Arrival): Arrival Court with Opening Home Tone
  // Act 2 (Shō / Agility): Introductory agility
  // Act 3 (Shō / Gate 1): First Sanctuary with Vocal Gate
  // Act 4 (Ten / Tension): Multi-mechanic challenge
  // Act 5 (Ten / Chasm): Chasm traverse
  // Act 6 (Ketsu / Return Gate): Second Sanctuary with Vocal Gate
  // Act 7 (Ketsu / Finale): Awakened Muse Whole-Phrase Pavilion + Exit Portal
  const chunks: ProceduralChunk[] = [
    createArrivalChunk('first-arc-home'),
    act2Chunk,
    createVocalSanctuaryChunk('gate1', 'first-arc-rise', turn1),
    ...act4Chunks,
    act5Chunk,
    createVocalSanctuaryChunk('gate2', 'first-arc-return', turn2),
    createFinalePavilionChunk('c_fin'),
  ]

  const assembled = stitchChunks(chunks)

  // Dynamically locate gates and finale
  const gate1ChunkIndex = chunks.findIndex((c) => c.kind === 'vocal-sanctuary')
  const gate2ChunkIndex = chunks.findLastIndex((c) => c.kind === 'vocal-sanctuary')
  const finaleChunkIndex = chunks.findIndex((c) => c.kind === 'finale')

  const gate1EncounterId = `proc-c${gate1ChunkIndex + 1}-gate-gate1`
  const gate2EncounterId = `proc-c${gate2ChunkIndex + 1}-gate-gate2`
  const finaleEncounterId = `proc-c${finaleChunkIndex + 1}-portrait-finale-c_fin`

  // Melody lesson stations
  const lessonId = `proc-lesson-${options.seed}`
  const stations = [
    { encounterId: 'proc-c1-note-home', anchorId: 'first-arc-home' },
    { encounterId: gate1EncounterId, anchorId: 'first-arc-rise' },
    { encounterId: gate2EncounterId, anchorId: 'first-arc-return' },
  ]

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
      lookFromPlatformId: secPlatforms[0],
      lookToPlatformId: secPlatforms[secPlatforms.length - 1],
    })
    secIdx++
    start = effectiveEnd
  }

  // Exit bounds at the finale platform
  const lastPlat = assembled.platforms[assembled.platforms.length - 1]
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
        top: 0,
        requiresCompleted: [finaleEncounterId],
      }

  // Crystal interiors
  const scrollPlatform = assembled.platforms.find((p) => p.crystalInterior)
  const crystalInteriors = scrollPlatform
    ? [
        {
          platformId: scrollPlatform.id,
          preset: scrollPlatform.crystalInterior!.preset,
          seed: scrollPlatform.crystalInterior!.seed,
        },
      ]
    : []

  const courseSource = {
    id: courseId,
    title,
    authored: {
      levelId: courseId,
      layoutId: `proc-layout-${options.seed}`,
      contentRevision: 1,
    },
    movement: {
      walkSpeed: 1.65,
      runSpeed: 2.6,
      runDelaySeconds: 0.65,
      runRampSeconds: 0.85,
    },
    guidance: {
      subtitle: 'A procedurally orchestrated causeway of glass and song',
      openingNotice: 'Listen to the root tone, then tread across frost, crystal and cloud.',
      completionTitle: 'The awakened arch rings in full harmony.',
      completionNext: 'Your resonance echoes through the museum.',
    },
    spawn: {
      position: { x: 0, y: 0, z: 0 },
      facingYaw: Math.PI,
      checkpointId: assembled.checkpoints[0].id,
    },
    platforms: formattedPlatforms,
    gaps: [],
    checkpoints: assembled.checkpoints,
    encounters: formattedEncounters,
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
      initialSectionId: cameraSections[0].id,
      landingDwellSeconds: 0.75,
      sections: cameraSections,
    },
    exit: exitBounds,
    fallBelow: -4.0,
    presentation: {
      worldBounds: assembled.bounds,
      lightBounds: {
        minX: assembled.bounds.minX + 2,
        maxX: assembled.bounds.maxX - 2,
        minY: -1,
        maxY: 6,
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
  const compiledLevels = compileCloudwayCourseDocument(rawDocument, CLOUDWAY_STUDIO_PROFILES)
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
