// Song runner movement cue tests — visible jump phases stay inside real game survival windows.

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse, CompiledRunnerGap } from './contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, SINGING_CURRENT_RESPONSIVE, } from './first-course'
import { createSongRunnerGame } from './game'
import { runnerMovementCue, runnerUsefulJumpWindow } from './movement-cues'

const comfortableMidi = 60
const epoch = 'movement-cue-proof'
const EPSILON = 1e-9

const variants = [
  ['responsive', SINGING_CURRENT_RESPONSIVE],
  ['current', SINGING_CURRENT_CURRENT],
  ['learning', SINGING_CURRENT_LEARNING],
] as const

function firstGap(course: CompiledRunnerCourse): CompiledRunnerGap {
  return courseGaps(course)[0]!
}

function courseGaps(
  course: CompiledRunnerCourse,
): readonly CompiledRunnerGap[] {
  return course.obstacles.filter(
    (obstacle): obstacle is CompiledRunnerGap => obstacle.kind === 'gap',
  )
}

function prepareGap(
  course: CompiledRunnerCourse,
  testedGap: CompiledRunnerGap,
  jumpCourseSeconds?: number,
) {
  const game = createSongRunnerGame(course, { comfortableMidi })
  expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
  const blocker = course.obstacles.find(
    (obstacle) => obstacle.kind === 'blocker',
  )!
  const laneAction = blocker.certifiedActions[0]!
  expect(
    game.input({
      epoch,
      sequence: 1,
      atCourseSeconds:
        (laneAction.launchOpenCourseSeconds +
          laneAction.launchCloseCourseSeconds) /
        2,
      action: 'lane-right',
    }),
  ).toBe(true)
  let sequence = 2
  for (const gap of courseGaps(course)) {
    if (
      gap.minCourseDistanceMeters >
      testedGap.minCourseDistanceMeters + EPSILON
    )
      break
    const jumpAction = gap.certifiedActions[0]!
    const atCourseSeconds =
      gap.id === testedGap.id
        ? jumpCourseSeconds
        : (jumpAction.launchOpenCourseSeconds +
            jumpAction.launchCloseCourseSeconds) /
          2
    if (atCourseSeconds === undefined) continue
    expect(
      game.input({
        epoch,
        sequence,
        atCourseSeconds,
        action: 'jump',
      }),
    ).toBe(true)
    sequence++
  }
  return game
}

function advanceAt60Hz(
  game: ReturnType<typeof createSongRunnerGame>,
  throughCourseSeconds: number,
): void {
  let next = game.snapshot().courseSeconds
  while (
    game.snapshot().status === 'running' &&
    next < throughCourseSeconds - EPSILON
  ) {
    next = Math.min(throughCourseSeconds, next + 1 / 60)
    game.advanceTo(epoch, next)
  }
}

describe('runner movement cues', () => {
  it.each(variants)(
    'keeps every sampled %s Jump cue inside the real game survival window',
    (_name, course) => {
      for (const gap of courseGaps(course)) {
        const useful = runnerUsefulJumpWindow(course, gap)!
        const samples = Array.from({ length: 7 }, (_, index) =>
          index === 6
            ? useful.launchCloseCourseSeconds
            : useful.launchOpenCourseSeconds +
              ((useful.launchCloseCourseSeconds -
                useful.launchOpenCourseSeconds) *
                index) /
                6,
        )

        for (const jumpCourseSeconds of samples) {
          const game = prepareGap(course, gap, jumpCourseSeconds)
          const certified = gap.certifiedActions[0]!

          advanceAt60Hz(
            game,
            certified.landingCloseCourseSeconds +
              course.movement.coyoteSeconds +
              0.5,
          )

          expect(game.snapshot().status, gap.id).toBe('running')
          expect(game.snapshot().player.grounded, gap.id).toBe(true)
        }
      }
    },
  )

  it.each(variants)(
    'gives the %s player a wider useful Jump cue than the full-foot certificate',
    (_name, course) => {
      for (const gap of courseGaps(course)) {
        const certified = gap.certifiedActions[0]!
        const useful = runnerUsefulJumpWindow(course, gap)!

        expect(useful.launchOpenCourseSeconds, gap.id).toBeLessThan(
          certified.launchOpenCourseSeconds,
        )
        expect(useful.launchCloseCourseSeconds, gap.id).toBeGreaterThan(
          certified.launchCloseCourseSeconds,
        )
        expect(
          useful.launchCloseCourseSeconds - useful.launchOpenCourseSeconds,
          gap.id,
        ).toBeGreaterThan(0.5)
      }
    },
  )

  it('opens the responsive Jump cue at least 0.8 seconds before its safe-window end', () => {
    for (const gap of courseGaps(SINGING_CURRENT_RESPONSIVE)) {
      const useful = runnerUsefulJumpWindow(SINGING_CURRENT_RESPONSIVE, gap)!
      expect(
        useful.launchCloseCourseSeconds - useful.launchOpenCourseSeconds,
        gap.id,
      ).toBeGreaterThanOrEqual(0.8)
    }
  })

  it('keeps Gap ahead, Jump, and Landing visible when the next note preview is active', () => {
    const course = SINGING_CURRENT_LEARNING
    const gap = firstGap(course)
    const useful = runnerUsefulJumpWindow(course, gap)!
    const game = prepareGap(course, gap)

    advanceAt60Hz(
      game,
      gap.telegraphFromCourseSeconds + course.movement.fixedStepSeconds * 2,
    )
    expect(runnerMovementCue(course, game.snapshot())?.stage).toBe('gap-ahead')

    advanceAt60Hz(
      game,
      (useful.launchOpenCourseSeconds + useful.launchCloseCourseSeconds) / 2,
    )
    expect(game.snapshot().activeTarget).not.toBeNull()
    expect(runnerMovementCue(course, game.snapshot())?.stage).toBe('jump')

    expect(
      game.input({
        epoch,
        sequence: 2,
        atCourseSeconds: game.snapshot().courseSeconds,
        action: 'jump',
      }),
    ).toBe(true)
    advanceAt60Hz(
      game,
      game.snapshot().courseSeconds + course.movement.fixedStepSeconds * 3,
    )
    expect(runnerMovementCue(course, game.snapshot())?.stage).toBe('landing')
  })
})
