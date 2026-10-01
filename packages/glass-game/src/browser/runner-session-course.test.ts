// Authored runner session traces cover both paces, all rewards, and both later recoveries.
import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse, RunnerEvent, RunnerInput, } from '../runner/contracts'
import { SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, } from '../runner/first-course'
import { runnerTargetMidiAt } from '../runner/pitch'
import { runnerBeatToSeconds } from '../runner/tempo'
import { runnerSessionHarness } from './__fixtures__/runner-session'

type Harness = ReturnType<typeof runnerSessionHarness>
interface ScheduledAction {
  readonly id: string
  readonly at: number
  readonly action: RunnerInput['action']
}

const EPSILON = 1e-8
const pacingVariants = [
  { name: 'current', course: SINGING_CURRENT_CURRENT },
  { name: 'learning', course: SINGING_CURRENT_LEARNING },
] as const

function obstacleActions(course: CompiledRunnerCourse): ScheduledAction[] {
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

function pickupActions(course: CompiledRunnerCourse): ScheduledAction[] {
  const pickup = (id: string) =>
    course.rewards.pickups.find((candidate) => candidate.id === id)!
      .courseSeconds
  const lane = course.movement.laneChangeSeconds
  const firstLeft = pickup('pearl-left-60')
  const laterRight = pickup('pearl-right-114')
  return [
    {
      id: 'approach-pearl-left-60-a',
      at: firstLeft - 2 * lane - 0.2,
      action: 'lane-left',
    },
    {
      id: 'approach-pearl-left-60-b',
      at: firstLeft - lane - 0.1,
      action: 'lane-left',
    },
    {
      id: 'approach-pearl-right-62-a',
      at: firstLeft + 0.1,
      action: 'lane-right',
    },
    {
      id: 'approach-pearl-right-62-b',
      at: firstLeft + lane + 0.2,
      action: 'lane-right',
    },
    {
      id: 'approach-pearl-left-118-a',
      at: laterRight + 0.1,
      action: 'lane-left',
    },
    {
      id: 'approach-pearl-left-118-b',
      at: laterRight + lane + 0.2,
      action: 'lane-left',
    },
  ]
}

function movementActions(course: CompiledRunnerCourse): ScheduledAction[] {
  return [...obstacleActions(course), ...pickupActions(course)].sort(
    (left, right) => left.at - right.at,
  )
}

function trace(
  h: Harness,
  options: {
    readonly omitAction?: string
    readonly throughCourseSeconds?: number
  } = {},
): void {
  const course = h.course
  const anchor = h.audio.at(-1)!.anchor!
  const start = anchor.courseStartSeconds
  const finish = Math.min(
    options.throughCourseSeconds ?? course.lengthCourseSeconds,
    course.lengthCourseSeconds,
  )
  const actions = movementActions(course).filter(
    (item) =>
      item.at > start + EPSILON &&
      item.at <= finish + EPSILON &&
      item.id !== options.omitAction,
  )
  let actionIndex = 0
  let frameSeconds = start + 1 / 60
  let captureSeconds = start + 1024 / 48_000
  const latency = 0.025
  while (h.session.state().phase === 'running') {
    const frame = Math.min(frameSeconds, finish)
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
      if (next >= finish - EPSILON) break
      frameSeconds += 1 / 60
    }
  }
}

function expectAllCourseRewards(
  course: CompiledRunnerCourse,
  collectedRewardIds: readonly string[],
  includeFinish = true,
): void {
  const pickupIds = course.rewards.pickups.map((pickup) => pickup.id)
  expect(
    collectedRewardIds.filter((rewardId) => pickupIds.includes(rewardId)),
  ).toEqual([...pickupIds].sort())
  if (includeFinish)
    expect(collectedRewardIds).toEqual(
      expect.arrayContaining([...pickupIds, ...course.rewards.finishRewardIds]),
    )
}

function expectPerfectTargets(course: CompiledRunnerCourse, h: Harness): void {
  const results = h.session.state().game.resolvedTargets
  expect(results).toHaveLength(8)
  expect(results.every((item) => item.outcome === 'hit')).toBe(true)
  expect(results.reduce((total, item) => total + (item.grade ?? 0), 0)).toBe(24)
  expect(
    h.session
      .state()
      .game.bestTargetQualities.reduce(
        (total, quality) => total + quality.grade,
        0,
      ),
  ).toBe(24)
  expect(
    h.session.state().game.resolvedTargets.map((result) => result.targetId),
  ).toEqual(course.targets.map((target) => target.id))
}

async function resumeAt(
  h: Harness,
  checkpointId: string,
  previousEpoch: string | null,
): Promise<void> {
  const checkpoint = h.course.checkpoints.find(
    (candidate) => candidate.id === checkpointId,
  )!
  await h.session.resume()
  expect(h.session.state().phase).toBe('readiness')
  expect(h.session.state().game.epoch).toBe(previousEpoch)
  h.ready()
  expect(h.session.state().phase).toBe('count-in')
  const anchor = h.audio.at(-1)!.anchor!
  const tempo = h.course.tempoSegments.find(
    (segment) =>
      checkpoint.beat >= segment.startBeat && checkpoint.beat < segment.endBeat,
  )!
  expect(anchor).toMatchObject({
    courseStartSeconds: checkpoint.courseSeconds,
    countInBeats: checkpoint.countInBeats,
    secondsPerBeat: 60 / tempo.bpm,
  })
  h.tick(anchor.audioStartSeconds)
  expect(h.session.state().phase).toBe('running')
  expect(h.session.state().game.epoch).not.toBe(previousEpoch)
  expect(h.session.state().game.courseSeconds).toBeCloseTo(
    checkpoint.courseSeconds,
    12,
  )
}

