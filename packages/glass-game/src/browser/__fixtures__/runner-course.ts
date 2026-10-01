// Runner adapter fixture — finite safe track with the three authored tempo boundaries.
import type { CompiledRunnerCourse } from '../../runner/contracts'
import { compileRunnerTempoSegments, runnerBeatToSeconds, } from '../../runner/tempo'

export type RunnerCourseFixturePace = 'current' | 'learning'

const TEMPO_MAPS = {
  current: [
    { atBeat: 0, bpm: 96 },
    { atBeat: 64, bpm: 108 },
    { atBeat: 96, bpm: 116 },
  ],
  learning: [
    { atBeat: 0, bpm: 84 },
    { atBeat: 64, bpm: 96 },
    { atBeat: 96, bpm: 104 },
  ],
} as const

export function runnerCourseFixture(
  pace: RunnerCourseFixturePace = 'current',
): CompiledRunnerCourse {
  const tempoSegments = compileRunnerTempoSegments(TEMPO_MAPS[pace], 160)
  const seconds = (beat: number) => runnerBeatToSeconds(tempoSegments, beat)
  return {
    schema: 'mercurypitch.song-runner.compiled',
    version: 1,
    id: 'adapter-test',
    revision: 1,
    title: 'Adapter test',
    seed: 7,
    meter: { beatsPerBar: 4, beatUnit: 4 },
    lengthBeats: 160,
    lengthCourseSeconds: seconds(160),
    metersPerBeat: 2,
    lengthMeters: 320,
    groundFeetY: 0,
    fallBelowFeetY: -2,
    laneCenters: [-2, 0, 2],
    tempoSegments,
    movement: {
      id: 'test',
      revision: 1,
      fixedStepSeconds: 1 / 120,
      maxCatchUpSeconds: 0.25,
      laneChangeSeconds: 0.25,
      bodyRadius: 0.2,
      bodyHeight: 1,
      jumpVelocityMetersPerSecond: 5,
      gravityMetersPerSecondSquared: 10,
      maxJumpRiseMeters: 1.25,
      coyoteSeconds: 0.1,
      jumpBufferSeconds: 0.1,
    },
    voice: {
      id: 'test',
      revision: 1,
      comfortableRootOffsetSemitones: 0,
      minimumComfortableMidi: 45,
      maximumComfortableMidi: 81,
      judge: {
        id: 'test',
        revision: 1,
        evidenceVersion: 'pitch-accuracy-v1',
        minimumConfidence: 0.7,
        centsTolerance: 50,
        maximumEvidenceGapSeconds: 0.1,
        minimumReliableRatio: 0.5,
        maximumDeliveryLatencySeconds: 0.15,
        gradeBands: [
          { grade: 3, maximumMeanAbsoluteCents: 12 },
          { grade: 2, maximumMeanAbsoluteCents: 30 },
          { grade: 1, maximumMeanAbsoluteCents: 50 },
        ],
      },
    },
    checkpoints: [0, 64, 96].map((beat) => ({
      id: `checkpoint-${beat}`,
      beat,
      courseSeconds: seconds(beat),
      courseDistanceMeters: beat * 2,
      respawnLane: 1,
      respawnFeetY: 0,
      countInBeats: 4,
      runwayEndBeat: beat + 4,
      runwayEndCourseSeconds: seconds(beat + 4),
    })),
    targets: [
      {
        id: 'note',
        chunkId: 'chunk-0',
        displayLane: 1,
        glassProfileId: 'glass',
        requiredForGrade: true,
        visibleFromCourseSeconds: 0,
        emphasizedFromCourseSeconds: seconds(4),
        onsetCourseSeconds: seconds(8),
        endCourseSeconds: seconds(10),
        judgeOpenCourseSeconds: seconds(8) - 0.1,
        judgeCloseCourseSeconds: seconds(10),
        settleAfterCourseSeconds: seconds(10) + 0.15,
        protectedFromCourseSeconds: seconds(7),
        protectedUntilCourseSeconds: seconds(12),
        notes: [
          {
            index: 0,
            startOffsetSemitones: 0,
            endOffsetSemitones: 0,
            connection: 'separate',
            startBeat: 8,
            endBeat: 10,
            startCourseSeconds: seconds(8),
            endCourseSeconds: seconds(10),
            minimumReliableSeconds: (seconds(10) - seconds(8)) * 0.5,
          },
        ],
      },
    ],
    obstacles: [],
    chunks: Array.from({ length: 10 }, (_, index) => ({
      id: `chunk-${index}`,
      index,
      startBeat: index * 16,
      endBeat: (index + 1) * 16,
      startCourseSeconds: seconds(index * 16),
      endCourseSeconds: seconds((index + 1) * 16),
      minCourseDistanceMeters: index * 32,
      maxCourseDistanceMeters: (index + 1) * 32,
      targetIds: index === 0 ? ['note'] : [],
      obstacleIds: [],
      rewardIds: [],
      assetProfileIds: [],
    })),
    rewards: {
      revision: 1,
      pickups: [],
      singingStarTargetIds: ['note'],
      finishRewardIds: ['finish'],
    },
    presentation: {
      environmentProfileId: 'test',
      musicProfileId: 'runner-first-flight-v1',
      notationProfileId: 'test',
    },
    preloadAssetProfileIds: [],
  }
}
