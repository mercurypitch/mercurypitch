// ============================================================
// Song runner judge — capture-time note evidence with bounded late settlement.
// ============================================================

import type { CompiledRunnerCourse, CompiledRunnerTarget, RunnerPitchFeedback, RunnerTargetResult, RunnerTargetSnapshot, RunnerVoiceEvidence, } from './contracts'
import { runnerTargetMidiAt, runnerTargetNoteAt } from './pitch'

const EPSILON = 1e-9

interface NoteEvidence {
  reliableSeconds: number
  absoluteCentSeconds: number
}

interface ReliableEndpoint {
  noteIndex: number
  captureCourseSeconds: number
  absoluteErrorCents: number
}

interface PitchFeedbackCandidate {
  readonly noteIndex: number
  readonly captureCourseSeconds: number
  readonly receivedCourseSeconds: number
  readonly observedMidi: number
  readonly comparedTargetMidi: number
  readonly errorCents: number
  readonly state: 'accepted' | 'wrong'
}

interface TargetEvidence {
  readonly notes: NoteEvidence[]
  previousReliable: ReliableEndpoint | null
  pitchFeedbackCandidate: PitchFeedbackCandidate | null
  readonly pendingPitchFeedbackCandidates: PitchFeedbackCandidate[]
  completedAtCourseSeconds: number | null
}

