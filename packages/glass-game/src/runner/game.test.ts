// ============================================================
// Song runner game tests — deterministic epochs, evidence, recovery, and rewards.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerCourse, RunnerEvent, RunnerInput, RunnerSnapshot, RunnerVoiceEvidence, SavedRunnerProgress, SongRunnerGame, } from './contracts'
import { SINGING_CURRENT, SINGING_CURRENT_CURRENT, SINGING_CURRENT_LEARNING, } from './first-course'
import { runnerFixedStepActionEnd } from './fixed-step'
import { createSongRunnerGame } from './game'
import { runnerTargetMidiAt } from './pitch'
import { runnerBeatToSeconds } from './tempo'

const course = SINGING_CURRENT
const comfortableMidi = 60
const epoch = 'flight-one'
const EPSILON = 1e-9

const pacingVariants: readonly {
  name: string
  course: CompiledRunnerCourse
}[] = [
  { name: 'current', course: SINGING_CURRENT_CURRENT },
  { name: 'learning', course: SINGING_CURRENT_LEARNING },
]

const certifiedEndpointCases = pacingVariants.flatMap(({ name, course }) =>
  (['open', 'close'] as const).map((endpoint) => ({
    name,
    course,
    endpoint,
  })),
)

interface TraceResult {
  readonly game: SongRunnerGame
  readonly snapshot: RunnerSnapshot
  readonly events: readonly RunnerEvent[]
  readonly progress: SavedRunnerProgress
}

function actionTime(obstacleId: string): number {
  const obstacle = course.obstacles.find(
    (candidate) => candidate.id === obstacleId,
  )!
  const action = obstacle.certifiedActions[0]!
  return (action.launchOpenCourseSeconds + action.launchCloseCourseSeconds) / 2
}

function safeInputs(activeEpoch = epoch): readonly RunnerInput[] {
  return [
    {
      epoch: activeEpoch,
      sequence: 1,
      atCourseSeconds: actionTime('first-lane-gate'),
      action: 'lane-right',
    },
    {
      epoch: activeEpoch,
      sequence: 2,
      atCourseSeconds: actionTime('first-jump'),
      action: 'jump',
    },
    {
      epoch: activeEpoch,
      sequence: 3,
      atCourseSeconds: actionTime('second-jump'),
      action: 'jump',
    },
  ]
}

function perfectEvidence(activeEpoch = epoch): readonly RunnerVoiceEvidence[] {
  const rootMidi = comfortableMidi + course.voice.comfortableRootOffsetSemitones
  let sequence = 0
  const result: RunnerVoiceEvidence[] = []
  for (const target of course.targets) {
    for (const note of target.notes) {
      const step = Math.min(
        course.voice.judge.maximumEvidenceGapSeconds / 2,
        (note.endCourseSeconds - note.startCourseSeconds) / 10,
      )
      const captures: number[] = []
      for (
        let capture = note.startCourseSeconds;
        capture < note.endCourseSeconds - 1e-6;
        capture += step
      )
        captures.push(capture)
      captures.push(note.endCourseSeconds - 1e-6)
      for (const captureCourseSeconds of captures) {
        result.push({
          epoch: activeEpoch,
          sequence: sequence++,
          captureCourseSeconds,
          receivedCourseSeconds: captureCourseSeconds + 0.02,
          midi: runnerTargetMidiAt(
            target.notes,
            captureCourseSeconds,
            rootMidi,
          ),
          confidence: 1,
        })
      }
    }
  }
  return result
}

