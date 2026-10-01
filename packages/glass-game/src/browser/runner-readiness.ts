// Runner readiness tracker — separates capture continuity from delivery-time microphone liveness.
import type { PitchObservation } from '../contracts'
import type { CompiledRunnerCourse, RunnerPitchFeedback, } from '../runner/contracts'
import { classifyRunnerPitchFeedback, neutralRunnerPitchFeedback, } from '../runner/judge'

export interface RunnerReadinessSnapshot {
  readonly targetMidi: number
  readonly fillProgress: number
  readonly receivingInput: boolean
  readonly pitchFeedback: RunnerPitchFeedback
}

export interface RunnerReadinessTracker {
  reset(startedAtSeconds: number): RunnerReadinessSnapshot
  observe(
    observation: PitchObservation,
    receivedAtSeconds: number,
  ): RunnerReadinessSnapshot | null
  advance(receivedAtSeconds: number): RunnerReadinessSnapshot
  canStart(receivedAtSeconds: number): boolean
}

export function createRunnerReadinessTracker(options: {
  readonly targetMidi: number
  readonly judge: CompiledRunnerCourse['voice']['judge']
  readonly requiredAcceptedSeconds: number
}): RunnerReadinessTracker {
  const { targetMidi, judge, requiredAcceptedSeconds } = options
  let startedAt = 0
  let acceptedSeconds = 0
  let lastSequence = -1
  let lastCapture = -Infinity
  let lastReceipt = -Infinity
  let previousCompatible = false
  let snapshot: RunnerReadinessSnapshot

  const initialSnapshot = (): RunnerReadinessSnapshot => ({
    targetMidi,
    fillProgress: 0,
    receivingInput: false,
    pitchFeedback: neutralRunnerPitchFeedback(),
  })

  const reset = (startedAtSeconds: number): RunnerReadinessSnapshot => {
    startedAt = startedAtSeconds
    acceptedSeconds = 0
    lastSequence = -1
    lastCapture = -Infinity
    lastReceipt = -Infinity
    previousCompatible = false
    snapshot = initialSnapshot()
    return snapshot
  }

  snapshot = reset(0)

  return {
    reset,
    observe(observation, receivedAtSeconds) {
      const latency = receivedAtSeconds - observation.captureSeconds
      if (
        !Number.isSafeInteger(observation.sequence) ||
        observation.sequence <= lastSequence ||
        !Number.isFinite(observation.captureSeconds) ||
        observation.captureSeconds <= lastCapture ||
        observation.captureSeconds < startedAt ||
        latency < 0 ||
        latency > judge.maximumDeliveryLatencySeconds ||
        !Number.isFinite(observation.confidence) ||
        observation.confidence < 0 ||
        observation.confidence > 1 ||
        (observation.midi !== null && !Number.isFinite(observation.midi))
      )
        return null

      const pitchFeedback = classifyRunnerPitchFeedback(
        observation.midi,
        targetMidi,
        observation.confidence,
        judge.minimumConfidence,
        judge.centsTolerance,
      )
      const compatible = pitchFeedback.state === 'accepted'
      const captureGap = observation.captureSeconds - lastCapture
      if (
        compatible &&
        previousCompatible &&
        captureGap <= judge.maximumEvidenceGapSeconds
      )
        acceptedSeconds += captureGap
      else acceptedSeconds = 0
      previousCompatible = compatible
      lastSequence = observation.sequence
      lastCapture = observation.captureSeconds
      lastReceipt = receivedAtSeconds
      snapshot = {
        targetMidi,
        fillProgress: Math.min(1, acceptedSeconds / requiredAcceptedSeconds),
        receivingInput: true,
        pitchFeedback,
      }
      return snapshot
    },
    advance(receivedAtSeconds) {
      const receiptAge = receivedAtSeconds - lastReceipt
      let next = snapshot
      if (
        receiptAge > judge.maximumEvidenceGapSeconds &&
        snapshot.pitchFeedback.state !== 'neutral'
      )
        next = { ...next, pitchFeedback: neutralRunnerPitchFeedback() }
      if (
        receiptAge > judge.maximumDeliveryLatencySeconds &&
        snapshot.receivingInput
      )
        next = { ...next, receivingInput: false }
      if (
        receivedAtSeconds - lastCapture >
          judge.maximumEvidenceGapSeconds +
            judge.maximumDeliveryLatencySeconds &&
        (acceptedSeconds > 0 || previousCompatible)
      ) {
        acceptedSeconds = 0
        previousCompatible = false
        next = { ...next, fillProgress: 0 }
      }
      snapshot = next
      return snapshot
    },
    canStart(receivedAtSeconds) {
      return (
        acceptedSeconds >= requiredAcceptedSeconds &&
        receivedAtSeconds - lastReceipt <= judge.maximumEvidenceGapSeconds
      )
    },
  }
}
