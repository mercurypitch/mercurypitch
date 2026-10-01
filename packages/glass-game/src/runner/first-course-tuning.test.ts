// ============================================================
// Singing Current tuning tests — exact pace variants with stable course truth.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from './contracts'
import { SINGING_CURRENT, SINGING_CURRENT_CATALOG, SINGING_CURRENT_CURRENT, SINGING_CURRENT_CURRENT_SOURCE, SINGING_CURRENT_CURRENT_TRIAL, SINGING_CURRENT_LEARNING, SINGING_CURRENT_LEARNING_SOURCE, SINGING_CURRENT_LEARNING_TRIAL, SINGING_CURRENT_SOURCE, SINGING_CURRENT_TRIALS, } from './first-course'
import { SINGING_CURRENT_CURRENT_TUNING, SINGING_CURRENT_LEARNING_TUNING, } from './first-course-tuning'
import { runnerBeatToSeconds } from './tempo'

const CURRENT_BOUNDARIES = [40, 57.77777777777778, 90.88122605363984]
const LEARNING_BOUNDARIES = [
  45.714285714285715, 65.71428571428572, 102.63736263736264,
]

function targetBeatWindows(course: CompiledRunnerCourse) {
  return course.targets.map((target) => [
    target.id,
    target.notes[0]!.startBeat,
    target.notes.at(-1)!.endBeat,
  ])
}

function stableCourseTruth(course: CompiledRunnerCourse) {
  return {
    title: course.title,
    seed: course.seed,
    meter: course.meter,
    lengthBeats: course.lengthBeats,
    metersPerBeat: course.metersPerBeat,
    lengthMeters: course.lengthMeters,
    groundFeetY: course.groundFeetY,
    fallBelowFeetY: course.fallBelowFeetY,
    laneCenters: course.laneCenters,
    movement: course.movement,
    judge: course.voice.judge,
    targets: course.targets.map((target) => ({
      id: target.id,
      displayLane: target.displayLane,
      glassProfileId: target.glassProfileId,
      requiredForGrade: target.requiredForGrade,
      notes: target.notes.map((note) => ({
        startBeat: note.startBeat,
        endBeat: note.endBeat,
        startOffsetSemitones: note.startOffsetSemitones,
        endOffsetSemitones: note.endOffsetSemitones,
        connection: note.connection,
      })),
    })),
    obstacles: course.obstacles.map((obstacle) => ({
      kind: obstacle.kind,
      id: obstacle.id,
      profileId: obstacle.profileId,
      minCourseDistanceMeters: obstacle.minCourseDistanceMeters,
      maxCourseDistanceMeters: obstacle.maxCourseDistanceMeters,
      spatial:
        obstacle.kind === 'blocker'
          ? {
              minLateralX: obstacle.minLateralX,
              maxLateralX: obstacle.maxLateralX,
              minY: obstacle.minY,
              maxY: obstacle.maxY,
              authoredLaneMask: obstacle.authoredLaneMask,
            }
          : {
              lateralSpans: obstacle.lateralSpans,
              landingStartCourseDistanceMeters:
                obstacle.landingStartCourseDistanceMeters,
              landingEndCourseDistanceMeters:
                obstacle.landingEndCourseDistanceMeters,
            },
      actions: obstacle.certifiedActions.map((action) => ({
        kind: action.kind,
        reachableLanes: action.reachableLanes,
      })),
    })),
    checkpoints: course.checkpoints.map((checkpoint) => ({
      id: checkpoint.id,
      beat: checkpoint.beat,
      courseDistanceMeters: checkpoint.courseDistanceMeters,
      respawnLane: checkpoint.respawnLane,
      respawnFeetY: checkpoint.respawnFeetY,
      countInBeats: checkpoint.countInBeats,
      runwayEndBeat: checkpoint.runwayEndBeat,
    })),
    rewards: {
      revision: course.rewards.revision,
      pickups: course.rewards.pickups.map((pickup) => ({
        id: pickup.id,
        beat: pickup.beat,
        courseDistanceMeters: pickup.courseDistanceMeters,
        lateralX: pickup.lateralX,
        radius: pickup.radius,
      })),
      singingStarTargetIds: course.rewards.singingStarTargetIds,
      finishRewardIds: course.rewards.finishRewardIds,
    },
    presentation: course.presentation,
    preloadAssetProfileIds: course.preloadAssetProfileIds,
  }
}