describe.each(pacingVariants)('$name authored runner session', ({ course }) => {
  it('finishes with one capture, 8/8 targets, 24 stars, four pickups, and a saved portrait', async () => {
    const h = runnerSessionHarness(course)
    const events: RunnerEvent[] = []
    h.session.subscribe((frame) => events.push(...frame.events))
    await h.running()
    const start = course.checkpoints[0]!
    expect(h.audio[0]!.anchor).toMatchObject({
      courseStartSeconds: start.courseSeconds,
      countInBeats: start.countInBeats,
      secondsPerBeat: 60 / course.tempoSegments[0]!.bpm,
    })
    trace(h)
    expect(h.session.state()).toMatchObject({
      phase: 'finished',
      microphone: 'closed',
      game: { status: 'finished', courseSeconds: course.lengthCourseSeconds },
    })
    expectPerfectTargets(course, h)
    expectAllCourseRewards(course, h.session.state().game.collectedRewardIds)
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
        courseId: course.id,
        courseRevision: course.revision,
        completed: true,
        collectedRewardIds: expect.arrayContaining([
          ...course.rewards.pickups.map((pickup) => pickup.id),
          'portrait-first-song-run',
        ]),
      }),
    )
    h.session.dispose()
  })

  it('resumes a missed second jump at the tempo-step checkpoint with a fresh epoch', async () => {
    const h = runnerSessionHarness(course)
    const events: RunnerEvent[] = []
    h.session.subscribe((frame) => events.push(...frame.events))
    await h.running()
    const oldEpoch = h.session.state().game.epoch
    trace(h, { omitAction: 'second-jump' })
    const fallen = h.session.state().game
    expect(h.session.state()).toMatchObject({
      phase: 'recovering',
      microphone: 'closed',
      game: { status: 'recovering', recoveryCheckpointId: 'tempo-step' },
    })
    expect(events.at(-1)).toMatchObject({
      type: 'recovery-required',
      reason: 'fall',
      checkpointId: 'tempo-step',
    })
    expect(h.voices[0]!.stop).toHaveBeenCalledOnce()
    expect(h.frames.size).toBe(0)
    h.tick(h.clock() + 1)
    expect(h.session.state().phase).toBe('recovering')
    expect(h.host.createVoice).toHaveBeenCalledOnce()

    await resumeAt(h, 'tempo-step', oldEpoch)
    expect(h.session.state().game.collectedRewardIds).toEqual(
      fallen.collectedRewardIds,
    )
    const checkpoint = course.checkpoints.find(
      (candidate) => candidate.id === 'tempo-step',
    )!
    expect(
      h.session.state().game.resolvedTargets.map((target) => target.targetId),
    ).toEqual(
      course.targets
        .filter(
          (target) =>
            target.settleAfterCourseSeconds <=
            checkpoint.courseSeconds + EPSILON,
        )
        .map((target) => target.id),
    )
    h.emit(h.clock() + 0.01, 60, 0, h.voices[0]!)
    expect(h.session.state().game.courseSeconds).toBeCloseTo(
      checkpoint.courseSeconds,
      12,
    )
    trace(h)
    expect(h.session.state().phase).toBe('finished')
    expectPerfectTargets(course, h)
    expectAllCourseRewards(course, h.session.state().game.collectedRewardIds)
    expect(
      events.filter((event) => event.type === 'recovery-required'),
    ).toHaveLength(1)
    expect(h.host.createVoice).toHaveBeenCalledTimes(2)
    expect(h.host.saveRunnerProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        courseRevision: course.revision,
        completed: true,
      }),
    )
    h.session.dispose()
  })

  it('resumes a later frame gap at the melody checkpoint with prior rewards intact', async () => {
    const h = runnerSessionHarness(course)
    const events: RunnerEvent[] = []
    h.session.subscribe((frame) => events.push(...frame.events))
    await h.running()
    const stopCourseSeconds = runnerBeatToSeconds(course.tempoSegments, 130)
    trace(h, { throughCourseSeconds: stopCourseSeconds })
    const beforeGap = h.session.state().game
    expect(beforeGap.lastCheckpointId).toBe('melody')
    expectAllCourseRewards(course, beforeGap.collectedRewardIds, false)
    const oldEpoch = beforeGap.epoch
    h.tick(h.clock() + course.movement.maxCatchUpSeconds + 0.02)
    expect(h.session.state()).toMatchObject({
      phase: 'recovering',
      microphone: 'closed',
      game: { status: 'recovering', recoveryCheckpointId: 'melody' },
    })
    expect(events.at(-1)).toMatchObject({
      type: 'recovery-required',
      reason: 'frame-gap',
      checkpointId: 'melody',
    })
    await resumeAt(h, 'melody', oldEpoch)
    expect(h.session.state().game.collectedRewardIds).toEqual(
      beforeGap.collectedRewardIds,
    )
    trace(h)
    expect(h.session.state().phase).toBe('finished')
    expectPerfectTargets(course, h)
    expectAllCourseRewards(course, h.session.state().game.collectedRewardIds)
    expect(
      events.filter((event) => event.type === 'recovery-required'),
    ).toHaveLength(1)
    expect(h.host.createVoice).toHaveBeenCalledTimes(2)
    expect(h.host.saveRunnerProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({
        courseRevision: course.revision,
        completed: true,
      }),
    )
    h.session.dispose()
  })
})
