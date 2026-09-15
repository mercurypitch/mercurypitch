// Held-note judging — only consecutive fresh capture observations earn elapsed credit.

import type { HoldDefinition, PitchObservation } from '../contracts'

export interface HoldJudge {
  feed(frame: PitchObservation, nowMs: number): boolean
  tick(seconds: number): void
  /** Absolute foreground clock shared by capture callbacks and render ticks. */
  advanceTo(nowMs: number): void
  charge(): number
}

export function createHoldJudge(
  config: HoldDefinition,
  targetMidi: number,
): HoldJudge {
  let charge = 0
  let sequence = -Infinity
  let captureSeconds = -Infinity
  let previousValid = false
  let secondsSinceValid = Infinity
  let advancedAtMs: number | null = null

  const advanceTo = (nowMs: number): void => {
    if (
      !Number.isFinite(nowMs) ||
      (advancedAtMs !== null && nowMs < advancedAtMs)
    )
      return
    const seconds = advancedAtMs === null ? 0 : (nowMs - advancedAtMs) / 1000
    advancedAtMs = nowMs
    if (secondsSinceValid === Infinity) return
    const before = Math.max(0, secondsSinceValid - config.dropoutGraceSeconds)
    secondsSinceValid += seconds
    const after = Math.max(0, secondsSinceValid - config.dropoutGraceSeconds)
    charge = Math.max(0, charge - (after - before) * config.decayPerSecond)
  }

  return {
    feed(frame, nowMs) {
      if (
        !Number.isFinite(nowMs) ||
        (advancedAtMs !== null && nowMs < advancedAtMs)
      )
        return false
      advanceTo(nowMs)
      if (
        !Number.isFinite(frame.sequence) ||
        !Number.isFinite(frame.captureSeconds) ||
        frame.sequence <= sequence ||
        frame.captureSeconds <= captureSeconds
      )
        return charge >= 1
      const elapsed = frame.captureSeconds - captureSeconds
      sequence = frame.sequence
      captureSeconds = frame.captureSeconds
      const age = nowMs - frame.capturedAtMs
      const valid =
        Number.isFinite(age) &&
        age >= -5 &&
        age <= config.maximumSampleAgeMs &&
        frame.midi !== null &&
        Number.isFinite(frame.midi) &&
        Number.isFinite(frame.confidence) &&
        frame.confidence >= config.confidenceFloor &&
        Math.abs(frame.midi - targetMidi) * 100 <= config.toleranceCents
      if (
        valid &&
        previousValid &&
        elapsed <= config.maximumSampleGapSeconds + 1e-9
      ) {
        charge = Math.min(1, charge + elapsed / config.requiredSeconds)
      }
      if (valid) secondsSinceValid = Math.max(0, age / 1000)
      previousValid = valid
      return charge >= 1 - 1e-9
    },
    tick(seconds) {
      if (advancedAtMs !== null && Number.isFinite(seconds) && seconds > 0)
        advanceTo(advancedAtMs + seconds * 1000)
    },
    advanceTo,
    charge: () => charge,
  }
}
