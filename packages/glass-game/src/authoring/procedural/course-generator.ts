// Procedural Cloudway course generator — assembles bounded modular candidates and validates their authored structure.

import type { LevelDefinition } from '../../contracts.ts'
import { CLOUDWAY_STUDIO_PROFILES, compileStudioDocument, } from '../cloudway-studio.ts'
import type { AssembledGapClassification } from './chunk-gaps.ts'
import { classifyAssembledCourseGaps } from './chunk-gaps.ts'
import type { AssembledGeometryIssue } from './chunk-geometry.ts'
import { getAssembledGeometryIssues } from './chunk-geometry.ts'
import type { VocalSanctuaryOptions } from './chunk-library.ts'
import { createArrivalChunk, createFinalePavilionChunk, createVocalSanctuaryChunk, } from './chunk-library.ts'
import { buildAssembledCourseGaps, stitchChunks } from './chunk-stitcher.ts'
import type { ProceduralChunk, ProceduralGeneratorOptions, } from './contracts.ts'
import { buildActCandidates } from './course-candidates.ts'
import { getProceduralCourseIdentity, normalizeProceduralCourseOptions, } from './course-options.ts'
import { searchCompleteCourse } from './course-search.ts'
import { ProceduralPrng } from './prng.ts'

export interface GeneratedCourseResult {
  readonly courseId: string
  readonly title: string
  readonly rawDocument: Record<string, unknown>
  readonly compiledLevel: LevelDefinition
  readonly geometryIssues: readonly AssembledGeometryIssue[]
  readonly routeConnections: readonly AssembledGapClassification[]
}

function sanitizeIdSegment(raw: string | number): string {
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'seed'
}

export function generateProceduralCourse(
  input: ProceduralGeneratorOptions,
): GeneratedCourseResult {
  const options = normalizeProceduralCourseOptions(input)
  const prng = new ProceduralPrng(options.seed)
  const seedSlug = sanitizeIdSegment(options.seed)
  const courseId = getProceduralCourseIdentity(options)

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
  const generatedTitle = prng.pick(titleTemplates)
  const title = options.title ?? generatedTitle
  const lessonProfileId = options.melodyLessonId
  const includeOptionalAlcoves = options.includeOptionalAlcoves

  // Fog themes (farMeters must be <= 30m)
  const fogThemes = {
    dawn: { nearMeters: 8, farMeters: 24 },
    celestial: { nearMeters: 10, farMeters: 28 },
    aurora: { nearMeters: 6, farMeters: 22 },
    twilight: { nearMeters: 12, farMeters: 30 },
  }
  const fogKey = options.fogTheme
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
  const diff = options.difficulty
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
  if (lessonProfile === undefined) {
    throw new Error('The selected melody lesson is unavailable.')
  }
  const melodyAnchors = lessonProfile.melody.phrases.flatMap(
    (phrase) => phrase.anchors,
  )
  if (melodyAnchors.length < 2) {
    throw new Error('A generated course needs at least two melody stations.')
  }

  const totalTransitions = melodyAnchors.length - 1

  const baseSeedOffset = prng.int(0, 999)

  function* candidateActs(
    committedChunks: readonly ProceduralChunk[],
    stepIndex: number,
  ): Generator<readonly ProceduralChunk[]> {
    const candidates = buildActCandidates({
      stepIndex,
      melodyAnchors,
      crystalPreset,
      secondaryCrystalPreset,
      hexWarningTime,
    })
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

        yield nextChunks
      }
    }
  }

  const chunks = searchCompleteCourse<readonly ProceduralChunk[]>({
    initial: [createArrivalChunk(melodyAnchors[0]!.id)],
    steps: totalTransitions,
    candidates: candidateActs,
    isValid: (candidate, step) => {
      const stitched = stitchChunks(candidate)
      if (
        getAssembledGeometryIssues(stitched).some(
          (issue) => issue.severity === 'error',
        )
      )
        return false
      if (step !== totalTransitions) return true
      const xs = stitched.platforms.map((p) => p.center.x)
      const ys = stitched.platforms.map((p) => p.center.y)
      const zs = stitched.platforms.map((p) => p.center.z)
      return (
        Math.max(...xs) - Math.min(...xs) >= 6 &&
        Math.max(...zs) - Math.min(...zs) >= 12 &&
        Math.max(...ys) - Math.min(...ys) >= 0.5
      )
    },
  })

  const assembled = stitchChunks(chunks)

  // Dynamically locate required melodic stations and finale
  const melodicEncounters = assembled.encounters.filter(
    (e) => e.role === 'note' || e.role === 'gate',
  )
  const finaleEncounter = assembled.encounters.find((e) => e.role === 'finale')
  if (
    finaleEncounter === undefined ||
    assembled.exitBounds === undefined ||
    assembled.checkpoints.length === 0 ||
    assembled.cameraSections.length === 0 ||
    melodicEncounters.length !== melodyAnchors.length ||
    melodicEncounters.some(
      (encounter, index) => encounter.noteAnchorId !== melodyAnchors[index]?.id,
    )
  ) {
    throw new Error('The generated course is incomplete. Try another seed.')
  }
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

  const exitBounds = {
    ...assembled.exitBounds,
    requiresCompleted: [finaleEncounterId],
  }

  // Crystal interiors across all gilt-scroll platforms in the course
  const crystalInteriors = assembled.platforms
    .filter(
      (p) => options.includeLivingCrystals && p.crystalInterior !== undefined,
    )
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
    gaps: buildAssembledCourseGaps(assembled),
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

  // The compiler validates structure and declared gaps; this is not a gameplay certificate.
  const compiledLevels = compileStudioDocument(rawDocument)
  const compiledLevel = compiledLevels[0]
  if (compiledLevel === undefined) {
    throw new Error(`Failed to compile generated course: ${courseId}`)
  }

  return {
    courseId,
    title,
    rawDocument,
    compiledLevel,
    geometryIssues: getAssembledGeometryIssues(assembled),
    routeConnections: classifyAssembledCourseGaps(assembled),
  }
}
