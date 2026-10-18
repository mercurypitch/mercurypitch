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

  const lessonProfile =
    CLOUDWAY_STUDIO_PROFILES.melodyLessons?.[lessonProfileId]
  const melodyAnchors = lessonProfile
    ? lessonProfile.melody.phrases.flatMap((phrase) => phrase.anchors)
    : [
        { id: 'first-arc-home', offsetSemitones: 0 },
        { id: 'first-arc-rise', offsetSemitones: 2 },
        { id: 'first-arc-return', offsetSemitones: 0 },
      ]

  const totalTransitions = melodyAnchors.length - 1

  const buildActCandidates = (
    stepIndex: number,
  ): readonly {
    readonly traversal: readonly ProceduralChunk[]
    readonly preferredTurns: readonly ('none' | 'east' | 'west')[]
  }[] => {
    const prevSemitones = melodyAnchors[stepIndex - 1]!.offsetSemitones
    const currSemitones = melodyAnchors[stepIndex]!.offsetSemitones
    const semitoneDelta = currSemitones - prevSemitones
    const elevationScale = Math.max(0.8, Math.min(1.5, Math.abs(semitoneDelta) / 2))
    const tagA = `s${stepIndex}a`
    const tagB = `s${stepIndex}b`
    const tagC = `s${stepIndex}c`
    const preset =
      stepIndex % 2 === 1 ? crystalPreset : secondaryCrystalPreset

    // Final act (Ketsu): always includes a living-crystal/crossroads or fork + a moving 3D ferry
    if (stepIndex === totalTransitions) {
      return [
        {
          traversal: [
            createCrystalCrossroadsChunk(tagA, preset, hexWarningTime),
            createSkyElevatorGlideChunk(tagB, 0.56),
            createCascadingDropChunk(tagC, 'west', hexWarningTime),
          ],
          preferredTurns: ['none', 'east', 'west'],
        },
        {
          traversal: [
            createCrystalCrossroadsChunk(tagA, preset, hexWarningTime),
            createArcedViaductChunk(tagB, 'west', hexWarningTime, 0.36),
            createDiagonalGlideChunk(tagC, 'left-to-right'),
          ],
          preferredTurns: ['east', 'west', 'none'],
        },
        {
          traversal: [
            createSlalomZigzagChunk(tagA, 'frost'),
            createScrollBridgeChunk(tagB, preset),
            createArcedViaductChunk(tagC, 'east', hexWarningTime, 0.36),
            createDiagonalGlideChunk(`s${stepIndex}d`, 'right-to-left'),
          ],
          preferredTurns: ['west', 'east', 'none'],
        },
        {
          traversal: [
            createTerracedAscentChunk(tagA, hexWarningTime),
            createSplitForkChunk(tagB),
            createSkyElevatorGlideChunk(tagC, 0.56),
          ],
          preferredTurns: ['east', 'none', 'west'],
        },
        {
          traversal: [
            createScrollBridgeChunk(tagA, preset),
            createCascadingDropChunk(tagB, 'west', hexWarningTime),
            createSkyElevatorGlideChunk(tagC, 0.56),
            createSlalomZigzagChunk(`s${stepIndex}d`, 'frost'),
          ],
          preferredTurns: ['none', 'east', 'west'],
        },
        {
          traversal: [
            createViaductSCurveChunk(tagA),
            createTerracedAscentChunk(tagB, hexWarningTime),
            createDiagonalGlideChunk(tagC, 'left-to-right'),
          ],
          preferredTurns: ['west', 'none', 'east'],
        },
        {
          traversal: [
            createSplitForkChunk(tagA),
            createCrystalCrossroadsChunk(tagB, preset, hexWarningTime),
            createDiagonalGlideChunk(tagC, 'right-to-left'),
          ],
          preferredTurns: ['west', 'east', 'none'],
        },
        {
          traversal: [
            createTerracedAscentChunk(tagA, hexWarningTime),
            createScrollBridgeChunk(tagB, preset),
            createArcedViaductChunk(tagC, 'west', hexWarningTime, 0.36),
            createAuroraGlideChunk(`s${stepIndex}d`),
          ],
          preferredTurns: ['east', 'none', 'west'],
        },
      ]
    }

    // Opening or ascending act (Ki / Sho): pitch rises -> physical elevation rises
    if (semitoneDelta >= 0) {
      const climbDelta = Number((0.36 * elevationScale).toFixed(2))
      return [
        {
          traversal: [
            createTerracedAscentChunk(tagA, hexWarningTime),
            createArcedViaductChunk(tagB, 'east', hexWarningTime, climbDelta),
          ],
          preferredTurns: ['none', 'east', 'west'],
        },
        {
          traversal: [
            createArcedViaductChunk(tagA, 'east', hexWarningTime, climbDelta),
            createSlalomZigzagChunk(tagB, 'hybrid', hexWarningTime),
          ],
          preferredTurns: ['none', 'west', 'east'],
        },
        {
          traversal: [
            createViaductSCurveChunk(tagA),
            createTerracedAscentChunk(tagB, hexWarningTime),
          ],
          preferredTurns: ['west', 'east', 'none'],
        },
        {
          traversal: [
            createSlalomZigzagChunk(tagA, 'hybrid', hexWarningTime),
            createScrollBridgeChunk(tagB, preset),
          ],
          preferredTurns: ['east', 'west', 'none'],
        },
        {
          traversal: [
            createCrystalCrossroadsChunk(tagA, preset, hexWarningTime),
          ],
          preferredTurns: ['east', 'west', 'none'],
        },
        {
          traversal: [
            createArcedViaductChunk(tagA, 'west', hexWarningTime, climbDelta),
            createScrollBridgeChunk(tagB, preset),
          ],
          preferredTurns: ['east', 'none', 'west'],
        },
        {
          traversal: [
            createFrostGlissadeChunk(tagA),
            createTerracedAscentChunk(tagB, hexWarningTime),
          ],
          preferredTurns: ['east', 'west', 'none'],
        },
        {
          traversal: [
            createSkyElevatorGlideChunk(tagA, 0.56),
            createCascadingDropChunk(tagB, 'east', hexWarningTime),
          ],
          preferredTurns: ['none', 'west', 'east'],
        },
      ]
    }

    // Intermediate descending act (Ten): melody steps downward -> cascading drops & relief bridges
    return [
      {
        traversal: [
          createCascadingDropChunk(tagA, 'east', hexWarningTime),
          createScrollBridgeChunk(tagB, preset),
        ],
        preferredTurns: ['none', 'west', 'east'],
      },
      {
        traversal: [
          createCascadingDropChunk(tagA, 'west', hexWarningTime),
          createHexCascadeChunk(tagB, hexWarningTime),
        ],
        preferredTurns: ['none', 'east', 'west'],
      },
      {
        traversal: [
          createArcedViaductChunk(tagA, 'east', hexWarningTime, -0.3),
          createFrostGlissadeChunk(tagB),
        ],
        preferredTurns: ['west', 'none', 'east'],
      },
      {
        traversal: [
          createArcedViaductChunk(tagA, 'west', hexWarningTime, -0.3),
          createCrystalCrossroadsChunk(tagB, preset, hexWarningTime),
        ],
        preferredTurns: ['east', 'none', 'west'],
      },
    ]
  }

  const baseSeedOffset = prng.int(0, 999)

  const searchActs = (
    stepIndex: number,
    committedChunks: readonly ProceduralChunk[],
  ): ProceduralChunk[] | null => {
    if (stepIndex > totalTransitions) {
      return [...committedChunks]
    }

    const candidates = buildActCandidates(stepIndex)
    const anchor = melodyAnchors[stepIndex]!
    const isFirstSanctuary = stepIndex === 1
    const isFinalSanctuary = stepIndex === totalTransitions
    const isMidAlcoveSanctuary =
      totalTransitions >= 3 && stepIndex === Math.ceil(totalTransitions / 2) + 1

    const barrierProfileId = isFinalSanctuary
      ? 'frost-gold-arch-breakwall-a'
      : isFirstSanctuary
        ? 'frosted-scroll-wall'
        : stepIndex % 2 === 0
          ? 'frost-gold-arch-breakwall-a'
          : 'frosted-scroll-wall'

    const sanctuaryOptions: VocalSanctuaryOptions = {
      barrierProfileId,
      ...(includeOptionalAlcoves && isFirstSanctuary
        ? {
            optionalAlcove: {
              variant: 'goblet',
              label: 'The Whispering Goblet',
              coinId: `proc-${seedSlug}-coin-alcove-1`,
            },
          }
        : includeOptionalAlcoves && isMidAlcoveSanctuary
          ? {
              optionalAlcove: {
                variant: 'coupe',
                label: 'The Sunlit Coupe',
                coinId: `proc-${seedSlug}-coin-alcove-2`,
              },
            }
          : {}),
    }

    const startCandidateIdx =
      (baseSeedOffset + stepIndex * 3) % candidates.length

    for (let cAttempt = 0; cAttempt < candidates.length; cAttempt++) {
      const candidate =
        candidates[(startCandidateIdx + cAttempt) % candidates.length]!

      for (const turn of candidate.preferredTurns) {
        const sanctuaryChunk = createVocalSanctuaryChunk(
          `gate${stepIndex}`,
          anchor.id,
          turn,
          sanctuaryOptions,
        )
        const nextChunks: ProceduralChunk[] = [
          ...committedChunks,
          ...candidate.traversal,
          sanctuaryChunk,
          ...(isFinalSanctuary ? [createFinalePavilionChunk('c-fin')] : []),
        ]

        const stitched = stitchChunks(nextChunks)
        if (hasAssembledPlatformOverlap(stitched.platforms)) {
          continue
        }

        if (isFinalSanctuary) {
          const xs = stitched.platforms.map((p) => p.center.x)
          const ys = stitched.platforms.map((p) => p.center.y)
          const zs = stitched.platforms.map((p) => p.center.z)
          const spanX = Math.max(...xs) - Math.min(...xs)
          const spanY = Math.max(...ys) - Math.min(...ys)
          const spanZ = Math.max(...zs) - Math.min(...zs)
          if (spanX < 6.0 || spanZ < 12.0 || spanY < 0.5) {
            continue
          }
        }

        const completed = searchActs(stepIndex + 1, nextChunks)
        if (completed !== null) {
          return completed
        }
      }
    }

    return null
  }

  const initialChunks: ProceduralChunk[] = [
    createArrivalChunk(melodyAnchors[0]!.id),
  ]
  const chunks =
    searchActs(1, initialChunks) ?? [
      createArrivalChunk(melodyAnchors[0]!.id),
      createTerracedAscentChunk('c2a', hexWarningTime),
      createArcedViaductChunk('c2b', 'east', 0.36),
      createVocalSanctuaryChunk(
        'gate1',
        melodyAnchors[1]!.id,
        'none',
        {
          barrierProfileId: 'frosted-scroll-wall',
        },
      ),
      createCrystalCrossroadsChunk('c4a', crystalPreset, hexWarningTime),
      createSkyElevatorGlideChunk('c4b', 0.56),
      createCascadingDropChunk('c5', 'west', hexWarningTime),
      createVocalSanctuaryChunk(
        'gate2',
        melodyAnchors[melodyAnchors.length - 1]!.id,
        'none',
        {
          barrierProfileId: 'frost-gold-arch-breakwall-a',
        },
      ),
      createFinalePavilionChunk('c-fin'),
    ]

  const assembled = stitchChunks(chunks)

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
    anchorId: e.noteAnchorId ?? melodyAnchors[idx]!.id,
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

  // Chunk-aligned camera sections from stitchChunks
  const cameraSections = assembled.cameraSections.map((cs) => ({
    id: cs.id,
    platformIds: [...cs.platformIds],
    lookFromPlatformId: cs.lookFromPlatformId,
    lookToPlatformId: cs.lookToPlatformId,
  }))

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