function expectCertifiedSafety(course: CompiledRunnerCourse): void {
  for (const obstacle of course.obstacles) {
    expect(obstacle.certifiedActions.length).toBeGreaterThan(0)
    for (const action of obstacle.certifiedActions) {
      expect(action.launchCloseCourseSeconds).toBeGreaterThan(
        action.launchOpenCourseSeconds,
      )
      expect(action.landingCloseCourseSeconds).toBeGreaterThan(
        action.landingOpenCourseSeconds,
      )
      for (const target of course.targets) {
        const overlaps =
          action.launchOpenCourseSeconds < target.protectedUntilCourseSeconds &&
          action.landingCloseCourseSeconds > target.protectedFromCourseSeconds
        expect(overlaps).toBe(false)
      }
    }
  }
  for (const checkpoint of course.checkpoints) {
    const runwayStart = checkpoint.courseDistanceMeters
    const runwayEnd = checkpoint.runwayEndBeat * course.metersPerBeat
    for (const obstacle of course.obstacles) {
      if (obstacle.kind !== 'gap') continue
      const overlaps =
        runwayStart < obstacle.landingEndCourseDistanceMeters &&
        runwayEnd > obstacle.minCourseDistanceMeters
      expect(overlaps).toBe(false)
    }
  }
}

function expectBoundaries(
  course: CompiledRunnerCourse,
  bpms: readonly number[],
  boundaries: readonly number[],
): void {
  expect(course.tempoSegments.map((segment) => segment.bpm)).toEqual(bpms)
  expect(course.tempoSegments).toHaveLength(boundaries.length)
  course.tempoSegments.forEach((segment, index) => {
    expect(segment.endCourseSeconds).toBeCloseTo(boundaries[index]!, 12)
  })
  expect(course.lengthCourseSeconds).toBeCloseTo(boundaries.at(-1)!, 12)
}

