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
}

export interface RunnerJudge {
  observe(evidence: RunnerVoiceEvidence): void
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

function neutralPitchFeedback(): RunnerPitchFeedback {
  return {
    state: 'neutral',
    observedMidi: null,
    comparedTargetMidi: null,
    errorCents: null,
    correction: null,
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
    if (
      accumulated.pendingPitchFeedbackCandidates[index]!.captureCourseSeconds >
      courseSeconds + EPSILON
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
  const activeNote = runnerTargetNoteAt(target.notes, courseSeconds)
  if (
    phase !== 'judging' ||
    candidate === null ||
    candidate.captureCourseSeconds > courseSeconds + EPSILON ||
    courseSeconds - candidate.captureCourseSeconds >
      maximumEvidenceGapSeconds + EPSILON ||
    activeNote?.index !== candidate.noteIndex
  )
    return neutralPitchFeedback()

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
      const note = runnerTargetNoteAt(
        target.notes,
        observation.captureCourseSeconds,
      )
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
      const targetMidi = runnerTargetMidiAt(
        target.notes,
        observation.captureCourseSeconds,
        rootMidi,
      )
      const errorCents = (observation.midi - targetMidi) * 100
      const absoluteErrorCents = Math.abs(errorCents)
      const accepted =
        absoluteErrorCents <= course.voice.judge.centsTolerance + EPSILON
      const feedbackCandidate: PitchFeedbackCandidate = {
        noteIndex: note.index,
        captureCourseSeconds: observation.captureCourseSeconds,
        observedMidi: observation.midi,
        comparedTargetMidi: targetMidi,
        errorCents,
        state: accepted ? 'accepted' : 'wrong',
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
            note.startCourseSeconds,
            previous.captureCourseSeconds,
          )
          const clippedEnd = Math.min(
            note.endCourseSeconds,
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
      accumulated.previousReliable = {
        noteIndex: note.index,
        captureCourseSeconds: observation.captureCourseSeconds,
        absoluteErrorCents,
      }
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
      const grade =
        everyNoteReliable && meanAbsoluteCents !== null
          ? ([...course.voice.judge.gradeBands]
              .sort((left, right) => right.grade - left.grade)
              .find(
                (band) =>
                  meanAbsoluteCents <= band.maximumMeanAbsoluteCents + EPSILON,
              )?.grade ?? null)
          : null
      return {
        targetId: target.id,
        outcome: grade === null ? 'miss' : 'hit',
        grade,
        resolvedAtCourseSeconds: target.settleAfterCourseSeconds,
        reliableSeconds,
        meanAbsoluteCents,
      }
    },
    targetSnapshot(target, courseSeconds) {
      const accumulated = targetEvidence(target)
      const phase = phaseForTarget(target, courseSeconds)
      const activeNote =
        runnerTargetNoteAt(target.notes, courseSeconds) ??
        (courseSeconds < target.onsetCourseSeconds
          ? target.notes[0]!
          : target.notes.at(-1)!)
      return {
        id: target.id,
        ...phase,
        noteIndex: activeNote.index,
        currentTargetMidi: runnerTargetMidiAt(
          target.notes,
          courseSeconds,
          rootMidi,
        ),
        pitchFeedback: projectPitchFeedback(
          target,
          accumulated,
          phase.phase,
          courseSeconds,
          course.voice.judge.maximumEvidenceGapSeconds,
        ),
        notes: target.notes.map((note) => {
          const fillProgress = clamp01(
            accumulated.notes[note.index]!.reliableSeconds /
              note.minimumReliableSeconds,
          )
          return {
            index: note.index,
            startMidi: rootMidi + note.startOffsetSemitones,
            endMidi: rootMidi + note.endOffsetSemitones,
            targetMidi: rootMidi + note.endOffsetSemitones,
            fillProgress,
            state:
              fillProgress >= 1
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
