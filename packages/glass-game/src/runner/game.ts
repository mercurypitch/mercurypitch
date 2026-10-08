// ============================================================
// Song runner game — deterministic epochs, movement, judging, recovery, and saves.
// ============================================================

import type { RunnerLateralSegment } from './continuous-lateral'
import { continuousRunnerSweepIntersectsCircle } from './continuous-movement'
import type { CompiledRunnerCheckpoint, CompiledRunnerCourse, CreateSongRunnerGameOptions, RunnerBeginEpochResult, RunnerEpoch, RunnerEvent, RunnerInput, RunnerRecoveryReason, RunnerSnapshot, RunnerTargetResult, RunnerVoiceEvidence, SavedRunnerProgress, SongRunnerGame, } from './contracts'
import { runnerFixedStepAtOrAfter } from './fixed-step'
import { createRunnerJudge } from './judge'
import type { RunnerMovementState } from './movement'
import { applyRunnerMovementInput, createRunnerMovementState, runnerCourseDistanceAt, runnerHasGroundSupport, runnerSweepIntersectsCircle, stepRunnerMovement, } from './movement'
import { collectRunnerRewards, completeRunnerProgress, createRunnerTargetQuality, mergeRunnerTargetQuality, readSavedRunnerProgress, } from './progress'
import { runnerSlideSnapshot } from './slide'
import { runnerForwardSpeedAtSeconds, runnerSecondsToBeat } from './tempo'

const EPSILON = 1e-9

interface QueuedRunnerInput {
  readonly input: RunnerInput
  readonly quantizedCourseSeconds: number
}

type PendingRunnerEvent = RunnerEvent extends infer Event
  ? Event extends RunnerEvent
    ? Omit<Event, 'eventSequence' | 'epoch' | 'atBeat'>
    : never
  : never

function validateFactory(
  course: CompiledRunnerCourse,
  options: CreateSongRunnerGameOptions,
): void {
  if (
    course.schema !== 'mercurypitch.song-runner.compiled' ||
    (course.movement.kind !== undefined &&
      course.movement.kind !== 'lanes' &&
      course.movement.kind !== 'continuous') ||
    course.version !==
      (course.movement.slide !== undefined
        ? 3
        : course.movement.kind === 'continuous'
          ? 2
          : 1) ||
    course.checkpoints.length === 0 ||
    course.checkpoints[0]!.courseSeconds !== 0 ||
    course.chunks.length === 0
  )
    throw new Error('Song runner requires a valid compiled course.')
  if (
    !Number.isFinite(options.comfortableMidi) ||
    !Number.isInteger(options.comfortableMidi)
  )
    throw new Error('Song runner comfortableMidi must be a finite integer.')
  const rootMidi =
    options.comfortableMidi + course.voice.comfortableRootOffsetSemitones
  const offsets = course.targets.flatMap((target) =>
    target.notes.flatMap((note) => [
      note.startOffsetSemitones,
      note.endOffsetSemitones,
    ]),
  )
  if (
    rootMidi + Math.min(0, ...offsets) < course.voice.minimumComfortableMidi ||
    rootMidi + Math.max(0, ...offsets) > course.voice.maximumComfortableMidi
  )
    throw new Error(
      'Song runner comfortableMidi does not keep the complete phrase range usable.',
    )
}

