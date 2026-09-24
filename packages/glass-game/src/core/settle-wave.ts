// Settle then wave — retain the learned steady note while retrying a fresh gentle gesture.

import type { ChallengeDefinition, PitchObservation } from '../contracts'
import type { ChallengeJudge, ChallengeJudgeEvent } from './challenge-contracts'
import { createHoldJudge } from './hold'
import type { WaveJudge } from './wave'
import { createWaveJudge } from './wave'

export function createSettleWaveChallenge(
  definition: ChallengeDefinition & { kind: 'settle-wave' },
  targetMidi: number,
): ChallengeJudge {
  const hold = createHoldJudge(definition.step.hold, targetMidi)
  let wave: WaveJudge | null = null
  let centre = targetMidi
  let complete = false
  let advancedAtMs = -Infinity
  let sequence = -Infinity
  let captureSeconds = -Infinity
  let recent: PitchObservation[] = []
  const none: readonly ChallengeJudgeEvent[] = []
  const advanceTo = (nowMs: number): void => {
    if (!Number.isFinite(nowMs) || nowMs < advancedAtMs) return
    advancedAtMs = nowMs
    if (wave === null) hold.advanceTo(nowMs)
    else wave.advanceTo(nowMs)
  }
  return {
    feed(frame, nowMs) {
      if (
        complete ||
        !Number.isFinite(nowMs) ||
        nowMs < advancedAtMs ||
        !Number.isFinite(frame.sequence) ||
        !Number.isFinite(frame.captureSeconds) ||
        frame.sequence <= sequence ||
        frame.captureSeconds <= captureSeconds
      )
        return none
      advanceTo(nowMs)
      sequence = frame.sequence
      captureSeconds = frame.captureSeconds
      if (wave === null) {
        const age = nowMs - frame.capturedAtMs
        const config = definition.step.hold
        const valid =
          Number.isFinite(age) &&
          age >= -5 &&
          age <= config.maximumSampleAgeMs &&
          frame.midi !== null &&
          Number.isFinite(frame.midi) &&
          Number.isFinite(frame.confidence) &&
          frame.confidence >= config.confidenceFloor &&
          Math.abs(frame.midi - targetMidi) * 100 <= config.toleranceCents
        if (valid) {
          recent = recent.filter(
            (value) => frame.captureSeconds - value.captureSeconds <= 0.4,
          )
          recent.push(frame)
        } else recent = []
        if (!hold.feed(frame, nowMs)) return none
        // Centre the wave on the note actually settled, not calibration rounding.
        const pitches = recent.map((value) => value.midi!).sort((a, b) => a - b)
        centre =
          pitches.length > 0
            ? pitches[Math.floor(pitches.length / 2)]
            : targetMidi
        wave = createWaveJudge(definition.wave, config, centre)
        return [{ type: 'step-complete', completedSteps: 1 }]
      }
      if (!wave.feed(frame, nowMs)) return none
      complete = true
      return [
        { type: 'step-complete', completedSteps: 2 },
        { type: 'complete' },
      ]
    },
    advanceTo,
    tick(seconds) {
      if (
        Number.isFinite(seconds) &&
        seconds > 0 &&
        Number.isFinite(advancedAtMs)
      )
        advanceTo(advancedAtMs + seconds * 1000)
    },
    snapshot() {
      const stepCharge = complete
        ? 1
        : wave === null
          ? hold.charge()
          : wave.charge()
      return {
        kind: 'settle-wave',
        stepIndex: wave === null ? 0 : 1,
        stepCount: 2,
        stepCharge,
        charge: complete ? 1 : ((wave === null ? 0 : 1) + stepCharge) / 2,
        target: definition.step.target,
        targetMidi: centre,
      }
    },
  }
}