describe('Singing Current pacing variants', () => {
  it('locks the original current output to its explicit revision-one control', () => {
    expect(SINGING_CURRENT_CURRENT).toMatchObject({
      id: 'the-singing-current-v1',
      revision: 1,
      lengthBeats: 160,
      lengthMeters: 192,
      laneCenters: [-2, 0, 2],
    })
    expectBoundaries(
      SINGING_CURRENT_CURRENT,
      [96, 108, 116],
      CURRENT_BOUNDARIES,
    )
    expect(targetBeatWindows(SINGING_CURRENT_CURRENT)).toEqual([
      ['home-window', 8, 12],
      ['higher-carafe', 32, 34],
      ['lower-diadem', 40, 42],
      ['two-note-window', 52, 56],
      ['arc-diadem', 68, 74],
      ['melody-rehearsal', 100, 108],
      ['two-note-revisit', 120, 124],
      ['melody-finale', 148, 156],
    ])
    expect(
      SINGING_CURRENT_CURRENT.targets.map((target) => [
        target.onsetCourseSeconds,
        target.endCourseSeconds,
      ]),
    ).toEqual([
      [5, 7.5],
      [20, 21.25],
      [25, 26.25],
      [32.5, 35],
      [40 + (4 * 60) / 108, 40 + (10 * 60) / 108],
      [
        CURRENT_BOUNDARIES[1] + (4 * 60) / 116,
        CURRENT_BOUNDARIES[1] + (12 * 60) / 116,
      ],
      [
        CURRENT_BOUNDARIES[1] + (24 * 60) / 116,
        CURRENT_BOUNDARIES[1] + (28 * 60) / 116,
      ],
      [
        CURRENT_BOUNDARIES[1] + (52 * 60) / 116,
        CURRENT_BOUNDARIES[1] + (60 * 60) / 116,
      ],
    ])
    expect(
      SINGING_CURRENT_CURRENT.obstacles.map((obstacle) => [
        obstacle.id,
        obstacle.minCourseDistanceMeters,
        obstacle.maxCourseDistanceMeters,
      ]),
    ).toEqual([
      ['first-lane-gate', 21.249999999999996, 21.95],
      ['first-jump', 29.55, 30.45],
      ['second-lane-gate', 91.99999999999999, 92.8],
      ['second-jump', 108.675, 109.72500000000001],
    ])
    expect(
      SINGING_CURRENT_CURRENT.checkpoints.map((checkpoint) => [
        checkpoint.id,
        checkpoint.beat,
        checkpoint.countInBeats,
      ]),
    ).toEqual([
      ['start', 0, 4],
      ['tempo-step', 64, 4],
      ['melody', 96, 4],
    ])
    expect(
      SINGING_CURRENT_CURRENT.rewards.pickups.map((pickup) => pickup.id),
    ).toEqual([
      'pearl-left-60',
      'pearl-right-62',
      'pearl-right-114',
      'pearl-left-118',
    ])
    expect(SINGING_CURRENT_CURRENT.rewards.finishRewardIds).toEqual([
      'portrait-first-song-run',
    ])
    expect(SINGING_CURRENT_CURRENT.preloadAssetProfileIds).toEqual([
      'cloudway-lab-frost-gold-arch-v1',
      'floor-marble',
      'living-crystal-platform-v2',
      'merc',
      'museum-environment-v2',
      'museum-sky',
    ])
  })

  it('changes only tempo for the canonical revision-two learning default', () => {
    const { tempoMap: _currentTempo, ...currentTuning } =
      SINGING_CURRENT_CURRENT_TUNING
    const { tempoMap: _learningTempo, ...learningTuning } =
      SINGING_CURRENT_LEARNING_TUNING
    expect(learningTuning).toEqual(currentTuning)
    expect(SINGING_CURRENT_LEARNING).toMatchObject({
      id: 'the-singing-current-v1',
      revision: 2,
    })
    expectBoundaries(
      SINGING_CURRENT_LEARNING,
      [84, 96, 104],
      LEARNING_BOUNDARIES,
    )
    expect(targetBeatWindows(SINGING_CURRENT_LEARNING)).toEqual(
      targetBeatWindows(SINGING_CURRENT_CURRENT),
    )
    expect(
      SINGING_CURRENT_LEARNING.targets.map((target) => [
        target.onsetCourseSeconds,
        target.endCourseSeconds,
      ]),
    ).toEqual([
      [(8 * 60) / 84, (12 * 60) / 84],
      [(32 * 60) / 84, (34 * 60) / 84],
      [(40 * 60) / 84, (42 * 60) / 84],
      [(52 * 60) / 84, (56 * 60) / 84],
      [
        LEARNING_BOUNDARIES[0] + (4 * 60) / 96,
        LEARNING_BOUNDARIES[0] + (10 * 60) / 96,
      ],
      [
        LEARNING_BOUNDARIES[1] + (4 * 60) / 104,
        LEARNING_BOUNDARIES[1] + (12 * 60) / 104,
      ],
      [
        LEARNING_BOUNDARIES[1] + (24 * 60) / 104,
        LEARNING_BOUNDARIES[1] + (28 * 60) / 104,
      ],
      [
        LEARNING_BOUNDARIES[1] + (52 * 60) / 104,
        LEARNING_BOUNDARIES[1] + (60 * 60) / 104,
      ],
    ])
    expect(stableCourseTruth(SINGING_CURRENT_LEARNING)).toEqual(
      stableCourseTruth(SINGING_CURRENT_CURRENT),
    )
    for (const [index, target] of SINGING_CURRENT_LEARNING.targets.entries()) {
      const currentTarget = SINGING_CURRENT_CURRENT.targets[index]!
      expect(
        target.onsetCourseSeconds - target.visibleFromCourseSeconds,
      ).toBeGreaterThan(
        currentTarget.onsetCourseSeconds -
          currentTarget.visibleFromCourseSeconds,
      )
      expect(
        target.onsetCourseSeconds - target.emphasizedFromCourseSeconds,
      ).toBeGreaterThan(
        currentTarget.onsetCourseSeconds -
          currentTarget.emphasizedFromCourseSeconds,
      )
      const targetEndBeat = target.notes.at(-1)!.endBeat
      const currentEndBeat = currentTarget.notes.at(-1)!.endBeat
      const learningBreath =
        runnerBeatToSeconds(
          SINGING_CURRENT_LEARNING.tempoSegments,
          targetEndBeat + 4,
        ) - target.endCourseSeconds
      const currentBreath =
        runnerBeatToSeconds(
          SINGING_CURRENT_CURRENT.tempoSegments,
          currentEndBeat + 4,
        ) - currentTarget.endCourseSeconds
      expect(learningBreath).toBeGreaterThan(currentBreath)
    }
    expect(
      SINGING_CURRENT_LEARNING.targets
        .flatMap((target) => target.notes)
        .reduce(
          (smallest, note) =>
            Math.min(smallest, note.endCourseSeconds - note.startCourseSeconds),
          Infinity,
        ),
    ).toBeCloseTo(60 / 104, 12)
    expect(
      SINGING_CURRENT_LEARNING.targets[0]!.notes[0]!.minimumReliableSeconds,
    ).toBeCloseTo(((4 * 60) / 84) * 0.52, 12)
  })

  it('keeps both compiled presets certified around voice windows and checkpoints', () => {
    expectCertifiedSafety(SINGING_CURRENT_CURRENT)
    expectCertifiedSafety(SINGING_CURRENT_LEARNING)
  })

  it('uses isolated trial identities while the selected aliases remain canonical learning', () => {
    expect(SINGING_CURRENT_CURRENT_TRIAL).toMatchObject({
      id: 'the-singing-current-trial-current-v1',
      revision: 1,
    })
    expect(SINGING_CURRENT_LEARNING_TRIAL).toMatchObject({
      id: 'the-singing-current-trial-learning-v1',
      revision: 1,
    })
    expect(SINGING_CURRENT_TRIALS).toEqual({
      current: SINGING_CURRENT_CURRENT_TRIAL,
      learning: SINGING_CURRENT_LEARNING_TRIAL,
    })
    expect(SINGING_CURRENT_CURRENT_TRIAL.id).not.toBe(
      SINGING_CURRENT_CURRENT.id,
    )
    expect(SINGING_CURRENT_LEARNING_TRIAL.id).not.toBe(
      SINGING_CURRENT_LEARNING.id,
    )
    expect(stableCourseTruth(SINGING_CURRENT_CURRENT_TRIAL)).toEqual(
      stableCourseTruth(SINGING_CURRENT_CURRENT),
    )
    expect(stableCourseTruth(SINGING_CURRENT_LEARNING_TRIAL)).toEqual(
      stableCourseTruth(SINGING_CURRENT_LEARNING),
    )
    expect(
      SINGING_CURRENT_TRIALS.current.tempoSegments.map(
        (segment) => segment.bpm,
      ),
    ).toEqual([96, 108, 116])
    expect(
      SINGING_CURRENT_TRIALS.learning.tempoSegments.map(
        (segment) => segment.bpm,
      ),
    ).toEqual([84, 96, 104])
    expect(SINGING_CURRENT).toBe(SINGING_CURRENT_LEARNING)
    expect(SINGING_CURRENT_SOURCE).toBe(SINGING_CURRENT_LEARNING_SOURCE)
    expect(SINGING_CURRENT_CATALOG).not.toBeUndefined()
    expect(SINGING_CURRENT_CURRENT_SOURCE.revision).toBe(1)
    expect(SINGING_CURRENT_SOURCE.revision).toBe(2)
  })
})
