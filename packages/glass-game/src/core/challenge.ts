// Pitch challenge judging — dispatch held notes and ordered pairs over one capture-clock contract.

import type { ChallengeDefinition, PitchObservation, PitchStepDefinition, PitchTargetId, PitchTargets, } from '../contracts'
import type { HoldJudge } from './hold'
import { createHoldJudge } from './hold'

export interface ChallengeProgress {
  kind: ChallengeDefinition['kind']
  stepIndex: number
  stepCount: number
  stepCharge: number
  charge: number
  target: PitchTargetId
  targetMidi: number
}

export type ChallengeJudgeEvent =
  | { type: 'step-complete'; completedSteps: number }
  | { type: 'reset'; reason: 'wrong-order' }
  | { type: 'complete' }

export interface ChallengeJudge {
  feed(frame: PitchObservation, nowMs: number): readonly ChallengeJudgeEvent[]
  tick(seconds: number): void
  /** Absolute foreground clock shared by capture callbacks and render ticks. */
  advanceTo(nowMs: number): void
  snapshot(): ChallengeProgress
}

export type ChallengeTargetError =
  | { reason: 'missing-target'; target: PitchTargetId }
  | { reason: 'invalid-target'; target: PitchTargetId }
  | {
      reason: 'ambiguous-targets'
      targets: readonly [PitchTargetId, PitchTargetId]
    }

export type ChallengeJudgeResult =
  | { ok: true; judge: ChallengeJudge }
  | ({ ok: false } & ChallengeTargetError)

interface ResolvedStep {
  definition: PitchStepDefinition
  midi: number
}

const NO_EVENTS: readonly ChallengeJudgeEvent[] = []

function resolveStep(
  step: PitchStepDefinition,
  targets: PitchTargets,
): ResolvedStep | ChallengeTargetError {
  const midi = targets[step.target]
  if (midi === undefined)
    return { reason: 'missing-target', target: step.target }
  if (!Number.isFinite(midi) || midi < 0 || midi > 127)
    return { reason: 'invalid-target', target: step.target }
  return { definition: step, midi }
}

function isTargetError(
  value: ResolvedStep | ChallengeTargetError,
): value is ChallengeTargetError {
  return 'reason' in value
}

function matchesStep(
  step: ResolvedStep,
  frame: PitchObservation,
  nowMs: number,
): boolean {
  const age = nowMs - frame.capturedAtMs
  const hold = step.definition.hold
  return (
    Number.isFinite(age) &&
    age >= -5 &&
    age <= hold.maximumSampleAgeMs &&
    frame.midi !== null &&
    Number.isFinite(frame.midi) &&
    Number.isFinite(frame.confidence) &&
    frame.confidence >= hold.confidenceFloor &&
    Math.abs(frame.midi - step.midi) * 100 <= hold.toleranceCents
  )
}

function createHoldChallenge(
  definition: ChallengeDefinition & { kind: 'hold' },
  step: ResolvedStep,
): ChallengeJudge {
  const hold = createHoldJudge(step.definition.hold, step.midi)
  let complete = false
  return {
    feed(frame, nowMs) {
      if (complete || !hold.feed(frame, nowMs)) return NO_EVENTS
      complete = true
      return [
        { type: 'step-complete', completedSteps: 1 },
        { type: 'complete' },
      ]
    },
    tick(seconds) {
      if (!complete) hold.tick(seconds)
    },
    advanceTo(nowMs) {
      if (!complete) hold.advanceTo(nowMs)
    },
    snapshot: () => ({
      kind: definition.kind,
      stepIndex: 0,
      stepCount: 1,
      stepCharge: complete ? 1 : hold.charge(),
      charge: complete ? 1 : hold.charge(),
      target: step.definition.target,
      targetMidi: step.midi,
    }),
  }
}