function runTrace(
  framesPerSecond: 30 | 60 | 120,
  options: {
    readonly evidence?: readonly RunnerVoiceEvidence[]
    readonly stopCourseSeconds?: number
    readonly progress?: unknown
  } = {},
): TraceResult {
  const game = createSongRunnerGame(course, {
    comfortableMidi,
    progress: options.progress,
  })
  expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
  for (const input of safeInputs()) expect(game.input(input)).toBe(true)
  const observations = options.evidence ?? []
  const stopCourseSeconds =
    options.stopCourseSeconds ?? course.lengthCourseSeconds
  let observationIndex = 0
  let frameIndex = 1
  let requestedCourseSeconds = 0
  while (
    game.snapshot().status === 'running' &&
    requestedCourseSeconds < stopCourseSeconds - EPSILON
  ) {
    const nextFrame = Math.min(stopCourseSeconds, frameIndex / framesPerSecond)
    const observation = observations[observationIndex]
    if (
      observation !== undefined &&
      observation.receivedCourseSeconds <= nextFrame + EPSILON &&
      observation.receivedCourseSeconds <= stopCourseSeconds + EPSILON
    ) {
      expect(game.observe(observation)).toBe(true)
      game.advanceTo(epoch, observation.receivedCourseSeconds)
      requestedCourseSeconds = observation.receivedCourseSeconds
      observationIndex++
    } else {
      game.advanceTo(epoch, nextFrame)
      requestedCourseSeconds = nextFrame
      frameIndex++
    }
  }
  return {
    game,
    snapshot: game.snapshot(),
    events: game.drainEvents(),
    progress: game.saveProgress(),
  }
}

function advanceInFrames(
  game: SongRunnerGame,
  activeEpoch: string,
  throughCourseSeconds: number,
): void {
  let requestedCourseSeconds = game.snapshot().courseSeconds
  while (
    game.snapshot().status === 'running' &&
    requestedCourseSeconds < throughCourseSeconds - EPSILON
  ) {
    requestedCourseSeconds = Math.min(
      throughCourseSeconds,
      requestedCourseSeconds + 1 / 60,
    )
    game.advanceTo(activeEpoch, requestedCourseSeconds)
  }
}

