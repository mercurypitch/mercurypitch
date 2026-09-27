// Melody challenge adapters — held anchor stations and one capture-clock contour finale.

import type { MelodyAnchorChallengeDefinition, MelodyChallengeDefinition, MelodyContourChallengeProgress, } from '../contracts'
import type { ChallengeJudge, ChallengeJudgeEvent } from './challenge-contracts'
import { createHoldJudge } from './hold'
import type { ResolvedMelodyAttempt } from './melody-attempt'
import type { MelodyJudgeEvent } from './melody-judge'
import { createMelodyJudge } from './melody-judge'

const NO_EVENTS: readonly ChallengeJudgeEvent[] = []

function anchorTargetMidi(
  definition: MelodyAnchorChallengeDefinition,
  attempt: ResolvedMelodyAttempt,
): number {
  const station = attempt.lesson.stations.find(
    (candidate) =>
      candidate.anchorId === definition.anchorId &&
      attempt.lesson.id === definition.lessonId,
  )
  const anchor = attempt.melody.anchors.find(
    (candidate) => candidate.id === definition.anchorId,
  )
  if (station === undefined || anchor === undefined)
    throw new Error(`Unknown melody anchor ${definition.anchorId}.`)
  return anchor.midi
}

function createAnchorJudge(
  definition: MelodyAnchorChallengeDefinition,
  attempt: ResolvedMelodyAttempt,
): ChallengeJudge {
  const targetMidi = anchorTargetMidi(definition, attempt)
  const hold = createHoldJudge(definition.step.hold, targetMidi)
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
      targetKind: 'melody-anchor',
      stepIndex: 0,
      stepCount: 1,
      stepCharge: complete ? 1 : hold.charge(),
      charge: complete ? 1 : hold.charge(),
      target: definition.anchorId,
      targetMidi,
    }),
  }
}

function challengeEvents(
  events: readonly MelodyJudgeEvent[],
  coveredCount: number,
): readonly ChallengeJudgeEvent[] {
  if (events.length === 0) return NO_EVENTS
  const mapped: ChallengeJudgeEvent[] = []
  if (events.some((event) => event.type === 'anchor-complete'))
    mapped.push({ type: 'step-complete', completedSteps: coveredCount })
  if (events.some((event) => event.type === 'complete'))
    mapped.push({ type: 'complete' })
  return mapped
}

function createContourJudge(
  definition: MelodyChallengeDefinition & { kind: 'melody-contour' },
  attempt: ResolvedMelodyAttempt,
): ChallengeJudge {
  const melody = attempt.melody
  const judge = createMelodyJudge(melody, attempt.lesson.judgePolicy)
  let presentationNowMs: number | null = null

  const snapshot = (): MelodyContourChallengeProgress => {
    const melodyJudge = judge.snapshot()
    const coveredCount = melodyJudge.coveredAnchorIds.length
    const stepIndex = Math.min(coveredCount, melody.anchors.length - 1)
    const target =
      melody.anchors.find(
        (anchor) => !melodyJudge.coveredAnchorIds.includes(anchor.id),
      ) ?? melody.anchors[melody.anchors.length - 1]!
    return {
      kind: definition.kind,
      targetKind: 'melody-contour',
      stepIndex,
      stepCount: melody.anchors.length,
      stepCharge: melodyJudge.complete
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              melodyJudge.progress * melody.anchors.length - stepIndex,
            ),
          ),
      charge: melodyJudge.progress,
      target: target.id,
      targetMidi: melodyJudge.targetMidi,
      melodyJudge,
    }
  }

  return {
    feed(frame, nowMs) {
      presentationNowMs = nowMs
      const events = judge.feed(frame, nowMs)
      return challengeEvents(events, judge.snapshot().coveredAnchorIds.length)
    },
    tick(seconds) {
      if (!Number.isFinite(seconds) || seconds <= 0) return
      presentationNowMs = (presentationNowMs ?? 0) + seconds * 1000
      judge.advanceTo(presentationNowMs)
    },
    advanceTo(nowMs) {
      if (!Number.isFinite(nowMs)) return
      presentationNowMs = nowMs
      judge.advanceTo(nowMs)
    },
    snapshot,
  }
}

export function createMelodyChallengeJudge(
  definition: MelodyChallengeDefinition,
  attempt: ResolvedMelodyAttempt,
): ChallengeJudge {
  if (definition.lessonId !== attempt.lesson.id)
    throw new Error('Melody challenge belongs to another lesson.')
  return definition.kind === 'melody-anchor'
    ? createAnchorJudge(definition, attempt)
    : createContourJudge(definition, attempt)
}