function createOrderedPairChallenge(
  definition: ChallengeDefinition & { kind: 'ordered-pair' },
  steps: readonly [ResolvedStep, ResolvedStep],
): ChallengeJudge {
  let completedSteps = 0
  let sequence = -Infinity
  let captureSeconds = -Infinity
  let advancedAtMs: number | null = null
  let expected: HoldJudge
  let competing: HoldJudge
  let competingStep: ResolvedStep
  let competingArmed = true

  const resetJudges = (): void => {
    const expectedIndex = Math.min(completedSteps, 1)
    const competingIndex = expectedIndex === 0 ? 1 : 0
    expected = createHoldJudge(
      steps[expectedIndex].definition.hold,
      steps[expectedIndex].midi,
    )
    competing = createHoldJudge(
      steps[competingIndex].definition.hold,
      steps[competingIndex].midi,
    )
    competingStep = steps[competingIndex]
    // Let the completed first note trail off naturally. Once the singer leaves
    // it, a fresh stabilized return is a real out-of-order restart.
    competingArmed = completedSteps === 0
  }
  resetJudges()

  return {
    feed(frame, nowMs) {
      if (
        completedSteps >= steps.length ||
        !Number.isFinite(nowMs) ||
        (advancedAtMs !== null && nowMs < advancedAtMs) ||
        !Number.isFinite(frame.sequence) ||
        !Number.isFinite(frame.captureSeconds) ||
        frame.sequence <= sequence ||
        frame.captureSeconds <= captureSeconds
      )
        return NO_EVENTS
      advancedAtMs = nowMs
      sequence = frame.sequence
      captureSeconds = frame.captureSeconds
      if (expected.feed(frame, nowMs)) {
        completedSteps++
        const events: ChallengeJudgeEvent[] = [
          { type: 'step-complete', completedSteps },
        ]
        if (completedSteps >= steps.length) events.push({ type: 'complete' })
        else resetJudges()
        return events
      }
      if (!competingArmed) {
        if (!matchesStep(competingStep, frame, nowMs)) competingArmed = true
        return NO_EVENTS
      }
      if (!competing.feed(frame, nowMs)) return NO_EVENTS
      completedSteps = 0
      resetJudges()
      return [{ type: 'reset', reason: 'wrong-order' }]
    },
    tick(seconds) {
      if (completedSteps >= steps.length) return
      if (advancedAtMs !== null && Number.isFinite(seconds) && seconds > 0)
        advancedAtMs += seconds * 1000
      expected.tick(seconds)
      competing.tick(seconds)
    },
    advanceTo(nowMs) {
      if (completedSteps >= steps.length) return
      if (
        !Number.isFinite(nowMs) ||
        (advancedAtMs !== null && nowMs < advancedAtMs)
      )
        return
      advancedAtMs = nowMs
      expected.advanceTo(nowMs)
      competing.advanceTo(nowMs)
    },
    snapshot() {
      const stepIndex = Math.min(completedSteps, steps.length - 1)
      const stepCharge = completedSteps >= steps.length ? 1 : expected.charge()
      return {
        kind: definition.kind,
        stepIndex,
        stepCount: steps.length,
        stepCharge,
        charge:
          completedSteps >= steps.length
            ? 1
            : (completedSteps + stepCharge) / steps.length,
        target: steps[stepIndex].definition.target,
        targetMidi: steps[stepIndex].midi,
      }
    },
  }
}

/** Resolve session-calibrated targets before any reference tone or scoring starts. */
export function createChallengeJudge(
  definition: ChallengeDefinition,
  suppliedTargets: number | PitchTargets,
): ChallengeJudgeResult {
  const targets: PitchTargets =
    typeof suppliedTargets === 'number'
      ? { comfortable: suppliedTargets }
      : suppliedTargets
  if (definition.kind === 'hold') {
    const step = resolveStep(definition.step, targets)
    return isTargetError(step)
      ? { ok: false, ...step }
      : { ok: true, judge: createHoldChallenge(definition, step) }
  }

  const first = resolveStep(definition.steps[0], targets)
  if (isTargetError(first)) return { ok: false, ...first }
  const second = resolveStep(definition.steps[1], targets)
  if (isTargetError(second)) return { ok: false, ...second }
  if (
    first.definition.target === second.definition.target ||
    Math.abs(first.midi - second.midi) * 100 <=
      first.definition.hold.toleranceCents +
        second.definition.hold.toleranceCents
  )
    return {
      ok: false,
      reason: 'ambiguous-targets',
      targets: [first.definition.target, second.definition.target],
    }
  return {
    ok: true,
    judge: createOrderedPairChallenge(definition, [first, second]),
  }
}
