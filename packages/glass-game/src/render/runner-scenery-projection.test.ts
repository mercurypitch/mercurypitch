// Runner scenery projection tests — continuous visibility covers narrow objects between camera probes.

import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT_CONTINUOUS_TRIAL } from '../runner/first-course'
import { runnerBodyLateralBounds } from '../runner/track-bounds'
import { createRunnerSceneryHandoffs, createRunnerSceneryVisibilityContext, RUNNER_SCENERY_VALIDATED_ASPECTS, runnerSceneryHandoffVisibilityAt, } from './runner-scenery-projection'
import { runnerCameraFollowTarget, runnerCameraPose, } from './runner-world-layout'

describe('continuous runner scenery projection', () => {
  it('does not retire a narrow object visible only between the former 17 follow probes', () => {
    const course = SINGING_CURRENT_CONTINUOUS_TRIAL
    const bounds = runnerBodyLateralBounds(course)
    const range = [bounds.minLateralX, bounds.maxLateralX] as const
    const aspect = RUNNER_SCENERY_VALIDATED_ASPECTS[0]!
    const playerX = range[0] + ((range[1] - range[0]) * 15.5) / 16
    const pose = runnerCameraPose(aspect, course.laneCenters, 'steering-close')
    const followX = runnerCameraFollowTarget(
      playerX,
      course.laneCenters,
      aspect,
      'steering-close',
      true,
    )
    const camera = new PerspectiveCamera(pose.fovDegrees, aspect, 0.08, 75)
    camera.position.set(pose.x + followX, pose.y, pose.z)
    camera.lookAt(pose.targetX + followX, pose.targetY, pose.targetZ)
    camera.updateMatrixWorld(true)
    const center = camera.localToWorld(new Vector3(0, 0, -0.09))
    const outgoing = new Box3().setFromCenterAndSize(
      center,
      new Vector3(0.002, 0.002, 0.002),
    )
    const chunks = [
      { id: 'outgoing', bounds: [outgoing] },
      { id: 'middle', bounds: [] },
      {
        id: 'incoming',
        bounds: [new Box3(new Vector3(-1, 0, -101), new Vector3(1, 1, -100))],
      },
    ]
    const context = createRunnerSceneryVisibilityContext(
      course.laneCenters,
      chunks,
      'steering-close',
      range,
    )
    const unsafeHandoff = {
      atCourseDistanceMeters: 0,
      outgoingChunkId: 'outgoing',
      incomingChunkId: 'incoming',
    }
    expect(
      runnerSceneryHandoffVisibilityAt(context, unsafeHandoff, aspect, playerX)
        .outgoingVisible,
    ).toBe(true)
    for (const sampledAspect of RUNNER_SCENERY_VALIDATED_ASPECTS)
      for (let index = 0; index <= 16; index++)
        expect(
          runnerSceneryHandoffVisibilityAt(
            context,
            unsafeHandoff,
            sampledAspect,
            range[0] + ((range[1] - range[0]) * index) / 16,
          ).outgoingVisible,
        ).toBe(false)

    const [safeHandoff] = createRunnerSceneryHandoffs(course, chunks, context)
    expect(safeHandoff!.atCourseDistanceMeters).toBeGreaterThan(0)
    expect(
      runnerSceneryHandoffVisibilityAt(context, safeHandoff!, aspect, playerX),
    ).toEqual({ outgoingVisible: false, incomingFullyFogged: true })
  })
})
