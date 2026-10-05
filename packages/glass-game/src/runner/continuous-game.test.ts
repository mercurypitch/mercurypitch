// Continuous runner integration tests — fixed-clock input, epochs, recovery and save isolation.

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse } from './contracts'
import { SINGING_CURRENT, SINGING_CURRENT_CONTINUOUS_TRIAL, } from './first-course'
import { createSongRunnerGame } from './game'

const course = {
  ...SINGING_CURRENT_CONTINUOUS_TRIAL,
  obstacles: [],
} satisfies CompiledRunnerCourse

function sample(hz: number) {
  const game = createSongRunnerGame(course, { comfortableMidi: 60 })
  game.beginEpoch('test')
  game.input({
    epoch: 'test',
    sequence: 1,
    atCourseSeconds: 0,
    action: 'steer',
    axis: 0.5,
  })
  game.input({
    epoch: 'test',
    sequence: 2,
    atCourseSeconds: 0.375,
    action: 'steer',
    axis: -0.5,
  })
  game.input({
    epoch: 'test',
    sequence: 3,
    atCourseSeconds: 0.85,
    action: 'steer',
    axis: 0,
  })
  game.input({
    epoch: 'test',
    sequence: 4,
    atCourseSeconds: 0.925,
    action: 'jump',
  })
  for (let i = 1; i <= hz * 2; i++) game.advanceTo('test', i / hz)
  return game.snapshot()
}

describe('continuous runner game', () => {
  it.each([10, 20, 30, 60, 120])(
    'produces identical travel and jump at %s Hz without consuming fractional time',
    (hz) => {
      const snapshot = sample(hz)
      const reference = sample(120)
      expect(snapshot.status).toBe('running')
      expect(snapshot.courseSeconds).toBeCloseTo(2, 9)
      expect(snapshot.player).toEqual(reference.player)
      expect(snapshot.player.lateralX).toBeCloseTo(
        0.78125 - 0.5625 - 2.5 ** 2 / 56,
        9,
      )
      expect(snapshot.player.lateralVelocityMetersPerSecond).toBe(0)
      expect(snapshot.player.feetY).toBeGreaterThan(course.groundFeetY)
    },
  )

  it('rejects malformed, stale or lane input for the continuous solver and coalesces same-tick steering', () => {
    const game = createSongRunnerGame(course, { comfortableMidi: 60 })
    game.beginEpoch('current')
    const stamp = { epoch: 'current', sequence: 1, atCourseSeconds: 0 }
    for (const axis of [NaN, Infinity, -Infinity, 1.01, -1.01])
      expect(game.input({ ...stamp, action: 'steer', axis })).toBe(false)
    expect(
      game.input({ ...stamp, epoch: 'old', action: 'steer', axis: 1 }),
    ).toBe(false)
    expect(game.input({ ...stamp, action: 'lane-right' })).toBe(false)
    expect(game.input({ ...stamp, action: 'steer', axis: 1 })).toBe(true)
    expect(
      game.input({ ...stamp, sequence: 2, action: 'steer', axis: -1 }),
    ).toBe(true)
    expect(
      game.input({ ...stamp, sequence: 3, action: 'steer', axis: 0 }),
    ).toBe(true)
    game.advanceTo('current', 0.1)
    expect(game.snapshot().player.lateralX).toBe(0)
    const lane = createSongRunnerGame(SINGING_CURRENT, { comfortableMidi: 60 })
    lane.beginEpoch('current')
    expect(lane.input({ ...stamp, action: 'steer', axis: 1 })).toBe(false)
  })

  it('resets held axis, velocity and queued future input on pause, checkpoint preparation and new epoch', () => {
    const shifted = { ...course, laneCenters: [-2.4, -0.1, 1.5] as const }
    const game = createSongRunnerGame(shifted, { comfortableMidi: 60 })
    game.beginEpoch('one')
    game.input({
      epoch: 'one',
      sequence: 1,
      atCourseSeconds: 0,
      action: 'steer',
      axis: 1,
    })
    game.input({
      epoch: 'one',
      sequence: 2,
      atCourseSeconds: 0.2,
      action: 'steer',
      axis: -1,
    })
    game.advanceTo('one', 0.1)
    expect(
      game.snapshot().player.lateralVelocityMetersPerSecond,
    ).toBeGreaterThan(0)
    game.pause()
    expect(game.snapshot().player.lateralVelocityMetersPerSecond).toBe(0)
    game.prepareCheckpoint('start')
    expect(game.snapshot().player.lateralX).toBe(-0.1)
    game.beginEpoch('two', 'start')
    for (const t of [0.1, 0.2, 0.3]) game.advanceTo('two', t)
    expect(game.snapshot().player.lateralX).toBe(-0.1)
    expect(game.snapshot().player.grounded).toBe(true)
    expect(
      game.input({
        epoch: 'one',
        sequence: 3,
        atCourseSeconds: 0.3,
        action: 'steer',
        axis: 1,
      }),
    ).toBe(false)
  })

  it('clears motion on frame-gap recovery and cannot reuse that epoch', () => {
    const game = createSongRunnerGame(course, { comfortableMidi: 60 })
    game.beginEpoch('one')
    game.input({
      epoch: 'one',
      sequence: 1,
      atCourseSeconds: 0,
      action: 'steer',
      axis: 1,
    })
    game.advanceTo('one', 0.1)
    game.advanceTo('one', 1)
    expect(game.snapshot().status).toBe('recovering')
    expect(game.snapshot().player.lateralVelocityMetersPerSecond).toBe(0)
    expect(game.beginEpoch('one', 'start')).toEqual({
      ok: false,
      reason: 'epoch-reused',
    })
    game.beginEpoch('two', 'start')
    game.advanceTo('two', 0.2)
    expect(game.snapshot().player.lateralX).toBe(0)
  })

  it('keeps authentic accepted-course quality/rewards untouched across A to B to A', () => {
    const a = createSongRunnerGame(SINGING_CURRENT, {
      comfortableMidi: 60,
    }).saveProgress()
    const existing = {
      ...a,
      completed: true,
      collectedRewardIds: SINGING_CURRENT.rewards.finishRewardIds,
    }
    const b = createSongRunnerGame(course, {
      comfortableMidi: 60,
      progress: existing,
    }).saveProgress()
    expect(b.completed).toBe(false)
    expect(b.collectedRewardIds).toEqual([])
    expect(b.courseId).toBe(course.id)
    expect(
      createSongRunnerGame(SINGING_CURRENT, {
        comfortableMidi: 60,
        progress: existing,
      }).saveProgress(),
    ).toEqual(existing)
  })

  it('rejects a continuous capability labelled as a legacy compiled course', () => {
    expect(() =>
      createSongRunnerGame({ ...course, version: 1 }, { comfortableMidi: 60 }),
    ).toThrow('valid compiled course')
    expect(() =>
      createSongRunnerGame(
        { ...SINGING_CURRENT, version: 2 },
        { comfortableMidi: 60 },
      ),
    ).toThrow('valid compiled course')
  })

  it.each([1, 2, 3])(
    'rejects an unknown movement capability at compiled version %s',
    (version) => {
      const unsupported = {
        ...course,
        version,
        movement: { ...course.movement, kind: 'flying' },
      } as unknown as CompiledRunnerCourse
      expect(() =>
        createSongRunnerGame(unsupported, { comfortableMidi: 60 }),
      ).toThrow('valid compiled course')
    },
  )
})