describe('song runner game', () => {
  it('populates initial chunks before an epoch begins', () => {
    const game = createSongRunnerGame(course, { comfortableMidi })
    const snapshot = game.snapshot()
    expect(snapshot.status).toBe('ready')
    expect(snapshot.activeChunkId).toBe(course.chunks[0]!.id)
    expect(snapshot.residentChunkIds).toEqual(
      course.chunks.slice(0, 2).map((chunk) => chunk.id),
    )
    expect(snapshot.activeTarget?.id).toBe(course.targets[0]!.id)
  })

  it('produces identical full-course state and events at 30, 60, and 120 Hz', () => {
    const observations = perfectEvidence()
    const thirty = runTrace(30, { evidence: observations })
    const sixty = runTrace(60, { evidence: observations })
    const oneTwenty = runTrace(120, { evidence: observations })
    expect(thirty.snapshot).toEqual(sixty.snapshot)
    expect(sixty.snapshot).toEqual(oneTwenty.snapshot)
    expect(thirty.events).toEqual(sixty.events)
    expect(sixty.events).toEqual(oneTwenty.events)
    expect(thirty.progress).toEqual(sixty.progress)
    expect(sixty.progress).toEqual(oneTwenty.progress)
    expect(thirty.snapshot.status).toBe('finished')
    expect(thirty.snapshot.resolvedTargets).toHaveLength(course.targets.length)
    expect(
      thirty.snapshot.resolvedTargets.every((result) => result.grade === 3),
    ).toBe(true)
  })

  it('finishes at the authored endpoint with zero hits and awards the portrait once', () => {
    const first = runTrace(60)
    expect(first.snapshot.status).toBe('finished')
    expect(first.snapshot.courseSeconds).toBe(course.lengthCourseSeconds)
    expect(
      first.snapshot.resolvedTargets.every(
        (result) => result.outcome === 'miss',
      ),
    ).toBe(true)
    expect(first.progress.completed).toBe(true)
    expect(first.progress.collectedRewardIds).toContain(
      course.rewards.finishRewardIds[0],
    )

    const replay = runTrace(60, { progress: first.progress })
    expect(
      replay.events.filter(
        (event) =>
          event.type === 'reward-collected' &&
          event.rewardId === course.rewards.finishRewardIds[0],
      ),
    ).toHaveLength(0)
    expect(
      replay.progress.collectedRewardIds.filter(
        (rewardId) => rewardId === course.rewards.finishRewardIds[0],
      ),
    ).toHaveLength(1)
  })

  it('quantizes accepted input upward to a fixed-step boundary', () => {
    const game = createSongRunnerGame(course, { comfortableMidi })
    expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
    const step = course.movement.fixedStepSeconds
    expect(
      game.input({
        epoch,
        sequence: 1,
        atCourseSeconds: step / 10,
        action: 'lane-right',
      }),
    ).toBe(true)
    game.advanceTo(epoch, step - 1e-6)
    expect(game.snapshot().player.lateralX).toBe(0)
    game.advanceTo(epoch, step)
    expect(game.snapshot().player.lateralX).toBe(0)
    game.advanceTo(epoch, step * 2)
    expect(game.snapshot().player.lateralX).toBeGreaterThan(0)
  })

  it.each(certifiedEndpointCases)(
    'matches every certified $name $endpoint action endpoint on the fixed-step clock',
    ({ course: endpointCourse, endpoint }) => {
      const game = createSongRunnerGame(endpointCourse, { comfortableMidi })
      expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
      const action = (obstacleId: string) =>
        endpointCourse.obstacles.find((obstacle) => obstacle.id === obstacleId)!
          .certifiedActions[0]!
      const inputTime = (obstacleId: string) => {
        const window = action(obstacleId)
        return endpoint === 'open'
          ? window.launchOpenCourseSeconds
          : window.launchCloseCourseSeconds
      }
      const firstJump = action('first-jump')
      const inputs: readonly RunnerInput[] = [
        {
          epoch,
          sequence: 1,
          atCourseSeconds: inputTime('first-lane-gate'),
          action: 'lane-right',
        },
        {
          epoch,
          sequence: 2,
          atCourseSeconds: inputTime('first-jump'),
          action: 'jump',
        },
        {
          epoch,
          sequence: 3,
          atCourseSeconds:
            firstJump.landingCloseCourseSeconds +
            endpointCourse.movement.fixedStepSeconds * 4,
          action: 'lane-left',
        },
        {
          epoch,
          sequence: 4,
          atCourseSeconds: inputTime('second-lane-gate'),
          action: 'lane-right',
        },
        {
          epoch,
          sequence: 5,
          atCourseSeconds: inputTime('second-jump'),
          action: 'jump',
        },
      ]
      for (const input of inputs) expect(game.input(input)).toBe(true)

      const laneLandings: number[] = []
      const jumpLandings: number[] = []
      let priorGrounded = true
      let requestedCourseSeconds = 0
      const secondJump = action('second-jump')
      const throughCourseSeconds =
        (endpoint === 'open'
          ? secondJump.landingOpenCourseSeconds
          : secondJump.landingCloseCourseSeconds) +
        endpointCourse.movement.fixedStepSeconds
      while (
        game.snapshot().status === 'running' &&
        requestedCourseSeconds < throughCourseSeconds - EPSILON
      ) {
        requestedCourseSeconds = Math.min(
          throughCourseSeconds,
          requestedCourseSeconds + endpointCourse.movement.fixedStepSeconds,
        )
        game.advanceTo(epoch, requestedCourseSeconds)
        const snapshot = game.snapshot()
        if (
          laneLandings.length === 0 &&
          snapshot.courseSeconds >=
            action('first-lane-gate').launchOpenCourseSeconds &&
          Math.abs(snapshot.player.lateralX - endpointCourse.laneCenters[2]) <=
            EPSILON
        )
          laneLandings.push(snapshot.courseSeconds)
        if (
          laneLandings.length === 1 &&
          snapshot.courseSeconds >=
            action('second-lane-gate').launchOpenCourseSeconds &&
          Math.abs(snapshot.player.lateralX - endpointCourse.laneCenters[2]) <=
            EPSILON
        )
          laneLandings.push(snapshot.courseSeconds)
        if (!priorGrounded && snapshot.player.grounded)
          jumpLandings.push(snapshot.courseSeconds)
        priorGrounded = snapshot.player.grounded
      }

      const expectedLanding = (obstacleId: string) => {
        const window = action(obstacleId)
        const actionDurationSeconds =
          window.kind === 'lane-transition'
            ? endpointCourse.movement.laneChangeSeconds
            : (2 * endpointCourse.movement.jumpVelocityMetersPerSecond) /
              endpointCourse.movement.gravityMetersPerSecondSquared
        return runnerFixedStepActionEnd(
          inputTime(obstacleId),
          actionDurationSeconds,
          0,
          endpointCourse.movement.fixedStepSeconds,
        )
      }
      expect(game.snapshot().status).toBe('running')
      expect(laneLandings).toHaveLength(2)
      expect(jumpLandings).toHaveLength(2)
      expect(laneLandings[0]).toBeCloseTo(
        expectedLanding('first-lane-gate'),
        10,
      )
      expect(laneLandings[1]).toBeCloseTo(
        expectedLanding('second-lane-gate'),
        10,
      )
      expect(jumpLandings[0]).toBeCloseTo(expectedLanding('first-jump'), 10)
      expect(jumpLandings[1]).toBeCloseTo(expectedLanding('second-jump'), 10)
      for (const [index, obstacleId] of [
        'first-lane-gate',
        'second-lane-gate',
      ].entries()) {
        const window = action(obstacleId!)
        expect(laneLandings[index]).toBeGreaterThanOrEqual(
          window.landingOpenCourseSeconds - EPSILON,
        )
        expect(laneLandings[index]).toBeLessThanOrEqual(
          window.landingCloseCourseSeconds + EPSILON,
        )
      }
      for (const [index, obstacleId] of [
        'first-jump',
        'second-jump',
      ].entries()) {
        const window = action(obstacleId!)
        expect(jumpLandings[index]).toBeGreaterThanOrEqual(
          window.landingOpenCourseSeconds - EPSILON,
        )
        expect(jumpLandings[index]).toBeLessThanOrEqual(
          window.landingCloseCourseSeconds + EPSILON,
        )
      }
    },
  )

  it('rejects malformed evidence without breaking a valid continuity chain', () => {
    const target = course.targets[0]!
    const note = target.notes[0]!
    const rootMidi =
      comfortableMidi + course.voice.comfortableRootOffsetSemitones
    const capture = note.startCourseSeconds
    const game = createSongRunnerGame(course, { comfortableMidi })
    expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
    const makeEvidence = (
      sequence: number,
      captureCourseSeconds: number,
      overrides: Partial<RunnerVoiceEvidence> = {},
    ): RunnerVoiceEvidence => ({
      epoch,
      sequence,
      captureCourseSeconds,
      receivedCourseSeconds: captureCourseSeconds,
      midi: runnerTargetMidiAt(target.notes, captureCourseSeconds, rootMidi),
      confidence: 1,
      ...overrides,
    })

    expect(game.observe(makeEvidence(1, capture))).toBe(true)
    expect(
      game.observe(makeEvidence(2, capture + 0.05, { epoch: 'stale' })),
    ).toBe(false)
    expect(game.observe(makeEvidence(2, capture + 0.1))).toBe(true)
    expect(
      game.observe(
        makeEvidence(3, capture + 0.05, {
          receivedCourseSeconds: capture + 0.15,
        }),
      ),
    ).toBe(false)
    expect(game.observe(makeEvidence(3, capture + 0.2))).toBe(true)
    advanceInFrames(game, epoch, target.settleAfterCourseSeconds + 0.02)
    expect(game.snapshot().resolvedTargets[0]?.reliableSeconds).toBeCloseTo(
      0.2,
      8,
    )
  })

  it('routes bounded late evidence by capture time and rejects invalid latency', () => {
    const target = course.targets[0]!
    const captureCourseSeconds = target.judgeCloseCourseSeconds - 0.01
    const game = createSongRunnerGame(course, { comfortableMidi })
    expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
    const base: RunnerVoiceEvidence = {
      epoch,
      sequence: 1,
      captureCourseSeconds,
      receivedCourseSeconds:
        captureCourseSeconds +
        course.voice.judge.maximumDeliveryLatencySeconds -
        0.01,
      midi: comfortableMidi,
      confidence: 1,
    }
    expect(game.observe(base)).toBe(true)
    expect(
      game.observe({
        ...base,
        sequence: 2,
        captureCourseSeconds: target.judgeCloseCourseSeconds + 0.001,
        receivedCourseSeconds: target.judgeCloseCourseSeconds + 0.001,
      }),
    ).toBe(false)
    expect(
      game.observe({
        ...base,
        sequence: 2,
        captureCourseSeconds: captureCourseSeconds + 0.001,
        receivedCourseSeconds: captureCourseSeconds,
      }),
    ).toBe(false)
    expect(
      game.observe({
        ...base,
        sequence: 2,
        captureCourseSeconds: captureCourseSeconds + 0.001,
        receivedCourseSeconds:
          captureCourseSeconds +
          course.voice.judge.maximumDeliveryLatencySeconds +
          0.01,
      }),
    ).toBe(false)
  })

  it('emits one frame-gap recovery without consuming elapsed course time', () => {
    const game = createSongRunnerGame(course, { comfortableMidi })
    expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
    game.advanceTo(epoch, course.movement.maxCatchUpSeconds + 0.01)
    const afterGap = game.snapshot()
    expect(afterGap.status).toBe('recovering')
    expect(afterGap.courseSeconds).toBe(0)
    game.advanceTo(epoch, course.movement.maxCatchUpSeconds + 0.02)
    expect(game.drainEvents()).toEqual([
      expect.objectContaining({
        type: 'recovery-required',
        reason: 'frame-gap',
        checkpointId: course.checkpoints[0]!.id,
      }),
    ])
    expect(game.drainEvents()).toEqual([])
  })

  it('recovers at checkpoint 96 while preserving past results, durable bests, and rewards', () => {
    const stopCourseSeconds = runnerBeatToSeconds(course.tempoSegments, 130)
    const trace = runTrace(60, {
      evidence: perfectEvidence().filter(
        (observation) => observation.receivedCourseSeconds <= stopCourseSeconds,
      ),
      stopCourseSeconds,
    })
    expect(trace.snapshot.status).toBe('running')
    expect(trace.snapshot.lastCheckpointId).toBe('melody')
    expect(trace.snapshot.combo).toBeGreaterThan(0)
    expect(trace.snapshot.collectedRewardIds).toContain('pearl-right-114')
    expect(
      trace.snapshot.resolvedTargets.map((result) => result.targetId),
    ).toContain('two-note-revisit')

    trace.game.advanceTo(
      epoch,
      stopCourseSeconds + course.movement.maxCatchUpSeconds + 0.01,
    )
    expect(trace.game.snapshot().status).toBe('recovering')
    trace.game.drainEvents()
    expect(trace.game.prepareCheckpoint('melody')).toEqual({
      ok: true,
      checkpointId: 'melody',
      startCourseSeconds: course.checkpoints[2]!.courseSeconds,
    })
    const prepared = trace.game.snapshot()
    expect(prepared).toMatchObject({
      status: 'paused',
      epoch: null,
      courseSeconds: course.checkpoints[2]!.courseSeconds,
      recoveryCheckpointId: null,
      combo: 0,
      player: {
        targetLane: course.checkpoints[2]!.respawnLane,
        feetY: course.checkpoints[2]!.respawnFeetY,
        grounded: true,
      },
    })
    expect(prepared.resolvedTargets.map((result) => result.targetId)).toEqual(
      course.targets
        .filter(
          (target) =>
            target.settleAfterCourseSeconds <=
            course.checkpoints[2]!.courseSeconds + EPSILON,
        )
        .map((target) => target.id),
    )
    expect(prepared.collectedRewardIds).toContain('pearl-right-114')
    expect(
      prepared.bestTargetQualities.map((quality) => quality.targetId),
    ).toContain('two-note-revisit')

    expect(trace.game.beginEpoch('checkpoint-two', 'melody')).toEqual({
      ok: true,
      checkpointId: 'melody',
      startCourseSeconds: course.checkpoints[2]!.courseSeconds,
    })
    const recovered = trace.game.snapshot()
    expect(recovered.combo).toBe(0)
    expect(recovered.resolvedTargets.map((result) => result.targetId)).toEqual(
      course.targets
        .filter(
          (target) =>
            target.settleAfterCourseSeconds <=
            course.checkpoints[2]!.courseSeconds + EPSILON,
        )
        .map((target) => target.id),
    )
    expect(recovered.collectedRewardIds).toContain('pearl-right-114')
    expect(
      recovered.bestTargetQualities.map((quality) => quality.targetId),
    ).toContain('two-note-revisit')
  })

  it('stages the initial checkpoint after a no-wall fall and permits repeated retries', () => {
    const game = createSongRunnerGame(course, { comfortableMidi })
    expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
    for (const input of safeInputs().filter(
      (candidate) =>
        candidate.atCourseSeconds !== actionTime('first-lane-gate'),
    ))
      expect(game.input(input)).toBe(true)
    advanceInFrames(game, epoch, course.lengthCourseSeconds)
    expect(game.snapshot()).toMatchObject({
      status: 'recovering',
      recoveryCheckpointId: 'start',
    })
    expect(game.snapshot().courseSeconds).toBeGreaterThan(0)
    game.drainEvents()

    for (let retry = 0; retry < 2; retry++) {
      expect(game.prepareCheckpoint('start')).toEqual({
        ok: true,
        checkpointId: 'start',
        startCourseSeconds: 0,
      })
      expect(game.snapshot()).toMatchObject({
        status: 'paused',
        epoch: null,
        courseSeconds: 0,
        recoveryCheckpointId: null,
        resolvedTargets: [],
        player: {
          targetLane: course.checkpoints[0]!.respawnLane,
          feetY: course.checkpoints[0]!.respawnFeetY,
          grounded: true,
        },
      })
    }
    expect(game.beginEpoch('retry-one', 'start')).toEqual({
      ok: true,
      checkpointId: 'start',
      startCourseSeconds: 0,
    })
    expect(game.snapshot()).toMatchObject({
      status: 'running',
      epoch: 'retry-one',
      courseSeconds: 0,
    })
  })

  it.each([
    { omittedJump: 'first-jump', expectedCheckpoint: 'start' },
    { omittedJump: 'second-jump', expectedCheckpoint: 'tempo-step' },
  ])(
    'requires recovery instead of teleporting across $omittedJump',
    ({ omittedJump, expectedCheckpoint }) => {
      const game = createSongRunnerGame(course, { comfortableMidi })
      expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
      for (const input of safeInputs().filter(
        (candidate) => candidate.atCourseSeconds !== actionTime(omittedJump),
      ))
        expect(game.input(input)).toBe(true)
      advanceInFrames(game, epoch, course.lengthCourseSeconds)
      expect(game.snapshot()).toMatchObject({
        status: 'recovering',
        recoveryCheckpointId: expectedCheckpoint,
      })
      expect(game.drainEvents().at(-1)).toMatchObject({
        type: 'recovery-required',
        reason: 'fall',
        checkpointId: expectedCheckpoint,
      })
    },
  )
})
