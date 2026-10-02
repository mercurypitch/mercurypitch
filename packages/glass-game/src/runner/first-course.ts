// ============================================================
// The Singing Current — one stable course structure compiled from typed tuning.
// ============================================================

import { compileSongRunnerCourseDocument } from './compile-course.ts'
import type { SingingCurrentTuning } from './first-course-tuning.ts'
import { SINGING_CURRENT_CURRENT_TUNING, SINGING_CURRENT_LEARNING_TUNING, SINGING_CURRENT_RESPONSIVE_TUNING, } from './first-course-tuning.ts'
import type { SongRunnerCourseCatalog, SongRunnerCourseSource, SongRunnerSourceDocument, } from './source.ts'

interface SingingCurrentIdentity {
  readonly id: string
  readonly revision: number
}

function buildSingingCurrent(
  identity: SingingCurrentIdentity,
  tuning: SingingCurrentTuning,
) {
  const laneCenters = tuning.track.laneCenters ?? ([-2, 0, 2] as const)
  const compact = laneCenters[2] - laneCenters[0] < 4
  const gapLaneHalfWidth = (laneCenters[2] - laneCenters[0]) / 4
  const blockerHalfWidth = compact ? 0.5 : 0.78
  const firstGapLength = tuning.obstacles.firstJump.lengthMeters ?? 0.9
  const secondGapLength = tuning.obstacles.secondJump.lengthMeters ?? 1.05
  const completion = (noteCount: number) =>
    tuning.charge === undefined
      ? {}
      : {
          completion: {
            kind: 'charge' as const,
            minimumReliableSecondsPerNote: Array.from(
              { length: noteCount },
              () =>
                noteCount === 1
                  ? tuning.charge!.singleHoldSeconds
                  : tuning.charge!.phraseHoldSeconds,
            ),
            previewDurationSeconds:
              tuning.charge.previewDurationSeconds * noteCount,
            contactAfterResponseSeconds:
              tuning.charge.contactAfterResponseSeconds,
          },
        }
  const catalog = {
    movementProfiles: {
      'runner-beginner-v1': {
        id: 'runner-beginner-v1',
        revision: 1,
        fixedStepSeconds: 1 / 120,
        maxCatchUpSeconds: 0.25,
        laneChangeSeconds: tuning.movement.laneChangeSeconds,
        bodyRadius: tuning.movement.bodyRadius ?? 0.22,
        bodyHeight: tuning.movement.bodyHeight ?? 0.7,
        jumpVelocityMetersPerSecond:
          tuning.movement.jumpVelocityMetersPerSecond,
        gravityMetersPerSecondSquared:
          tuning.movement.gravityMetersPerSecondSquared,
        maxJumpRiseMeters: tuning.movement.maxJumpRiseMeters,
        coyoteSeconds: tuning.movement.coyoteSeconds,
        jumpBufferSeconds: tuning.movement.jumpBufferSeconds,
      },
    },
    voiceProfiles: {
      'runner-relative-pitch-v1': {
        voice: {
          id: 'runner-relative-pitch-v1',
          revision: 1,
          comfortableRootOffsetSemitones: 0,
          minimumComfortableMidi: 48,
          maximumComfortableMidi: 76,
          judge: {
            id: 'runner-capture-window-v1',
            revision: 1,
            evidenceVersion: 'pitch-accuracy-v1',
            minimumConfidence: 0.55,
            centsTolerance: 80,
            maximumEvidenceGapSeconds: 0.12,
            minimumReliableRatio: 0.52,
            maximumDeliveryLatencySeconds: 0.18,
            gradeBands: [
              { grade: 3, maximumMeanAbsoluteCents: 25 },
              { grade: 2, maximumMeanAbsoluteCents: 45 },
              { grade: 1, maximumMeanAbsoluteCents: 70 },
            ],
          },
        },
        judgeLeadBeats: tuning.voiceWindow.judgeLeadBeats,
        protectedLeadBeats: tuning.voiceWindow.protectedLeadBeats,
        protectedTailBeats: tuning.voiceWindow.protectedTailBeats,
      },
    },
    obstacleProfiles: {
      'runner-lane-gate-training-v1': {
        kind: 'blocker',
        id: 'runner-lane-gate-training-v1',
        longitudinalHalfLengthMeters: 0.35,
        laneHalfWidthMeters: blockerHalfWidth,
        minYOffsetMeters: 0,
        maxYOffsetMeters: 1.15,
        visibleLongitudinalHalfLengthMeters: 0.35,
        visibleLaneHalfWidthMeters: blockerHalfWidth,
        visibleMinYOffsetMeters: 0,
        visibleMaxYOffsetMeters: 1.15,
        telegraphLeadBeats: tuning.obstacles.firstLaneGate.telegraphLeadBeats,
        assetProfileIds: [],
      },
      'runner-gap-catch-training-v1': {
        kind: 'gap',
        id: 'runner-gap-catch-training-v1',
        lengthMeters: firstGapLength,
        laneHalfWidthMeters: gapLaneHalfWidth,
        visibleLengthMeters: firstGapLength,
        visibleLaneHalfWidthMeters: gapLaneHalfWidth,
        landingRunwayMeters: tuning.obstacles.firstJump.landingRunwayMeters,
        telegraphLeadBeats: tuning.obstacles.firstJump.telegraphLeadBeats,
        assetProfileIds: ['living-crystal-platform-v2'],
      },
      'runner-lane-gate-v1': {
        kind: 'blocker',
        id: 'runner-lane-gate-v1',
        longitudinalHalfLengthMeters: 0.4,
        laneHalfWidthMeters: blockerHalfWidth,
        minYOffsetMeters: 0,
        maxYOffsetMeters: 1.25,
        visibleLongitudinalHalfLengthMeters: 0.4,
        visibleLaneHalfWidthMeters: blockerHalfWidth,
        visibleMinYOffsetMeters: 0,
        visibleMaxYOffsetMeters: 1.25,
        telegraphLeadBeats: tuning.obstacles.secondLaneGate.telegraphLeadBeats,
        assetProfileIds: [],
      },
      'runner-gap-v1': {
        kind: 'gap',
        id: 'runner-gap-v1',
        lengthMeters: secondGapLength,
        laneHalfWidthMeters: gapLaneHalfWidth,
        visibleLengthMeters: secondGapLength,
        visibleLaneHalfWidthMeters: gapLaneHalfWidth,
        landingRunwayMeters: tuning.obstacles.secondJump.landingRunwayMeters,
        telegraphLeadBeats: tuning.obstacles.secondJump.telegraphLeadBeats,
        assetProfileIds: ['living-crystal-platform-v2'],
      },
    },
    pickupProfiles: {
      'runner-pearl-pickup-v1': {
        id: 'runner-pearl-pickup-v1',
        radiusMeters: 0.3,
        assetProfileIds: [],
      },
    },
    glassProfiles: {
      'runner-score-window-v1': {
        assetProfileIds: ['cloudway-lab-frost-gold-arch-v1'],
      },
    },
    environmentProfiles: {
      'runner-sunlit-glass-v1': {
        assetProfileIds: [
          'merc',
          'museum-sky',
          'floor-marble',
          'museum-environment-v2',
          'museum-kit-v2',
          'museum-garden-v2',
          'living-crystal-platform-v2',
          ...(compact ? ['museum-canopy-v3', 'museum-arcade-v3'] : []),
        ],
      },
    },
    musicProfileIds: ['runner-first-flight-v1'],
    notationProfileIds: ['runner-staff-glass-v1'],
  } as const satisfies SongRunnerCourseCatalog

  const source = {
    id: identity.id,
    title: 'The Singing Current',
    revision: identity.revision,
    seed: 1776,
    meter: { beatsPerBar: 4, beatUnit: 4 },
    tempoMap: tuning.tempoMap,
    track: {
      lengthBeats: 160,
      metersPerBeat: tuning.track.metersPerBeat,
      groundFeetY: 0,
      fallBelowFeetY: -3,
      laneCenters,
      spawnRunwayBeats: tuning.track.spawnRunwayBeats,
      vocalLookaheadBeats: tuning.track.vocalLookaheadBeats,
      vocalEmphasisBeats: tuning.track.vocalEmphasisBeats,
      chunkBeats: 16,
    },
    movementProfileId: 'runner-beginner-v1',
    voice: {
      profileId: 'runner-relative-pitch-v1',
      phrases: [
        {
          id: 'home-whole',
          notes: [
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.homeWhole.noteDurationsBeats[0],
            },
          ],
          breathAfterBeats: tuning.phrases.homeWhole.breathAfterBeats,
        },
        {
          id: 'higher-half',
          notes: [
            {
              offsetSemitones: 2,
              durationBeats: tuning.phrases.higherHalf.noteDurationsBeats[0],
            },
          ],
          breathAfterBeats: tuning.phrases.higherHalf.breathAfterBeats,
        },
        {
          id: 'lower-half',
          notes: [
            {
              offsetSemitones: -2,
              durationBeats: tuning.phrases.lowerHalf.noteDurationsBeats[0],
            },
          ],
          breathAfterBeats: tuning.phrases.lowerHalf.breathAfterBeats,
        },
        {
          id: 'two-up',
          notes: [
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.twoUp.noteDurationsBeats[0],
            },
            {
              offsetSemitones: 2,
              durationBeats: tuning.phrases.twoUp.noteDurationsBeats[1],
              connection: 'separate',
            },
          ],
          breathAfterBeats: tuning.phrases.twoUp.breathAfterBeats,
        },
        {
          id: 'first-arc',
          notes: [
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.firstArc.noteDurationsBeats[0],
            },
            {
              offsetSemitones: 2,
              durationBeats: tuning.phrases.firstArc.noteDurationsBeats[1],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.firstArc.noteDurationsBeats[2],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
          ],
          breathAfterBeats: tuning.phrases.firstArc.breathAfterBeats,
        },
        {
          id: 'sunlit-steps',
          notes: [
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.sunlitSteps.noteDurationsBeats[0],
            },
            {
              offsetSemitones: 2,
              durationBeats: tuning.phrases.sunlitSteps.noteDurationsBeats[1],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
            {
              offsetSemitones: 4,
              durationBeats: tuning.phrases.sunlitSteps.noteDurationsBeats[2],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
            {
              offsetSemitones: 2,
              durationBeats: tuning.phrases.sunlitSteps.noteDurationsBeats[3],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
            {
              offsetSemitones: 0,
              durationBeats: tuning.phrases.sunlitSteps.noteDurationsBeats[4],
              connection: tuning.charge === undefined ? 'glide' : 'separate',
            },
          ],
          breathAfterBeats: tuning.phrases.sunlitSteps.breathAfterBeats,
        },
      ],
      targets: [
        {
          id: 'home-window',
          atBeat: tuning.targets.homeWindow.atBeat,
          phraseId: 'home-whole',
          ...completion(1),
          displayLane: 1,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'higher-carafe',
          atBeat: tuning.targets.higherCarafe.atBeat,
          phraseId: 'higher-half',
          ...completion(1),
          displayLane: 2,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'lower-diadem',
          atBeat: tuning.targets.lowerDiadem.atBeat,
          phraseId: 'lower-half',
          ...completion(1),
          displayLane: 0,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'two-note-window',
          atBeat: tuning.targets.twoNoteWindow.atBeat,
          phraseId: 'two-up',
          ...completion(2),
          displayLane: 1,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'arc-diadem',
          atBeat: tuning.targets.arcDiadem.atBeat,
          phraseId: 'first-arc',
          ...completion(3),
          displayLane: 1,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'melody-rehearsal',
          atBeat: tuning.targets.melodyRehearsal.atBeat,
          phraseId: 'sunlit-steps',
          ...completion(5),
          displayLane: 2,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'two-note-revisit',
          atBeat: tuning.targets.twoNoteRevisit.atBeat,
          phraseId: 'two-up',
          ...completion(2),
          displayLane: 0,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
        {
          id: 'melody-finale',
          atBeat: tuning.targets.melodyFinale.atBeat,
          phraseId: 'sunlit-steps',
          ...completion(5),
          displayLane: 1,
          glassProfileId: 'runner-score-window-v1',
          requiredForGrade: true,
        },
      ],
    },
    obstacles: [
      {
        id: 'first-lane-gate',
        atBeat: tuning.obstacles.firstLaneGate.atBeat,
        laneMask: [1],
        profileId: 'runner-lane-gate-training-v1',
      },
      {
        id: 'first-jump',
        atBeat: tuning.obstacles.firstJump.atBeat,
        laneMask: [0, 1, 2],
        profileId: 'runner-gap-catch-training-v1',
      },
      {
        id: 'second-lane-gate',
        atBeat: tuning.obstacles.secondLaneGate.atBeat,
        laneMask: [0, 1],
        profileId: 'runner-lane-gate-v1',
      },
      {
        id: 'second-jump',
        atBeat: tuning.obstacles.secondJump.atBeat,
        laneMask: [0, 1, 2],
        profileId: 'runner-gap-v1',
      },
    ],
    checkpoints: [
      {
        id: 'start',
        atBeat: tuning.checkpoints.start.atBeat,
        respawnLane: 1,
        countInBeats: tuning.checkpoints.start.countInBeats,
      },
      {
        id: 'tempo-step',
        atBeat: tuning.checkpoints.tempoStep.atBeat,
        respawnLane: 1,
        countInBeats: tuning.checkpoints.tempoStep.countInBeats,
      },
      {
        id: 'melody',
        atBeat: tuning.checkpoints.melody.atBeat,
        respawnLane: 1,
        countInBeats: tuning.checkpoints.melody.countInBeats,
      },
    ],
    rewards: {
      revision: 1,
      pickupProfileId: 'runner-pearl-pickup-v1',
      pickups: [
        {
          id: 'pearl-left-60',
          atBeat: tuning.pickups.pearlLeft60.atBeat,
          lane: 0,
        },
        {
          id: 'pearl-right-62',
          atBeat: tuning.pickups.pearlRight62.atBeat,
          lane: 2,
        },
        {
          id: 'pearl-right-114',
          atBeat: tuning.pickups.pearlRight114.atBeat,
          lane: 2,
        },
        {
          id: 'pearl-left-118',
          atBeat: tuning.pickups.pearlLeft118.atBeat,
          lane: 0,
        },
      ],
      singingStarTargetIds: [
        'home-window',
        'higher-carafe',
        'lower-diadem',
        'two-note-window',
        'arc-diadem',
        'melody-rehearsal',
        'two-note-revisit',
        'melody-finale',
      ],
      finishRewardIds: ['portrait-first-song-run'],
    },
    presentation: {
      environmentProfileId: 'runner-sunlit-glass-v1',
      musicProfileId: 'runner-first-flight-v1',
      notationProfileId: 'runner-staff-glass-v1',
    },
  } as const satisfies SongRunnerCourseSource

  const sourceDocument = {
    schema: 'mercurypitch.song-runner-course',
    version: 1,
    courses: [source],
  } as const satisfies SongRunnerSourceDocument

  return {
    catalog,
    source,
    sourceDocument,
    course: compileSongRunnerCourseDocument(sourceDocument, catalog)[0]!,
  }
}

const current = buildSingingCurrent(
  { id: 'the-singing-current-v1', revision: 1 },
  SINGING_CURRENT_CURRENT_TUNING,
)
const learning = buildSingingCurrent(
  { id: 'the-singing-current-v1', revision: 2 },
  SINGING_CURRENT_LEARNING_TUNING,
)
const currentTrial = buildSingingCurrent(
  { id: 'the-singing-current-trial-current-v1', revision: 1 },
  SINGING_CURRENT_CURRENT_TUNING,
)
const learningTrial = buildSingingCurrent(
  { id: 'the-singing-current-trial-learning-v1', revision: 1 },
  SINGING_CURRENT_LEARNING_TUNING,
)

const responsive = buildSingingCurrent(
  { id: 'the-singing-current-v1', revision: 3 },
  SINGING_CURRENT_RESPONSIVE_TUNING,
)
const responsiveTrial = buildSingingCurrent(
  { id: 'the-singing-current-trial-responsive-v1', revision: 1 },
  SINGING_CURRENT_RESPONSIVE_TUNING,
)

export const SINGING_CURRENT_RESPONSIVE_CATALOG = responsive.catalog
export const SINGING_CURRENT_RESPONSIVE_SOURCE = responsive.source
export const SINGING_CURRENT_RESPONSIVE_SOURCE_DOCUMENT =
  responsive.sourceDocument
export const SINGING_CURRENT_RESPONSIVE = responsive.course
export const SINGING_CURRENT_RESPONSIVE_TRIAL = responsiveTrial.course

export const SINGING_CURRENT_CURRENT_CATALOG = current.catalog
export const SINGING_CURRENT_CURRENT_SOURCE = current.source
export const SINGING_CURRENT_CURRENT_SOURCE_DOCUMENT = current.sourceDocument
export const SINGING_CURRENT_CURRENT = current.course

export const SINGING_CURRENT_LEARNING_CATALOG = learning.catalog
export const SINGING_CURRENT_LEARNING_SOURCE = learning.source
export const SINGING_CURRENT_LEARNING_SOURCE_DOCUMENT = learning.sourceDocument
export const SINGING_CURRENT_LEARNING = learning.course

export const SINGING_CURRENT_CURRENT_TRIAL = currentTrial.course
export const SINGING_CURRENT_LEARNING_TRIAL = learningTrial.course
export const SINGING_CURRENT_TRIALS = {
  responsive: SINGING_CURRENT_RESPONSIVE_TRIAL,
  current: SINGING_CURRENT_CURRENT_TRIAL,
  learning: SINGING_CURRENT_LEARNING_TRIAL,
} as const

export const SINGING_CURRENT_CATALOG = SINGING_CURRENT_RESPONSIVE_CATALOG
export const SINGING_CURRENT_SOURCE = SINGING_CURRENT_RESPONSIVE_SOURCE
export const SINGING_CURRENT_SOURCE_DOCUMENT =
  SINGING_CURRENT_RESPONSIVE_SOURCE_DOCUMENT
export const SINGING_CURRENT = SINGING_CURRENT_RESPONSIVE
