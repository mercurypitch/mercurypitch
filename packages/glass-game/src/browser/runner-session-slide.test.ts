// Runner slide session — rejected airborne gestures cannot leave an invisible toggle latched.
import { expect, it } from 'vitest'
import { SLIDE_CONTINUOUS_STUDY } from '../runner/slide-study'
import { runnerSessionHarness } from './__fixtures__/runner-session'

it('rejects airborne starts, accepts releases, and permits a fresh press after landing', async () => {
  const h = runnerSessionHarness(SLIDE_CONTINUOUS_STUDY.course)
  await h.running()
  expect(h.session.input('jump')).toBe(true)
  h.courseTick(0.05)
  expect(h.session.state().game.player.grounded).toBe(false)
  expect(h.session.slide(true)).toBe(false)
  expect(h.session.slide(false)).toBe(true)
  for (let time = 0.1; time <= 2; time += 0.05) h.courseTick(time)
  expect(h.session.state().game.player.grounded).toBe(true)
  expect(h.session.slide(true)).toBe(true)
  for (let time = 2.05; time <= 2.4; time += 0.05) h.courseTick(time)
  expect(h.session.state().game.player.slide?.phase).toBe('sliding')
  h.session.dispose()
})

it('lowers and releases on the existing microphone and audio epoch', async () => {
  const h = runnerSessionHarness(SLIDE_CONTINUOUS_STUDY.course)
  await h.running()
  const epoch = h.session.state().game.epoch
  expect(h.session.slide(true)).toBe(true)
  for (let t = 0.05; t <= 0.3; t += 0.05) h.courseTick(t)
  expect(h.session.state().game.player.slide).toMatchObject({
    phase: 'sliding',
    bodyHeightMeters: 0.42,
  })
  expect(h.session.slide(false)).toBe(true)
  for (let t = 0.35; t <= 0.7; t += 0.05) h.courseTick(t)
  expect(h.session.state().game.player.slide?.phase).toBe('standing')
  expect(h.session.state().game.epoch).toBe(epoch)
  expect(h.host.createVoice).toHaveBeenCalledOnce()
  expect(h.host.createRunnerAudio).toHaveBeenCalledOnce()
  expect(h.voices[0]!.stop).not.toHaveBeenCalled()
  h.session.dispose()
  expect(h.session.slide(true)).toBe(false)
})

it.each(['pause', 'background', 'renderer'] as const)(
  'clears held slide across %s interruption and restart',
  async (reason) => {
    const h = runnerSessionHarness(SLIDE_CONTINUOUS_STUDY.course)
    await h.running()
    expect(h.session.slide(true)).toBe(true)
    for (let t = 0.05; t <= 0.3; t += 0.05) h.courseTick(t)
    expect(h.session.state().game.player.slide?.phase).toBe('sliding')
    if (reason === 'background') h.foreground(false)
    else if (reason === 'renderer') h.session.setPresentationReady(false)
    else h.session.pause()
    expect(h.session.state().phase).toBe('paused')
    expect(h.session.slide(true)).toBe(false)
    if (reason === 'background') h.foreground(true)
    h.session.setPresentationReady(true)
    await h.session.start()
    h.ready()
    h.tick(h.audio.at(-1)!.anchor!.audioStartSeconds)
    expect(h.session.state().phase).toBe('running')
    expect(h.session.state().game.player.slide?.phase).toBe('standing')
    h.session.dispose()
  },
)
