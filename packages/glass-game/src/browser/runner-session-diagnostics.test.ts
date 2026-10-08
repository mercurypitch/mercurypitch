// Runner recovery diagnostics — retain the clock and last steering facts before recovery clears motion.
import { afterEach, expect, it, vi } from 'vitest'
import { SINGING_CURRENT_CONTINUOUS_TRIAL } from '../runner/first-course'
import { runnerSessionHarness } from './__fixtures__/runner-session'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it.each(['frame', 'capture', 'input'] as const)(
  'records a %s-detected stall before neutralizing steering, without recording voice data',
  async (source) => {
    vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
    vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    let wall = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => wall)
    const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
    await h.running()
    h.session.steer(1)
    wall += 100
    h.courseTick(0.1)
    expect(warn).not.toHaveBeenCalled()
    expect(
      h.session.state().game.player.lateralVelocityMetersPerSecond,
    ).toBeGreaterThan(0)
    wall += 400
    const delayed = h.clock() + 0.4
    if (source === 'frame') h.tick(delayed)
    else if (source === 'capture') h.emit(delayed, 73)
    else {
      h.setAudioTime(delayed)
      expect(h.session.steer(0)).toBe(false)
    }
    expect(h.session.state().phase).toBe('recovering')
    expect(h.session.state().game.player.lateralVelocityMetersPerSecond).toBe(0)
    expect(warn).toHaveBeenCalledWith(
      '[Glassworks runner recovery]',
      expect.objectContaining({
        reason: 'frame-gap',
        source,
        audioGapMs: 400,
        wallGapMs: 400,
        presentationAgeMs: 400,
        catchUpLimitMs: 250,
        steeringAxis: 1,
      }),
    )
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /midi|confidence|samples|deviceId|73/,
    )
    h.tick(delayed + 1)
    expect(warn).toHaveBeenCalledOnce()
    h.session.dispose()
  },
)

it('keeps non-portable builds quiet', async () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'false')
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
  await h.running()
  h.session.steer(1)
  h.courseTick(0.1)
  h.tick(h.clock() + 0.4)
  expect(h.session.state().phase).toBe('recovering')
  expect(warn).not.toHaveBeenCalled()
  h.session.dispose()
})

it('separates an audio-clock jump from callback delay and resets steering on resume', async () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  let wall = 1000
  vi.spyOn(performance, 'now').mockImplementation(() => wall)
  const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
  await h.running()
  h.session.steer(-1)
  wall += 10
  h.tick(h.clock() + 0.4)
  expect(warn).toHaveBeenLastCalledWith(
    '[Glassworks runner recovery]',
    expect.objectContaining({
      audioGapMs: 400,
      wallGapMs: 10,
      presentationAgeMs: 10,
      steeringAxis: -1,
    }),
  )
  await h.session.resume()
  h.ready()
  wall += 1000
  h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
  wall += 100
  h.emit(h.clock() + 0.1)
  wall += 400
  h.emit(h.clock() + 0.4)
  expect(warn).toHaveBeenLastCalledWith(
    '[Glassworks runner recovery]',
    expect.objectContaining({
      source: 'capture',
      audioGapMs: 400,
      wallGapMs: 400,
      presentationAgeMs: 500,
      steeringAxis: 0,
      steeringAgeMs: null,
    }),
  )
  h.session.dispose()
})

it('bounds recovery reports across repeated resumes without disabling recovery', async () => {
  vi.stubEnv('VITE_PORTABLE_CONSOLE', 'true')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const h = runnerSessionHarness(SINGING_CURRENT_CONTINUOUS_TRIAL)
  await h.running()
  for (let attempt = 0; attempt < 10; attempt++) {
    h.tick(h.clock() + 0.4)
    expect(h.session.state().phase).toBe('recovering')
    if (attempt < 9) {
      await h.session.resume()
      h.ready()
      h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
    }
  }
  expect(warn).toHaveBeenCalledTimes(8)
  h.session.dispose()
})
