// Gentle pitch-wave judging — timed alternating excursions, never render-frame polling.

import type { HoldDefinition, PitchObservation } from '../contracts'
import type { PitchWaveDefinition } from '../pitch-wave'

export interface WaveJudge {
  feed(frame: PitchObservation, nowMs: number): boolean
  advanceTo(nowMs: number): void
  charge(): number
}

/** A teaching gesture, not a clinical or stylistic assessment of vibrato. */
export function createWaveJudge(
  definition: PitchWaveDefinition,
  evidence: HoldDefinition,
  centreMidi: number,
): WaveJudge {
  let sequence = -Infinity
  let captureSeconds = -Infinity
  let advancedAtMs = -Infinity
  let latestCapturedAtMs = -Infinity
  let previous: {
    cents: number
    captureSeconds: number
  } | null = null
  // A bounded detector dropout pauses the gesture. It must not manufacture
  // singing time or make a cached pitch look like continued evidence.
  let dropout = false
  let voicedSeconds = 0
  let filtered = 0
  let direction = 0
  let hitAt = 0
  let startedAt = 0
  let alternations = 0
  let complete = false
  // A centre-started N-cycle gesture reaches 2N alternating extremes. The
  // first establishes direction, leaving 2N - 1 transitions to verify.
  const requiredAlternations = Math.max(1, definition.requiredCycles * 2 - 1)

  const resetWave = (): void => {
    previous = null
    dropout = false
    voicedSeconds = 0
    filtered = 0
    direction = 0
    hitAt = 0
    startedAt = 0
    alternations = 0
  }

  const advanceTo = (nowMs: number): void => {
    if (!Number.isFinite(nowMs) || nowMs < advancedAtMs) return
    advancedAtMs = nowMs
    if (
      !complete &&
      previous !== null &&
      nowMs - latestCapturedAtMs > evidence.maximumSampleAgeMs
    )
      resetWave()
  }

  return {
    feed(frame, nowMs) {
      if (complete) return true
      if (
        !Number.isFinite(nowMs) ||
        nowMs < advancedAtMs ||
        !Number.isFinite(frame.sequence) ||
        !Number.isFinite(frame.captureSeconds) ||
        frame.sequence <= sequence ||
        frame.captureSeconds <= captureSeconds
      )
        return false
      advanceTo(nowMs)
      sequence = frame.sequence
      captureSeconds = frame.captureSeconds
      const age = nowMs - frame.capturedAtMs
      if (
        !Number.isFinite(age) ||
        age < -5 ||
        age > evidence.maximumSampleAgeMs ||
        !Number.isFinite(frame.confidence) ||
        (frame.midi !== null && !Number.isFinite(frame.midi))
      ) {
        resetWave()
        return false
      }
      latestCapturedAtMs = frame.capturedAtMs
      if (frame.midi === null || frame.confidence < evidence.confidenceFloor) {
        if (
          previous !== null &&
          frame.captureSeconds - previous.captureSeconds >
            evidence.dropoutGraceSeconds + 1e-9
        )
          resetWave()
        else dropout = previous !== null
        return false
      }
      const cents = (frame.midi - centreMidi) * 100
      if (Math.abs(cents) > definition.maximumExcursionCents) {
        resetWave()
        return false
      }
      const prior = previous
      const elapsed =
        prior === null ? 0 : frame.captureSeconds - prior.captureSeconds
      const resumedFromDropout = prior !== null && dropout
      if (
        prior !== null &&
        (elapsed >
          (resumedFromDropout
            ? evidence.dropoutGraceSeconds
            : evidence.maximumSampleGapSeconds) +
            1e-9 ||
          Math.abs(cents - prior.cents) / elapsed >
            definition.maximumCentsPerSecond)
      )
        resetWave()
      const contiguous = previous !== null && !resumedFromDropout
      if (contiguous) voicedSeconds += elapsed
      previous = {
        cents,
        captureSeconds: frame.captureSeconds,
      }
      dropout = false
      filtered = contiguous
        ? filtered +
          (cents - filtered) *
            (1 - Math.exp(-elapsed / definition.smoothingSeconds))
        : cents
      const nextDirection =
        filtered >= definition.minimumExcursionCents
          ? 1
          : filtered <= -definition.minimumExcursionCents
            ? -1
            : 0
      if (
        direction !== 0 &&
        voicedSeconds - hitAt > definition.maximumCycleSeconds / 2
      ) {
        direction = 0
        alternations = 0
      }
      if (
        direction !== 0 &&
        alternations >= requiredAlternations &&
        Math.abs(cents) <= definition.minimumExcursionCents
      ) {
        if (voicedSeconds - startedAt + 1e-9 >= definition.minimumWaveSeconds) {
          complete = true
          return true
        }
        // Waiting at centre must not turn a too-fast gesture into evidence.
        resetWave()
        return false
      }
      if (nextDirection === 0 || nextDirection === direction) return false
      if (direction === 0) {
        direction = nextDirection
        hitAt = voicedSeconds
        startedAt = hitAt
        return false
      }
      const halfPeriod = voicedSeconds - hitAt
      if (halfPeriod + 1e-9 < definition.minimumCycleSeconds / 2) {
        // Rapid detector chatter cannot be accumulated as intentional movement.
        resetWave()
        return false
      }
      alternations++
      direction = nextDirection
      hitAt = voicedSeconds
      return false
    },
    advanceTo,
    charge: () =>
      complete ? 1 : Math.min(0.95, alternations / requiredAlternations),
  }
}
