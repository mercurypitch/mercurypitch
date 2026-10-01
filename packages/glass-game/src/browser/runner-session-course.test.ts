// Authored runner session traces cover the complete course and explicit recovery from a real missed jump.
import { describe, expect, it } from 'vitest'
import type { RunnerEvent, RunnerInput } from '../runner/contracts'
import { SINGING_CURRENT } from '../runner/first-course'
import { runnerTargetMidiAt } from '../runner/pitch'
import { runnerSessionHarness } from './__fixtures__/runner-session'

type Harness = ReturnType<typeof runnerSessionHarness>
const course = SINGING_CURRENT
const EPSILON = 1e-8

function movementActions(): {
  id: string
  at: number
  action: RunnerInput['action']
}[] {
  return [
    'first-lane-gate',
    'first-jump',
    'second-lane-gate',
    'second-jump',
  ].map((id) => {
    const obstacle = course.obstacles.find((item) => item.id === id)!
    const certified = obstacle.certifiedActions[0]!
    return {
      id,
      at:
        (certified.launchOpenCourseSeconds +
          certified.launchCloseCourseSeconds) /
        2,
      action: id.endsWith('lane-gate') ? 'lane-right' : 'jump',
    }
  })
}

function trace(h: Harness, omittedJump?: string): void {
  const anchor = h.audio.at(-1)!.anchor!
  const start = anchor.courseStartSeconds
  const actions = movementActions().filter(
    (item) => item.at > start && item.id !== omittedJump,
  )
  let actionIndex = 0
  let frameSeconds = start + 1 / 60
  let captureSeconds = start + 1024 / 48_000
  const latency = 0.025
  while (h.session.state().phase === 'running') {
    const frame = Math.min(frameSeconds, course.lengthCourseSeconds)
    const action = actions[actionIndex]
    const actionAt = action?.at ?? Infinity
    const captureAt = captureSeconds + latency
    const next = Math.min(frame, actionAt, captureAt)
    const audioTime = anchor.audioStartSeconds + next - start
    if (next === actionAt) {
      h.setAudioTime(audioTime)
      expect(h.session.input(action!.action)).toBe(true)
      actionIndex++
    } else if (next === captureAt) {
      const target = course.targets.find(
        (item) =>
          captureSeconds >= item.onsetCourseSeconds &&
          captureSeconds <= item.endCourseSeconds,
      )
      const midi =
        target === undefined
          ? null
          : runnerTargetMidiAt(target.notes, captureSeconds, 60)
      h.emit(anchor.audioStartSeconds + captureSeconds - start, midi, latency)
      captureSeconds += 1024 / 48_000
    } else {
      h.tick(audioTime)
      frameSeconds += 1 / 60
      if (next >= course.lengthCourseSeconds - EPSILON) break
    }
  }
}

describe('authored runner session course', () => {
  it('finishes all 90.88 seconds with one capture, eight judged hits, and a saved portrait', async () => {
    const h = runnerSessionHarness(course)
    const events: RunnerEvent[] = []
    h.session.subscribe((frame) => events.push(...frame.events))
    await h.running()
    trace(h)
    expect(h.session.state()).toMatchObject({
      phase: 'finished',
      microphone: 'closed',
      game: { status: 'finished', courseSeconds: course.lengthCourseSeconds },
    })
    expect(h.session.state().game.resolvedTargets).toHaveLength(8)
    expect(
      h.session
        .state()
        .game.resolvedTargets.every((item) => item.outcome === 'hit'),
    ).toBe(true)
    expect(
      events.filter((event) => event.type === 'recovery-required'),
    ).toEqual([])
    expect(
      events.filter((event) => event.type === 'course-finished'),
    ).toHaveLength(1)
    expect(h.host.createVoice).toHaveBeenCalledOnce()
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(h.frames.size).toBe(0)
    expect(h.host.saveRunnerProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completed: true,
        collectedRewardIds: expect.arrayContaining(['portrait-first-song-run']),
      }),
    )
    h.session.dispose()
  })

  it('waits after a real fall, then resumes through fresh readiness and count-in at the certified checkpoint', async () => {
    const h = runnerSessionHarness(course)
    const events: RunnerEvent[] = []
    h.session.subscribe((frame) => events.push(...frame.events))
    await h.running()
    const oldEpoch = h.session.state().game.epoch
    trace(h, 'second-jump')
    const fallen = h.session.state().game
    expect(h.session.state()).toMatchObject({
      phase: 'recovering',
      microphone: 'closed',
      game: { status: 'recovering', recoveryCheckpointId: 'tempo-step' },
    })
    expect(events.at(-1)).toMatchObject({
      type: 'recovery-required',
      reason: 'fall',
    })
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(h.frames.size).toBe(0)
    h.tick(h.clock() + 1)
    expect(h.session.state().phase).toBe('recovering')
    expect(h.host.createVoice).toHaveBeenCalledOnce()

    await h.session.resume()
    expect(h.session.state().phase).toBe('readiness')
    expect(h.session.state().game.epoch).toBe(oldEpoch)
    h.ready()
    expect(h.session.state().phase).toBe('count-in')
    const anchor = h.audio.at(-1)!.anchor!
    expect(anchor).toMatchObject({
      courseStartSeconds: 40,
      countInBeats: 4,
      secondsPerBeat: 60 / 108,
    })
    h.tick(anchor.audioStartSeconds)
    expect(h.session.state().game.epoch).not.toBe(oldEpoch)
    expect(h.session.state().game.courseSeconds).toBe(40)
    expect(h.session.state().game.collectedRewardIds).toEqual(
      fallen.collectedRewardIds,
    )
    const settled = course.targets
      .filter((target) => target.settleAfterCourseSeconds <= 40)
      .map((target) => target.id)
    expect(
      h.session.state().game.resolvedTargets.map((target) => target.targetId),
    ).toEqual(settled)
    h.emit(h.clock() + 0.01, 60, 0, h.voices[0]!)
    expect(h.session.state().game.courseSeconds).toBe(40)
    trace(h)
    expect(h.session.state().phase).toBe('finished')
    expect(
      h.session
        .state()
        .game.resolvedTargets.every((item) => item.outcome === 'hit'),
    ).toBe(true)
    expect(
      events.filter((event) => event.type === 'recovery-required'),
    ).toHaveLength(1)
    expect(h.host.createVoice).toHaveBeenCalledTimes(2)
    h.session.dispose()
  })
})