export interface RunnerJudge {
  observe(evidence: RunnerVoiceEvidence): void
  completionAtCourseSeconds(target: CompiledRunnerTarget): number | null
  result(target: CompiledRunnerTarget): RunnerTargetResult
  targetSnapshot(
    target: CompiledRunnerTarget,
    courseSeconds: number,
  ): RunnerTargetSnapshot
  resetTargets(targetIds: ReadonlySet<string>): void
  clearContinuity(): void
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function neutralRunnerPitchFeedback(): RunnerPitchFeedback {
  return {
    state: 'neutral',
    observedMidi: null,
    comparedTargetMidi: null,
    errorCents: null,
    correction: null,
  }
}

export function classifyRunnerPitchFeedback(
  observedMidi: number | null,
  comparedTargetMidi: number,
  confidence: number,
  minimumConfidence: number,
  centsTolerance: number,
): RunnerPitchFeedback {
  if (
    observedMidi === null ||
    !Number.isFinite(observedMidi) ||
    !Number.isFinite(comparedTargetMidi) ||
    !Number.isFinite(confidence) ||
    confidence < minimumConfidence ||
    confidence > 1
  )
    return neutralRunnerPitchFeedback()
  const errorCents = (observedMidi - comparedTargetMidi) * 100
  if (Math.abs(errorCents) <= centsTolerance + EPSILON)
    return {
      state: 'accepted',
      observedMidi,
      comparedTargetMidi,
      errorCents,
      correction: null,
    }
  return {
    state: 'wrong',
    observedMidi,
    comparedTargetMidi,
    errorCents,
    correction: errorCents < 0 ? 'higher' : 'lower',
  }
}

function projectPitchFeedback(
  target: CompiledRunnerTarget,
  accumulated: TargetEvidence,
  phase: RunnerTargetSnapshot['phase'],
  courseSeconds: number,
  maximumEvidenceGapSeconds: number,
): RunnerPitchFeedback {
  let latestEligibleIndex = -1
  for (
    let index = 0;
    index < accumulated.pendingPitchFeedbackCandidates.length;
    index++
  ) {
    const candidate = accumulated.pendingPitchFeedbackCandidates[index]!
    if (
      candidate.captureCourseSeconds > courseSeconds + EPSILON ||
      candidate.receivedCourseSeconds > courseSeconds + EPSILON
    )
      break
    latestEligibleIndex = index
  }
  if (latestEligibleIndex >= 0) {
    accumulated.pitchFeedbackCandidate =
      accumulated.pendingPitchFeedbackCandidates[latestEligibleIndex]!
    accumulated.pendingPitchFeedbackCandidates.splice(
      0,
      latestEligibleIndex + 1,
    )
  }
  const candidate = accumulated.pitchFeedbackCandidate
  const activeNote =
    target.completionPolicy === 'charge'
      ? target.notes.find(
          (note) =>
            accumulated.notes[note.index]!.reliableSeconds + EPSILON <
            note.minimumReliableSeconds,
        )
      : runnerTargetNoteAt(target.notes, courseSeconds)
  if (
    phase !== 'judging' ||
    candidate === null ||
    candidate.captureCourseSeconds > courseSeconds + EPSILON ||
    courseSeconds - candidate.receivedCourseSeconds >
      maximumEvidenceGapSeconds + EPSILON ||
    activeNote?.index !== candidate.noteIndex
  )
    return neutralRunnerPitchFeedback()

  if (candidate.state === 'accepted') {
    return {
      state: 'accepted',
      observedMidi: candidate.observedMidi,
      comparedTargetMidi: candidate.comparedTargetMidi,
      errorCents: candidate.errorCents,
      correction: null,
    }
  }
  return {
    state: 'wrong',
    observedMidi: candidate.observedMidi,
    comparedTargetMidi: candidate.comparedTargetMidi,
    errorCents: candidate.errorCents,
    correction: candidate.errorCents < 0 ? 'higher' : 'lower',
  }
}

function phaseForTarget(
  target: CompiledRunnerTarget,
  courseSeconds: number,
): Pick<
  RunnerTargetSnapshot,
  | 'phase'
  | 'phaseStartCourseSeconds'
  | 'phaseEndCourseSeconds'
  | 'phaseProgress'
> {
  let phase: RunnerTargetSnapshot['phase']
  let start: number
  let end: number
  if (courseSeconds < target.emphasizedFromCourseSeconds) {
    phase = 'approaching'
    start = target.visibleFromCourseSeconds
    end = target.emphasizedFromCourseSeconds
  } else if (courseSeconds < target.judgeOpenCourseSeconds) {
    phase = 'emphasized'
    start = target.emphasizedFromCourseSeconds
    end = target.judgeOpenCourseSeconds
  } else if (courseSeconds <= target.judgeCloseCourseSeconds) {
    phase = 'judging'
    start = target.judgeOpenCourseSeconds
    end = target.judgeCloseCourseSeconds
  } else {
    phase = 'settling'
    start = target.judgeCloseCourseSeconds
    end = target.settleAfterCourseSeconds
  }
  return {
    phase,
    phaseStartCourseSeconds: start,
    phaseEndCourseSeconds: end,
    phaseProgress:
      end <= start ? 1 : clamp01((courseSeconds - start) / (end - start)),
  }
}

export function createRunnerJudge(
  course: CompiledRunnerCourse,
  comfortableMidi: number,
): RunnerJudge {
  const rootMidi = comfortableMidi + course.voice.comfortableRootOffsetSemitones
  const targetById = new Map(
    course.targets.map((target) => [target.id, target]),
  )
  // The simulation may trail an accepted capture by one fixed step. Retain a
  // bounded delivery window so newer future captures cannot hide the latest
  // eligible one, including when several detector hops arrive before a read.
  const maximumPendingPitchFeedbackCandidates = Math.max(
    2,
    Math.ceil(
      course.voice.judge.maximumDeliveryLatencySeconds /
        course.movement.fixedStepSeconds,
    ) + 2,
  )
  const evidenceByTarget = new Map<string, TargetEvidence>()
  let continuityTargetId: string | null = null

  const targetEvidence = (target: CompiledRunnerTarget): TargetEvidence => {
    const existing = evidenceByTarget.get(target.id)
    if (existing !== undefined) return existing
    const created: TargetEvidence = {
      notes: target.notes.map(() => ({
        reliableSeconds: 0,
        absoluteCentSeconds: 0,
      })),
      previousReliable: null,
      pitchFeedbackCandidate: null,
      pendingPitchFeedbackCandidates: [],
      completedAtCourseSeconds: null,
    }
    evidenceByTarget.set(target.id, created)
    return created
  }

  const clearContinuity = (): void => {
    if (continuityTargetId !== null) {
      const evidence = evidenceByTarget.get(continuityTargetId)
      if (evidence !== undefined) {
        evidence.previousReliable = null
        evidence.pitchFeedbackCandidate = null
        evidence.pendingPitchFeedbackCandidates.length = 0
      }
    }
    continuityTargetId = null
  }

  return {
    observe(observation) {
      const target = course.targets.find(
        (candidate) =>
          observation.captureCourseSeconds >=
            candidate.judgeOpenCourseSeconds - EPSILON &&
          observation.captureCourseSeconds <=
            candidate.judgeCloseCourseSeconds + EPSILON,
      )
      if (target === undefined) {
        clearContinuity()
        return
      }
      if (continuityTargetId !== null && continuityTargetId !== target.id)
        clearContinuity()
      continuityTargetId = target.id
      const accumulated = targetEvidence(target)
      const note =
        target.completionPolicy === 'charge'
          ? observation.captureCourseSeconds >=
              target.onsetCourseSeconds - EPSILON &&
            observation.captureCourseSeconds <=
              target.endCourseSeconds + EPSILON &&
            accumulated.completedAtCourseSeconds === null
            ? target.notes.find(
                (candidate) =>
                  accumulated.notes[candidate.index]!.reliableSeconds +
                    EPSILON <
                  candidate.minimumReliableSeconds,
              )
            : undefined
          : runnerTargetNoteAt(target.notes, observation.captureCourseSeconds)
      if (
        note === undefined ||
        observation.midi === null ||
        observation.confidence < course.voice.judge.minimumConfidence
      ) {
        accumulated.previousReliable = null
        accumulated.pitchFeedbackCandidate = null
        accumulated.pendingPitchFeedbackCandidates.length = 0
        return
      }
      const targetMidi =
        target.completionPolicy === 'charge'
          ? rootMidi + note.endOffsetSemitones
          : runnerTargetMidiAt(
              target.notes,
              observation.captureCourseSeconds,
              rootMidi,
            )
      const feedback = classifyRunnerPitchFeedback(
        observation.midi,
        targetMidi,
        observation.confidence,
        course.voice.judge.minimumConfidence,
        course.voice.judge.centsTolerance,
      )
      if (feedback.state === 'neutral') {
        accumulated.previousReliable = null
        accumulated.pitchFeedbackCandidate = null
        accumulated.pendingPitchFeedbackCandidates.length = 0
        return
      }
      const absoluteErrorCents = Math.abs(feedback.errorCents)
      const accepted = feedback.state === 'accepted'
      const feedbackCandidate: PitchFeedbackCandidate = {
        noteIndex: note.index,
        captureCourseSeconds: observation.captureCourseSeconds,
        receivedCourseSeconds: observation.receivedCourseSeconds,
        observedMidi: feedback.observedMidi,
        comparedTargetMidi: feedback.comparedTargetMidi,
        errorCents: feedback.errorCents,
        state: feedback.state,
      }
      accumulated.pendingPitchFeedbackCandidates.push(feedbackCandidate)
      if (
        accumulated.pendingPitchFeedbackCandidates.length >
        maximumPendingPitchFeedbackCandidates
      )
        accumulated.pendingPitchFeedbackCandidates.splice(
          0,
          accumulated.pendingPitchFeedbackCandidates.length -
            maximumPendingPitchFeedbackCandidates,
        )
      if (!accepted) {
        accumulated.previousReliable = null
        return
      }
      const previous = accumulated.previousReliable
      if (previous !== null && previous.noteIndex === note.index) {
        const delta =
          observation.captureCourseSeconds - previous.captureCourseSeconds
        if (
          delta > 0 &&
          delta <= course.voice.judge.maximumEvidenceGapSeconds + EPSILON
        ) {
          const clippedStart = Math.max(
            target.completionPolicy === 'charge'
              ? target.onsetCourseSeconds
              : note.startCourseSeconds,
            previous.captureCourseSeconds,
          )
          const clippedEnd = Math.min(
            target.completionPolicy === 'charge'
              ? target.endCourseSeconds
              : note.endCourseSeconds,
            observation.captureCourseSeconds,
          )
          const creditedSeconds = Math.max(0, clippedEnd - clippedStart)
          const noteEvidence = accumulated.notes[note.index]!
          noteEvidence.reliableSeconds += creditedSeconds
          noteEvidence.absoluteCentSeconds +=
            ((previous.absoluteErrorCents + absoluteErrorCents) / 2) *
            creditedSeconds
        }
      }
      const noteComplete =
        accumulated.notes[note.index]!.reliableSeconds + EPSILON >=
        note.minimumReliableSeconds
      if (target.completionPolicy === 'charge' && noteComplete) {
        accumulated.previousReliable = null
        if (
          accumulated.completedAtCourseSeconds === null &&
          target.notes.every(
            (candidate) =>
              accumulated.notes[candidate.index]!.reliableSeconds + EPSILON >=
              candidate.minimumReliableSeconds,
          )
        )
          accumulated.completedAtCourseSeconds =
            observation.receivedCourseSeconds
      } else {
        accumulated.previousReliable = {
          noteIndex: note.index,
          captureCourseSeconds: observation.captureCourseSeconds,
          absoluteErrorCents,
        }
      }
    },
    completionAtCourseSeconds(target) {
      return target.completionPolicy === 'charge'
        ? targetEvidence(target).completedAtCourseSeconds
        : null
    },
    result(target) {
      const accumulated = targetEvidence(target)
      const reliableSeconds = accumulated.notes.reduce(
        (sum, note) => sum + note.reliableSeconds,
        0,
      )
      const absoluteCentSeconds = accumulated.notes.reduce(
        (sum, note) => sum + note.absoluteCentSeconds,
        0,
      )
      const meanAbsoluteCents =
        reliableSeconds > 0 ? absoluteCentSeconds / reliableSeconds : null
      const everyNoteReliable = target.notes.every(
        (note) =>
          accumulated.notes[note.index]!.reliableSeconds + EPSILON >=
          note.minimumReliableSeconds,
      )
      let grade =
        everyNoteReliable && meanAbsoluteCents !== null
          ? ([...course.voice.judge.gradeBands]
              .sort((left, right) => right.grade - left.grade)
              .find(
                (band) =>
                  meanAbsoluteCents <= band.maximumMeanAbsoluteCents + EPSILON,
              )?.grade ?? null)
          : null
      if (
        target.completionPolicy === 'charge' &&
        everyNoteReliable &&
        meanAbsoluteCents !== null &&
        meanAbsoluteCents <= course.voice.judge.centsTolerance + EPSILON &&
        grade === null
      )
        grade = 1
      return {
        targetId: target.id,
        outcome: grade === null ? 'miss' : 'hit',
        grade,
        resolvedAtCourseSeconds:
          target.completionPolicy === 'charge' &&
          accumulated.completedAtCourseSeconds !== null
            ? accumulated.completedAtCourseSeconds
            : target.settleAfterCourseSeconds,
        reliableSeconds,
        meanAbsoluteCents,
      }
    },
    targetSnapshot(target, courseSeconds) {
      const accumulated = targetEvidence(target)
      const phase = phaseForTarget(target, courseSeconds)
      const activeNote =
        (target.completionPolicy === 'charge'
          ? target.notes.find(
              (note) =>
                accumulated.notes[note.index]!.reliableSeconds + EPSILON <
                note.minimumReliableSeconds,
            )
          : runnerTargetNoteAt(target.notes, courseSeconds)) ??
        (courseSeconds < target.onsetCourseSeconds
          ? target.notes[0]!
          : target.notes.at(-1)!)
      return {
        id: target.id,
        ...phase,
        noteIndex: activeNote.index,
        currentTargetMidi:
          target.completionPolicy === 'charge'
            ? rootMidi + activeNote.endOffsetSemitones
            : runnerTargetMidiAt(target.notes, courseSeconds, rootMidi),
        pitchFeedback: projectPitchFeedback(
          target,
          accumulated,
          phase.phase,
          courseSeconds,
          course.voice.judge.maximumEvidenceGapSeconds,
        ),
        notes: target.notes.map((note) => {
          const noteEvidence = accumulated.notes[note.index]!
          const complete =
            noteEvidence.reliableSeconds + EPSILON >=
            note.minimumReliableSeconds
          const fillProgress = complete
            ? 1
            : clamp01(
                noteEvidence.reliableSeconds / note.minimumReliableSeconds,
              )
          return {
            index: note.index,
            startMidi: rootMidi + note.startOffsetSemitones,
            endMidi: rootMidi + note.endOffsetSemitones,
            targetMidi: rootMidi + note.endOffsetSemitones,
            fillProgress,
            state: complete
              ? ('filled' as const)
              : fillProgress > 0
                ? ('filling' as const)
                : ('hollow' as const),
          }
        }),
      }
    },
    resetTargets(targetIds) {
      for (const targetId of targetIds) {
        if (targetById.has(targetId)) evidenceByTarget.delete(targetId)
      }
      if (continuityTargetId !== null && targetIds.has(continuityTargetId))
        continuityTargetId = null
    },
    clearContinuity,
  }
}
