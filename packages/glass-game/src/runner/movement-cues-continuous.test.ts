// Continuous movement cue regressions — staying safely beside a blocker must not demand a crossing.
import { describe, expect, it } from 'vitest'
import { createSongRunnerGame } from './game'
import { runnerMovementCue } from './movement-cues'
import { SLIDE_CONTINUOUS_STUDY } from './slide-study'
import { runnerSecondsToBeat } from './tempo'

const course = SLIDE_CONTINUOUS_STUDY.course
const obstacle = course.obstacles.find((item) => item.id === 'blue-side-step')!
const initial = createSongRunnerGame(course, { comfortableMidi: 57 }).snapshot()

function snapshot(x: number, velocity = 0, seconds = 17.317) {
  return {
    ...initial,
    courseSeconds: seconds,
    courseDistanceMeters:
      runnerSecondsToBeat(course.tempoSegments, seconds) * course.metersPerBeat,
    player: {
      ...initial.player,
      lateralX: x,
      lateralVelocityMetersPerSecond: velocity,
    },
  }
}

describe('continuous blocker movement cues', () => {
  it.each([-2.113, 2.113])(
    'keeps the cue quiet when stopped safely at x=%s',
    (x) => {
      expect(runnerMovementCue(course, snapshot(x))).toBeNull()
    },
  )

  it('does not flicker from the opposite side cue to quiet during a safe approach', () => {
    for (const seconds of [17.1, 17.317, 17.45, 17.7])
      expect(runnerMovementCue(course, snapshot(2.113, 0, seconds))).toBeNull()
  })

  it.each([-1, 1])(
    'still warns when momentum from safe side %s carries Merc into the blocker',
    (side) => {
      const cue = runnerMovementCue(course, snapshot(side * 1.5, side * -5))
      expect(cue).toMatchObject({
        obstacleId: obstacle.id,
        stage: 'change-lane',
      })
    },
  )
})
