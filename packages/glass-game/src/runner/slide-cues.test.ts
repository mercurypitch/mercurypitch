// Slide cue tests — guidance stays visible through the real opening and clears after standing.
import { describe, expect, it } from 'vitest'
import { createSongRunnerGame } from './game'
import { runnerCourseDistanceAt } from './movement'
import { runnerMovementCue } from './movement-cues'
import { SLIDE_CONTINUOUS_STUDY, SLIDE_LANES_STUDY } from './slide-study'

for (const { course } of [SLIDE_LANES_STUDY, SLIDE_CONTINUOUS_STUDY]) {
  describe(`${course.id} slide cues`, () => {
    const obstacle = course.obstacles.find(
      (item) =>
        item.kind === 'blocker' && item.traversal?.kind === 'slide-under',
    )!
    const action = obstacle.certifiedActions[0]!
    const initial = createSongRunnerGame(course, {
      comfortableMidi: 60,
    }).snapshot()
    const snapshot = (courseSeconds: number) => ({
      ...initial,
      courseSeconds,
      courseDistanceMeters: runnerCourseDistanceAt(course, courseSeconds),
    })
    it('teaches alignment then hold, and keeps the low cue until the rear edge clears', () => {
      const approach = snapshot(action.launchOpenCourseSeconds + 0.01)
      expect(
        runnerMovementCue(
          course,
          snapshot(obstacle.telegraphFromCourseSeconds - 0.01),
        ),
      ).toBeNull()
      expect(
        runnerMovementCue(course, {
          ...approach,
          player: {
            ...approach.player,
            targetLane: 0,
            lateralX: course.laneCenters[0],
          },
        }),
      ).toMatchObject({ stage: 'slide-align', direction: 'right' })
      expect(runnerMovementCue(course, approach)).toMatchObject({
        stage: 'slide',
      })
      const inside = snapshot(action.landingOpenCourseSeconds - 0.01)
      const low = {
        ...inside.player,
        slide: {
          phase: 'sliding' as const,
          progress: 1,
          bodyHeightMeters: 0.42,
        },
      }
      expect(
        runnerMovementCue(course, { ...inside, player: low }),
      ).toMatchObject({ stage: 'sliding' })
      const outside = snapshot(action.landingOpenCourseSeconds + 0.01)
      expect(
        runnerMovementCue(course, { ...outside, player: low }),
      ).toMatchObject({ stage: 'release-slide' })
      expect(runnerMovementCue(course, outside)?.obstacleId).not.toBe(
        obstacle.id,
      )
    })
    it('does not reverse the cue during the correct inward approach', () => {
      const approach = snapshot(action.launchOpenCourseSeconds + 0.01)
      const moving = {
        ...approach,
        player: {
          ...approach.player,
          targetLane: 1 as const,
          lateralX: -0.4,
          lateralVelocityMetersPerSecond: 5,
        },
      }
      expect(runnerMovementCue(course, moving)).toMatchObject(
        course.movement.kind === 'continuous'
          ? { stage: 'slide-align', direction: 'right' }
          : { stage: 'slide' },
      )
    })
    if (course.movement.kind === 'continuous')
      it('warns about lateral momentum while still inside the opening', () => {
        const approach = snapshot(action.launchOpenCourseSeconds + 0.01)
        const moving = {
          ...approach,
          player: {
            ...approach.player,
            lateralX: action.slideCorridor!.maxLateralX - 0.01,
            lateralVelocityMetersPerSecond: 3,
          },
        }
        expect(runnerMovementCue(course, moving)).toMatchObject({
          stage: 'slide-align',
          direction: 'left',
        })
      })
  })
}
