// Runner continuous session tests — steering uses capture time, shares action ordering, and cannot survive a restart.

import { describe, expect, it } from 'vitest'
import { SINGING_CURRENT_CONTINUOUS_TRIAL } from '../runner/first-course'
import { runnerSessionHarness } from './__fixtures__/runner-session'

describe('continuous runner session', () => {
  it('applies steering at its audio timestamp alongside discrete jump inputs', async () => {
    const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
    expect(h.session.steer(1)).toBe(false)
    await h.running()
    h.setAudioTime(h.audio[0]!.anchor!.audioStartSeconds + 0.1)
    expect(h.session.steer(1)).toBe(true)
    expect(h.session.state().game.player.lateralX).toBeCloseTo(0, 8)
    expect(h.session.input('jump')).toBe(true)
    h.courseTick(0.2)
    expect(h.session.state().game.player.lateralX).toBeGreaterThan(0.08)
    expect(h.session.state().game.player.grounded).toBe(false)
    expect(
      h.session.state().game.player.lateralVelocityMetersPerSecond,
    ).toBeGreaterThan(0)
    expect(h.session.steer(0)).toBe(true)
    h.courseTick(0.3)
    expect(h.session.state().game.player.lateralVelocityMetersPerSecond).toBe(0)
    h.session.dispose()
  })

  it.each([NaN, Infinity, -Infinity, -1.01, 1.01])(
    'rejects invalid axis %s without moving Merc',
    async (axis) => {
      const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
      await h.running()
      expect(h.session.steer(axis)).toBe(false)
      h.courseTick(0.2)
      expect(h.session.state().game.player.lateralX).toBe(0)
      h.session.dispose()
    },
  )

  it.each(['pause', 'background', 'renderer'] as const)(
    'clears held steering on %s and resumes at the safe checkpoint',
    async (interruption) => {
      const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
      await h.running()
      h.session.steer(-1)
      h.courseTick(0.2)
      expect(h.session.state().game.player.lateralX).toBeLessThan(-0.2)
      if (interruption === 'pause') h.session.pause()
      else if (interruption === 'background') h.foreground(false)
      else h.session.setPresentationReady(false)
      expect(h.session.state().phase).toBe('paused')
      expect(h.session.steer(1)).toBe(false)
      expect(h.session.state().game.player.lateralVelocityMetersPerSecond).toBe(
        0,
      )
      if (interruption === 'background') h.foreground(true)
      if (interruption === 'renderer') h.session.setPresentationReady(true)
      await h.session.resume()
      h.ready()
      h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
      h.courseTick(0.2)
      expect(h.session.state().game.player.lateralX).toBe(0)
      expect(h.session.state().game.player.lateralVelocityMetersPerSecond).toBe(
        0,
      )
      h.session.dispose()
      expect(h.session.steer(-1)).toBe(false)
    },
  )

  it('leaves the lane comparison unchanged and enters recovery for a large clock gap', async () => {
    const lane = runnerSessionHarness()
    await lane.running()
    expect(lane.session.steer(1)).toBe(false)
    expect(lane.session.input('lane-left')).toBe(true)
    lane.session.dispose()

    const continuous = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
    await continuous.running()
    continuous.setAudioTime(continuous.clock() + 1)
    expect(continuous.session.steer(1)).toBe(false)
    expect(continuous.session.state().phase).toBe('recovering')
    continuous.session.dispose()
  })
})
