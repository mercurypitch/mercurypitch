// Runner course actions — derive browser movement times from the selected compiled pace.
import type { CompiledRunnerCourse } from '../../../../packages/glass-game/src/runner/contracts'

export function runnerCourseActions(course: CompiledRunnerCourse) {
  function window(obstacleId: string, kind: 'lane-transition' | 'jump') {
    const action = course.obstacles
      .find((obstacle) => obstacle.id === obstacleId)
      ?.certifiedActions.find((candidate) => candidate.kind === kind)
    if (action === undefined)
      throw new Error(`Missing ${kind} window for ${obstacleId}.`)
    return action
  }
  function launch(obstacleId: string, kind: 'lane-transition' | 'jump') {
    const action = window(obstacleId, kind)
    return (
      (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2
    )
  }
  return {
    firstLaneChange: launch('first-lane-gate', 'lane-transition'),
    firstJump: launch('first-jump', 'jump'),
    returnToMiddle:
      window('first-jump', 'jump').landingCloseCourseSeconds + 0.5,
    secondLaneChange: launch('second-lane-gate', 'lane-transition'),
    secondJump: launch('second-jump', 'jump'),
  }
}
