// ============================================================
// The Singing Current — literal first-course source, catalogue, and compiled export.
// ============================================================

import { compileSongRunnerCourseDocument } from './compile-course'
import type { SongRunnerCourseCatalog, SongRunnerSourceDocument, } from './source'

const JUMP_RISE_METERS = 0.72
const JUMP_GRAVITY = 8
const JUMP_VELOCITY = Math.sqrt(2 * JUMP_GRAVITY * JUMP_RISE_METERS)

export const SINGING_CURRENT_CATALOG = {
  movementProfiles: {
    'runner-beginner-v1': {
      id: 'runner-beginner-v1',
      revision: 1,
      fixedStepSeconds: 1 / 120,
      maxCatchUpSeconds: 0.25,
      laneChangeSeconds: 0.45,
      bodyRadius: 0.22,
      bodyHeight: 0.7,
      jumpVelocityMetersPerSecond: JUMP_VELOCITY,
      gravityMetersPerSecondSquared: JUMP_GRAVITY,
      maxJumpRiseMeters: JUMP_RISE_METERS,
      coyoteSeconds: 0.1,
      jumpBufferSeconds: 0.12,
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
      judgeLeadBeats: 0.5,
      protectedLeadBeats: 0.5,
      protectedTailBeats: 0,
    },
  },
  obstacleProfiles: {
    'runner-lane-gate-training-v1': {
      kind: 'blocker',
      id: 'runner-lane-gate-training-v1',
      longitudinalHalfLengthMeters: 0.35,
      laneHalfWidthMeters: 0.78,
      minYOffsetMeters: 0,
      maxYOffsetMeters: 1.15,
      visibleLongitudinalHalfLengthMeters: 0.35,
      visibleLaneHalfWidthMeters: 0.78,
      visibleMinYOffsetMeters: 0,
      visibleMaxYOffsetMeters: 1.15,
      telegraphLeadBeats: 2,
      assetProfileIds: [],
    },
    'runner-gap-catch-training-v1': {
      kind: 'gap',
      id: 'runner-gap-catch-training-v1',
      lengthMeters: 0.9,
      laneHalfWidthMeters: 1,
      visibleLengthMeters: 0.9,
      visibleLaneHalfWidthMeters: 1,
      landingRunwayMeters: 1.6,
      telegraphLeadBeats: 2,
      assetProfileIds: ['living-crystal-platform-v2'],
    },
    'runner-lane-gate-v1': {
      kind: 'blocker',
      id: 'runner-lane-gate-v1',
      longitudinalHalfLengthMeters: 0.4,
      laneHalfWidthMeters: 0.78,
      minYOffsetMeters: 0,
      maxYOffsetMeters: 1.25,
      visibleLongitudinalHalfLengthMeters: 0.4,
      visibleLaneHalfWidthMeters: 0.78,
      visibleMinYOffsetMeters: 0,
      visibleMaxYOffsetMeters: 1.25,
      telegraphLeadBeats: 2.5,
      assetProfileIds: [],
    },
    'runner-gap-v1': {
      kind: 'gap',
      id: 'runner-gap-v1',
      lengthMeters: 1.05,
      laneHalfWidthMeters: 1,
      visibleLengthMeters: 1.05,
      visibleLaneHalfWidthMeters: 1,
      landingRunwayMeters: 1.8,
      telegraphLeadBeats: 2.5,
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
        'living-crystal-platform-v2',
      ],
    },
  },
  musicProfileIds: ['runner-first-flight-v1'],
  notationProfileIds: ['runner-staff-glass-v1'],
} as const satisfies SongRunnerCourseCatalog