export function createSongRunnerGame(
  course: CompiledRunnerCourse,
  options: CreateSongRunnerGameOptions,
): SongRunnerGame {
  validateFactory(course, options)
  const initialCheckpoint = course.checkpoints[0]!
  const usedEpochs = new Set<RunnerEpoch>()
  const reachedCheckpointIds = new Set<string>([initialCheckpoint.id])
  const sessionResults = new Map<string, RunnerTargetResult>()
  const judge = createRunnerJudge(course, options.comfortableMidi)

  let status: RunnerSnapshot['status'] = 'ready'
  let epoch: RunnerEpoch | null = null
  let epochStartCourseSeconds = initialCheckpoint.courseSeconds
  let courseSeconds = initialCheckpoint.courseSeconds
  let lastRequestedCourseSeconds = initialCheckpoint.courseSeconds
  let lastCheckpointId = initialCheckpoint.id
  let recoveryCheckpointId: string | null = null
  let movement: RunnerMovementState = createRunnerMovementState(
    course,
    initialCheckpoint.respawnLane,
    initialCheckpoint.respawnFeetY,
  )
  let queuedInputs: QueuedRunnerInput[] = []
  let lastInputSequence = -1
  let lastEvidenceSequence = -1
  let lastEvidenceCaptureCourseSeconds = -Infinity
  let lastEvidenceReceivedCourseSeconds = -Infinity
  let eventSequence = 0
  let events: RunnerEvent[] = []
  let combo = 0
  let progress = readSavedRunnerProgress(course, options.progress)

  const checkpoint = (id: string): CompiledRunnerCheckpoint | undefined =>
    course.checkpoints.find((candidate) => candidate.id === id)

  const restoreCheckpoint = (
    resumeCheckpoint: CompiledRunnerCheckpoint,
    fresh: boolean,
    nextStatus: 'paused' | 'running',
  ): void => {
    epoch = null
    epochStartCourseSeconds = resumeCheckpoint.courseSeconds
    courseSeconds = resumeCheckpoint.courseSeconds
    lastRequestedCourseSeconds = resumeCheckpoint.courseSeconds
    movement = createRunnerMovementState(
      course,
      resumeCheckpoint.respawnLane,
      resumeCheckpoint.respawnFeetY,
    )
    queuedInputs = []
    lastInputSequence = -1
    lastEvidenceSequence = -1
    lastEvidenceCaptureCourseSeconds = -Infinity
    lastEvidenceReceivedCourseSeconds = -Infinity
    events = []
    combo = 0
    recoveryCheckpointId = null
    status = nextStatus

    const resetTargetIds = new Set<string>()
    if (fresh) {
      sessionResults.clear()
      reachedCheckpointIds.clear()
      reachedCheckpointIds.add(initialCheckpoint.id)
      lastCheckpointId = initialCheckpoint.id
      for (const target of course.targets) resetTargetIds.add(target.id)
    } else {
      for (const target of course.targets) {
        if (
          target.settleAfterCourseSeconds >
          resumeCheckpoint.courseSeconds + EPSILON
        ) {
          sessionResults.delete(target.id)
          resetTargetIds.add(target.id)
        }
      }
      lastCheckpointId = resumeCheckpoint.id
    }
    judge.resetTargets(resetTargetIds)
    judge.clearContinuity()
  }

  const checkpointFor = (
    checkpointId?: string,
  ):
    | {
        readonly ok: true
        readonly checkpoint: CompiledRunnerCheckpoint
        readonly fresh: boolean
      }
    | {
        readonly ok: false
        readonly reason:
          | 'invalid-state'
          | 'unknown-checkpoint'
          | 'checkpoint-not-reached'
      } => {
    if (status === 'running') return { ok: false, reason: 'invalid-state' }
    const fresh = checkpointId === undefined
    if (!fresh && status === 'finished')
      return { ok: false, reason: 'invalid-state' }
    const resumeCheckpoint = fresh
      ? initialCheckpoint
      : checkpoint(checkpointId)
    if (resumeCheckpoint === undefined)
      return { ok: false, reason: 'unknown-checkpoint' }
    if (
      !fresh &&
      resumeCheckpoint.id !== initialCheckpoint.id &&
      !reachedCheckpointIds.has(resumeCheckpoint.id)
    )
      return { ok: false, reason: 'checkpoint-not-reached' }
    return { ok: true, checkpoint: resumeCheckpoint, fresh }
  }

  const emit = (event: PendingRunnerEvent): void => {
    if (epoch === null) return
    eventSequence++
    events.push({
      ...event,
      eventSequence,
      epoch,
      atBeat: runnerSecondsToBeat(course.tempoSegments, event.atCourseSeconds),
    } as RunnerEvent)
  }

  const collectRewards = (
    rewardIds: readonly string[],
    atCourseSeconds: number,
  ): void => {
    const previouslyCollected = new Set(progress.collectedRewardIds)
    progress = collectRunnerRewards(progress, rewardIds)
    for (const rewardId of rewardIds) {
      if (!previouslyCollected.has(rewardId))
        emit({ type: 'reward-collected', rewardId, atCourseSeconds })
    }
  }

  const resolveTargetsThrough = (throughCourseSeconds: number): void => {
    for (const target of course.targets) {
      const completedAtCourseSeconds = judge.completionAtCourseSeconds(target)
      const resolveAtCourseSeconds =
        completedAtCourseSeconds ?? target.settleAfterCourseSeconds
      if (
        resolveAtCourseSeconds > throughCourseSeconds + EPSILON ||
        sessionResults.has(target.id)
      )
        continue
      const result = judge.result(target)
      sessionResults.set(target.id, result)
      if (result.outcome === 'hit' && result.grade !== null) {
        combo++
        progress = mergeRunnerTargetQuality(
          progress,
          createRunnerTargetQuality(
            course,
            result.targetId,
            result.grade,
            result.reliableSeconds,
            result.meanAbsoluteCents!,
          ),
        )
        emit({
          type: 'target-hit',
          result: { ...result, outcome: 'hit', grade: result.grade },
          atCourseSeconds: result.resolvedAtCourseSeconds,
        })
      } else {
        combo = 0
        emit({
          type: 'target-miss',
          result: { ...result, outcome: 'miss', grade: null },
          atCourseSeconds: result.resolvedAtCourseSeconds,
        })
      }
    }
  }

  const enterRecovery = (
    reason: RunnerRecoveryReason,
    atCourseSeconds: number,
  ): void => {
    if (status === 'recovering') return
    status = 'recovering'
    movement.slideHeld = false
    movement.steeringAxis = 0
    movement.lateralVelocityMetersPerSecond = 0
    recoveryCheckpointId = lastCheckpointId
    queuedInputs = []
    judge.clearContinuity()
    emit({
      type: 'recovery-required',
      reason,
      checkpointId: lastCheckpointId,
      atCourseSeconds,
    })
  }

  const certifyCheckpoints = (atCourseSeconds: number): void => {
    if (!movement.grounded) return
    const distance = runnerCourseDistanceAt(course, atCourseSeconds)
    if (!runnerHasGroundSupport(course, distance, movement.lateralX)) return
    for (const candidate of course.checkpoints) {
      if (
        reachedCheckpointIds.has(candidate.id) ||
        atCourseSeconds < candidate.courseSeconds - EPSILON ||
        atCourseSeconds > candidate.runwayEndCourseSeconds + EPSILON
      )
        continue
      reachedCheckpointIds.add(candidate.id)
      lastCheckpointId = candidate.id
    }
  }

  const collectPickups = (
    startCourseSeconds: number,
    endCourseSeconds: number,
    startX: number,
    endX: number,
    lateralSegments?: readonly RunnerLateralSegment[],
  ): void => {
    const startDistance = runnerCourseDistanceAt(course, startCourseSeconds)
    const endDistance = runnerCourseDistanceAt(course, endCourseSeconds)
    for (const pickup of course.rewards.pickups) {
      if (
        progress.collectedRewardIds.includes(pickup.id) ||
        pickup.courseSeconds < startCourseSeconds - EPSILON ||
        pickup.courseSeconds > endCourseSeconds + EPSILON
      )
        continue
      if (
        lateralSegments !== undefined
          ? lateralSegments.some((segment) =>
              continuousRunnerSweepIntersectsCircle(
                segment,
                startDistance +
                  ((endDistance - startDistance) * segment.startSeconds) /
                    (endCourseSeconds - startCourseSeconds),
                (endDistance - startDistance) /
                  (endCourseSeconds - startCourseSeconds),
                pickup.courseDistanceMeters,
                pickup.lateralX,
                pickup.radius + course.movement.bodyRadius,
              ),
            )
          : runnerSweepIntersectsCircle(
              startDistance,
              endDistance,
              startX,
              endX,
              pickup.courseDistanceMeters,
              pickup.lateralX,
              pickup.radius + course.movement.bodyRadius,
            )
      )
        collectRewards([pickup.id], pickup.courseSeconds)
    }
  }

  const finish = (): void => {
    if (status === 'finished') return
    resolveTargetsThrough(course.lengthCourseSeconds)
    collectRewards(course.rewards.finishRewardIds, course.lengthCourseSeconds)
    progress = completeRunnerProgress(progress)
    status = 'finished'
    emit({
      type: 'course-finished',
      finishRewardIds: [...course.rewards.finishRewardIds],
      atCourseSeconds: course.lengthCourseSeconds,
    })
  }

  const applyInputsThrough = (stepCourseSeconds: number): void => {
    while (
      queuedInputs[0] !== undefined &&
      queuedInputs[0].quantizedCourseSeconds <= stepCourseSeconds + EPSILON
    ) {
      const queued = queuedInputs.shift()!
      applyRunnerMovementInput(
        course,
        movement,
        queued.input.action,
        queued.quantizedCourseSeconds,
        queued.input.action === 'steer' ? queued.input.axis : 0,
        queued.input.action === 'slide' && queued.input.held,
      )
    }
  }

  const stepTo = (nextCourseSeconds: number): boolean => {
    const startCourseSeconds = courseSeconds
    const startX = movement.lateralX
    applyInputsThrough(startCourseSeconds)
    const movementResult = stepRunnerMovement(
      course,
      movement,
      startCourseSeconds,
      nextCourseSeconds,
    )
    courseSeconds = nextCourseSeconds
    resolveTargetsThrough(courseSeconds)
    collectPickups(
      startCourseSeconds,
      courseSeconds,
      startX,
      movement.lateralX,
      movementResult.lateralSegments,
    )
    certifyCheckpoints(courseSeconds)
    if (movementResult.collided || movementResult.fell) {
      enterRecovery(
        movementResult.collided ? 'collision' : 'fall',
        courseSeconds,
      )
      return false
    }
    if (courseSeconds >= course.lengthCourseSeconds - EPSILON) {
      courseSeconds = course.lengthCourseSeconds
      finish()
      return false
    }
    return true
  }

  const beginEpoch = (
    nextEpoch: RunnerEpoch,
    checkpointId?: string,
  ): RunnerBeginEpochResult => {
    if (typeof nextEpoch !== 'string' || nextEpoch.trim().length === 0)
      return { ok: false, reason: 'invalid-state' }
    if (usedEpochs.has(nextEpoch)) return { ok: false, reason: 'epoch-reused' }
    const selected = checkpointFor(checkpointId)
    if (!selected.ok) return selected

    usedEpochs.add(nextEpoch)
    restoreCheckpoint(selected.checkpoint, selected.fresh, 'running')
    epoch = nextEpoch
    return {
      ok: true,
      checkpointId: selected.checkpoint.id,
      startCourseSeconds: selected.checkpoint.courseSeconds,
    }
  }

  const input = (nextInput: RunnerInput): boolean => {
    if (
      status !== 'running' ||
      epoch === null ||
      nextInput.epoch !== epoch ||
      !Number.isSafeInteger(nextInput.sequence) ||
      nextInput.sequence <= lastInputSequence ||
      !Number.isFinite(nextInput.atCourseSeconds) ||
      nextInput.atCourseSeconds < epochStartCourseSeconds - EPSILON ||
      nextInput.atCourseSeconds < courseSeconds - EPSILON ||
      nextInput.atCourseSeconds > course.lengthCourseSeconds + EPSILON ||
      (nextInput.action !== 'lane-left' &&
        nextInput.action !== 'lane-right' &&
        nextInput.action !== 'jump' &&
        nextInput.action !== 'steer' &&
        nextInput.action !== 'slide') ||
      (nextInput.action === 'slide' &&
        (course.movement.slide === undefined ||
          typeof nextInput.held !== 'boolean')) ||
      (nextInput.action === 'steer' &&
        (course.movement.kind !== 'continuous' ||
          !Number.isFinite(nextInput.axis) ||
          Math.abs(nextInput.axis) > 1)) ||
      (course.movement.kind === 'continuous' &&
        (nextInput.action === 'lane-left' || nextInput.action === 'lane-right'))
    )
      return false
    const quantizedCourseSeconds = runnerFixedStepAtOrAfter(
      nextInput.atCourseSeconds,
      epochStartCourseSeconds,
      course.movement.fixedStepSeconds,
    )
    if (quantizedCourseSeconds > course.lengthCourseSeconds + EPSILON)
      return false
    lastInputSequence = nextInput.sequence
    // Keep one latest axis value per simulation boundary, never accumulate presentation frames.
    if (nextInput.action === 'steer')
      queuedInputs = queuedInputs.filter(
        (queued) =>
          queued.input.action !== 'steer' ||
          queued.quantizedCourseSeconds !== quantizedCourseSeconds,
      )
    queuedInputs.push({ input: { ...nextInput }, quantizedCourseSeconds })
    queuedInputs.sort(
      (left, right) =>
        left.quantizedCourseSeconds - right.quantizedCourseSeconds ||
        left.input.sequence - right.input.sequence,
    )
    return true
  }

  const observe = (observation: RunnerVoiceEvidence): boolean => {
    if (
      status !== 'running' ||
      epoch === null ||
      observation.epoch !== epoch ||
      !Number.isSafeInteger(observation.sequence) ||
      observation.sequence <= lastEvidenceSequence ||
      !Number.isFinite(observation.captureCourseSeconds) ||
      !Number.isFinite(observation.receivedCourseSeconds) ||
      observation.captureCourseSeconds < epochStartCourseSeconds - EPSILON ||
      observation.captureCourseSeconds < 0 ||
      observation.receivedCourseSeconds < observation.captureCourseSeconds ||
      observation.receivedCourseSeconds >
        course.lengthCourseSeconds + EPSILON ||
      observation.receivedCourseSeconds - observation.captureCourseSeconds >
        course.voice.judge.maximumDeliveryLatencySeconds + EPSILON ||
      !Number.isFinite(observation.confidence) ||
      observation.confidence < 0 ||
      observation.confidence > 1 ||
      (observation.midi !== null && !Number.isFinite(observation.midi)) ||
      observation.captureCourseSeconds <=
        lastEvidenceCaptureCourseSeconds + EPSILON ||
      observation.receivedCourseSeconds <
        lastEvidenceReceivedCourseSeconds - EPSILON
    )
      return false
    const target = course.targets.find(
      (candidate) =>
        observation.captureCourseSeconds >=
          candidate.judgeOpenCourseSeconds - EPSILON &&
        observation.captureCourseSeconds <=
          candidate.judgeCloseCourseSeconds + EPSILON,
    )
    if (
      target === undefined ||
      sessionResults.has(target.id) ||
      observation.receivedCourseSeconds >
        target.settleAfterCourseSeconds + EPSILON
    )
      return false
    lastEvidenceSequence = observation.sequence
    lastEvidenceCaptureCourseSeconds = observation.captureCourseSeconds
    lastEvidenceReceivedCourseSeconds = observation.receivedCourseSeconds
    judge.observe(observation)
    return true
  }

  const advanceTo = (
    nextEpoch: RunnerEpoch,
    requestedCourseSeconds: number,
  ): void => {
    if (status !== 'running' || epoch === null || nextEpoch !== epoch) return
    if (!Number.isFinite(requestedCourseSeconds))
      throw new Error('Song runner advanceTo requires finite course time.')
    if (requestedCourseSeconds < lastRequestedCourseSeconds - EPSILON)
      throw new Error('Song runner advanceTo cannot move backwards.')
    const clamped = Math.min(requestedCourseSeconds, course.lengthCourseSeconds)
    if (
      clamped - lastRequestedCourseSeconds >
      course.movement.maxCatchUpSeconds + EPSILON
    ) {
      enterRecovery('frame-gap', courseSeconds)
      return
    }
    lastRequestedCourseSeconds = clamped
    const step = course.movement.fixedStepSeconds
    while (status === 'running' && courseSeconds + step <= clamped + EPSILON) {
      if (!stepTo(Math.min(course.lengthCourseSeconds, courseSeconds + step)))
        return
    }
    if (
      status === 'running' &&
      clamped >= course.lengthCourseSeconds - EPSILON &&
      courseSeconds < course.lengthCourseSeconds - EPSILON
    )
      stepTo(course.lengthCourseSeconds)
  }

  const snapshot = (): RunnerSnapshot => {
    const safeCourseSeconds = Math.max(
      0,
      Math.min(course.lengthCourseSeconds, courseSeconds),
    )
    const courseBeat = runnerSecondsToBeat(
      course.tempoSegments,
      safeCourseSeconds,
    )
    const chunkIndex = Math.min(
      course.chunks.length - 1,
      Math.floor(courseBeat / (course.lengthBeats / course.chunks.length)),
    )
    const residentChunkIds = course.chunks
      .slice(
        Math.max(0, chunkIndex - 1),
        Math.min(course.chunks.length, chunkIndex + 2),
      )
      .map((chunk) => chunk.id)
    const activeTargetDefinition = course.targets.find(
      (target) =>
        !sessionResults.has(target.id) &&
        safeCourseSeconds >= target.visibleFromCourseSeconds - EPSILON &&
        safeCourseSeconds < target.settleAfterCourseSeconds - EPSILON,
    )
    const upcomingTargetIds = course.targets
      .filter(
        (target) =>
          !sessionResults.has(target.id) &&
          target.id !== activeTargetDefinition?.id &&
          target.onsetCourseSeconds > safeCourseSeconds + EPSILON,
      )
      .slice(0, 2)
      .map((target) => target.id)
    return {
      movementMode:
        course.movement.kind === 'continuous' ? 'continuous' : 'lanes',
      courseId: course.id,
      courseRevision: course.revision,
      epoch,
      status,
      courseSeconds: safeCourseSeconds,
      courseBeat,
      courseDistanceMeters: runnerCourseDistanceAt(course, safeCourseSeconds),
      activeChunkId: course.chunks[chunkIndex]!.id,
      residentChunkIds,
      player: {
        ...(course.movement.slide === undefined
          ? {}
          : { slide: runnerSlideSnapshot(course, movement) }),
        targetLane: movement.targetLane,
        lateralX: movement.lateralX,
        lateralVelocityMetersPerSecond: movement.lateralVelocityMetersPerSecond,
        feetY: movement.feetY,
        verticalVelocityMetersPerSecond:
          movement.verticalVelocityMetersPerSecond,
        grounded: movement.grounded,
        forwardSpeedMetersPerSecond: runnerForwardSpeedAtSeconds(
          course.tempoSegments,
          safeCourseSeconds,
          course.metersPerBeat,
        ),
      },
      lastCheckpointId,
      recoveryCheckpointId,
      activeTarget:
        activeTargetDefinition === undefined
          ? null
          : judge.targetSnapshot(activeTargetDefinition, safeCourseSeconds),
      upcomingTargetIds,
      resolvedTargets: course.targets.flatMap((target) => {
        const result = sessionResults.get(target.id)
        return result === undefined ? [] : [{ ...result }]
      }),
      bestTargetQualities: progress.bestTargetQualities.map((quality) => ({
        ...quality,
      })),
      combo,
      collectedRewardIds: [...progress.collectedRewardIds],
    }
  }

  return {
    prepareCheckpoint(checkpointId) {
      const selected = checkpointFor(checkpointId)
      if (!selected.ok) return selected
      restoreCheckpoint(selected.checkpoint, selected.fresh, 'paused')
      return {
        ok: true,
        checkpointId: selected.checkpoint.id,
        startCourseSeconds: selected.checkpoint.courseSeconds,
      }
    },
    beginEpoch,
    pause() {
      if (status === 'running') {
        status = 'paused'
        movement.slideHeld = false
        movement.steeringAxis = 0
        movement.lateralVelocityMetersPerSecond = 0
        queuedInputs = []
        judge.clearContinuity()
      }
    },
    input,
    observe,
    advanceTo,
    snapshot,
    drainEvents() {
      const drained = events.map((event) => ({ ...event }))
      events = []
      return drained
    },
    saveProgress(): SavedRunnerProgress {
      return {
        ...progress,
        bestTargetQualities: progress.bestTargetQualities.map((quality) => ({
          ...quality,
        })),
        collectedRewardIds: [...progress.collectedRewardIds],
      }
    },
  }
}
