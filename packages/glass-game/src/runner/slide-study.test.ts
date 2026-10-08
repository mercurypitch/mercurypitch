// Celadon slide study proofs — authored arch clearance and window boundaries use the shipped collision bands.

import { describe, expect, it } from 'vitest'
import { applyRunnerMovementInput, createRunnerMovementState, stepRunnerMovement, } from './movement'
import { SLIDE_CONTINUOUS_STUDY, SLIDE_LANES_STUDY } from './slide-study'

for (const { course, source } of [SLIDE_LANES_STUDY, SLIDE_CONTINUOUS_STUDY])
  describe(source.id, () => {
    it('clears the actual arch at either certified launch boundary and restores after release', () => {
      const obstacle = course.obstacles.find(
        (item) =>
          item.kind === 'blocker' && item.traversal?.kind === 'slide-under',
      )!
      const action = obstacle.certifiedActions[0]!
      for (const launch of [
        action.launchOpenCourseSeconds,
        action.launchCloseCourseSeconds,
      ]) {
        const state = createRunnerMovementState(course, 1)
        applyRunnerMovementInput(course, state, 'slide', launch, 0, true)
        let collided = false
        for (let t = launch; t < action.landingCloseCourseSeconds; ) {
          const next = Math.min(
            action.landingCloseCourseSeconds,
            t + course.movement.fixedStepSeconds,
          )
          if (t >= action.landingOpenCourseSeconds)
            applyRunnerMovementInput(course, state, 'slide', t, 0, false)
          collided ||= stepRunnerMovement(course, state, t, next).collided
          t = next
        }
        expect(collided).toBe(false)
        expect(state.slideProgress).toBe(0)
        expect(state.grounded).toBe(true)
      }
    })

    it('cannot pass the opening without lowering the real collider', () => {
      const obstacle = course.obstacles.find(
        (item) =>
          item.kind === 'blocker' && item.traversal?.kind === 'slide-under',
      )!
      const action = obstacle.certifiedActions[0]!
      const state = createRunnerMovementState(course, 1)
      let collided = false
      for (
        let t = action.launchCloseCourseSeconds;
        t < action.landingCloseCourseSeconds;
      ) {
        const next = Math.min(
          action.landingCloseCourseSeconds,
          t + course.movement.fixedStepSeconds,
        )
        collided ||= stepRunnerMovement(course, state, t, next).collided
        t = next
      }
      expect(collided).toBe(true)
    })
  })