export const SINGING_CURRENT_SOURCE = {
  id: 'the-singing-current-v1',
  title: 'The Singing Current',
  revision: 1,
  seed: 1776,
  meter: { beatsPerBar: 4, beatUnit: 4 },
  tempoMap: [
    { atBeat: 0, bpm: 96 },
    { atBeat: 64, bpm: 108 },
    { atBeat: 96, bpm: 116 },
  ],
  track: {
    lengthBeats: 160,
    metersPerBeat: 1.2,
    groundFeetY: 0,
    fallBelowFeetY: -3,
    laneCenters: [-2, 0, 2],
    spawnRunwayBeats: 4,
    vocalLookaheadBeats: 8,
    vocalEmphasisBeats: 4,
    chunkBeats: 16,
  },
  movementProfileId: 'runner-beginner-v1',
  voice: {
    profileId: 'runner-relative-pitch-v1',
    phrases: [
      {
        id: 'home-whole',
        notes: [{ offsetSemitones: 0, durationBeats: 4 }],
        breathAfterBeats: 4,
      },
      {
        id: 'higher-half',
        notes: [{ offsetSemitones: 2, durationBeats: 2 }],
        breathAfterBeats: 4,
      },
      {
        id: 'lower-half',
        notes: [{ offsetSemitones: -2, durationBeats: 2 }],
        breathAfterBeats: 4,
      },
      {
        id: 'two-up',
        notes: [
          { offsetSemitones: 0, durationBeats: 2 },
          {
            offsetSemitones: 2,
            durationBeats: 2,
            connection: 'separate',
          },
        ],
        breathAfterBeats: 4,
      },
      {
        id: 'first-arc',
        notes: [
          { offsetSemitones: 0, durationBeats: 2 },
          { offsetSemitones: 2, durationBeats: 2, connection: 'glide' },
          { offsetSemitones: 0, durationBeats: 2, connection: 'glide' },
        ],
        breathAfterBeats: 4,
      },
      {
        id: 'sunlit-steps',
        notes: [
          { offsetSemitones: 0, durationBeats: 1 },
          { offsetSemitones: 2, durationBeats: 1, connection: 'glide' },
          { offsetSemitones: 4, durationBeats: 2, connection: 'glide' },
          { offsetSemitones: 2, durationBeats: 1, connection: 'glide' },
          { offsetSemitones: 0, durationBeats: 3, connection: 'glide' },
        ],
        breathAfterBeats: 4,
      },
    ],
    targets: [
      {
        id: 'home-window',
        atBeat: 8,
        phraseId: 'home-whole',
        displayLane: 1,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'higher-carafe',
        atBeat: 32,
        phraseId: 'higher-half',
        displayLane: 2,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'lower-diadem',
        atBeat: 40,
        phraseId: 'lower-half',
        displayLane: 0,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'two-note-window',
        atBeat: 52,
        phraseId: 'two-up',
        displayLane: 1,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'arc-diadem',
        atBeat: 68,
        phraseId: 'first-arc',
        displayLane: 1,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'melody-rehearsal',
        atBeat: 100,
        phraseId: 'sunlit-steps',
        displayLane: 2,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'two-note-revisit',
        atBeat: 120,
        phraseId: 'two-up',
        displayLane: 0,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
      {
        id: 'melody-finale',
        atBeat: 148,
        phraseId: 'sunlit-steps',
        displayLane: 1,
        glassProfileId: 'runner-score-window-v1',
        requiredForGrade: true,
      },
    ],
  },
  obstacles: [
    {
      id: 'first-lane-gate',
      atBeat: 18,
      laneMask: [1],
      profileId: 'runner-lane-gate-training-v1',
    },
    {
      id: 'first-jump',
      atBeat: 25,
      laneMask: [0, 1, 2],
      profileId: 'runner-gap-catch-training-v1',
    },
    {
      id: 'second-lane-gate',
      atBeat: 77,
      laneMask: [0, 1],
      profileId: 'runner-lane-gate-v1',
    },
    {
      id: 'second-jump',
      atBeat: 91,
      laneMask: [0, 1, 2],
      profileId: 'runner-gap-v1',
    },
  ],
  checkpoints: [
    { id: 'start', atBeat: 0, respawnLane: 1, countInBeats: 4 },
    { id: 'tempo-step', atBeat: 64, respawnLane: 1, countInBeats: 4 },
    { id: 'melody', atBeat: 96, respawnLane: 1, countInBeats: 4 },
  ],
  rewards: {
    revision: 1,
    pickupProfileId: 'runner-pearl-pickup-v1',
    pickups: [
      { id: 'pearl-left-60', atBeat: 60, lane: 0 },
      { id: 'pearl-right-62', atBeat: 62, lane: 2 },
      { id: 'pearl-right-114', atBeat: 114, lane: 2 },
      { id: 'pearl-left-118', atBeat: 118, lane: 0 },
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
} as const

export const SINGING_CURRENT_SOURCE_DOCUMENT = {
  schema: 'mercurypitch.song-runner-course',
  version: 1,
  courses: [SINGING_CURRENT_SOURCE],
} as const satisfies SongRunnerSourceDocument

export const SINGING_CURRENT = compileSongRunnerCourseDocument(
  SINGING_CURRENT_SOURCE_DOCUMENT,
  SINGING_CURRENT_CATALOG,
)[0]!
