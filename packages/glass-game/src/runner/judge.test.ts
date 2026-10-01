// ============================================================
// Song runner judge tests — ordered evidence, per-note minimums, and grading.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { CompiledRunnerNote, CompiledRunnerTarget, RunnerVoiceEvidence, } from './contracts'
import { SINGING_CURRENT } from './first-course'
import type { RunnerJudge } from './judge'
import { createRunnerJudge } from './judge'
import { runnerTargetMidiAt } from './pitch'

const course = SINGING_CURRENT
const rootMidi = 60 + course.voice.comfortableRootOffsetSemitones

function evidence(
  target: CompiledRunnerTarget,
  captureCourseSeconds: number,
  errorCents = 0,
  overrides: Partial<RunnerVoiceEvidence> = {},
): RunnerVoiceEvidence {
  return {
    epoch: 'judge',
    sequence: 0,
    captureCourseSeconds,
    receivedCourseSeconds: captureCourseSeconds,
    midi:
      runnerTargetMidiAt(target.notes, captureCourseSeconds, rootMidi) +
      errorCents / 100,
    confidence: 1,
    ...overrides,
  }
}

function fillNote(
  judge: RunnerJudge,
  target: CompiledRunnerTarget,
  note: CompiledRunnerNote,
): void {
  const step = Math.min(
    course.voice.judge.maximumEvidenceGapSeconds / 2,
    (note.endCourseSeconds - note.startCourseSeconds) / 10,
  )
  for (
    let capture = note.startCourseSeconds;
    capture < note.endCourseSeconds - 1e-6;
    capture += step
  )
    judge.observe(evidence(target, capture))
  const finalCapture = note.endCourseSeconds - 1e-6
  judge.observe(evidence(target, finalCapture))
}

describe('song runner judge', () => {
  it('publishes detached neutral feedback before reliable judging evidence', () => {
    const target = course.targets[0]!
    const judge = createRunnerJudge(course, 60)

    const first = judge.targetSnapshot(target, target.visibleFromCourseSeconds)
    const second = judge.targetSnapshot(
      target,
      target.judgeOpenCourseSeconds + 0.001,
    )

    expect(first.pitchFeedback).toEqual({
      state: 'neutral',
      observedMidi: null,
      comparedTargetMidi: null,
      errorCents: null,
      correction: null,
    })
    expect(second.pitchFeedback).toEqual(first.pitchFeedback)
    expect(second.pitchFeedback).not.toBe(first.pitchFeedback)
  })

  it('requires every note even when repeated pitches have ample aggregate evidence', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'melody-finale',
    )!
    const judge = createRunnerJudge(course, 60)
    for (const note of target.notes) {
      if (note.index !== 2) fillNote(judge, target, note)
    }
    const result = judge.result(target)
    const requiredExceptMiddle = target.notes
      .filter((note) => note.index !== 2)
      .reduce((total, note) => total + note.minimumReliableSeconds, 0)
    expect(result.reliableSeconds).toBeGreaterThan(requiredExceptMiddle)
    expect(result.meanAbsoluteCents).toBeCloseTo(0, 8)
    expect(result).toMatchObject({ outcome: 'miss', grade: null })
  })

  it('uses duration-weighted trapezoidal error and strongest matching grade', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const note = target.notes[0]!
    const judge = createRunnerJudge(course, 60)
    const longGap = course.voice.judge.maximumEvidenceGapSeconds
    const shortGap = longGap / 3
    const gaps: number[] = []
    let reliableSeconds = 0
    while (reliableSeconds < note.minimumReliableSeconds) {
      const gap = gaps.length % 2 === 0 ? longGap : shortGap
      gaps.push(gap)
      reliableSeconds += gap
    }
    if (gaps.length % 2 !== 0) {
      gaps.push(shortGap)
      reliableSeconds += shortGap
    }
    const lowErrorIntervals = gaps.length / 2
    const samples: { time: number; error: number }[] = [
      { time: note.startCourseSeconds, error: 10 },
    ]
    let time = note.startCourseSeconds
    for (const [index, gap] of gaps.entries()) {
      time += gap
      samples.push({
        time,
        error: index < lowErrorIntervals ? 10 : 50,
      })
    }
    for (const sample of samples)
      judge.observe(evidence(target, sample.time, sample.error))
    const expectedCentSeconds = samples
      .slice(1)
      .reduce((total, sample, index) => {
        const previous = samples[index]!
        return (
          total +
          ((previous.error + sample.error) / 2) * (sample.time - previous.time)
        )
      }, 0)
    const expectedReliable = samples.at(-1)!.time - samples[0]!.time
    const unweightedIntervalMean =
      samples.slice(1).reduce((total, sample, index) => {
        const previous = samples[index]!
        return total + (previous.error + sample.error) / 2
      }, 0) / gaps.length
    const expectedMean = expectedCentSeconds / expectedReliable
    expect(expectedReliable).toBeCloseTo(reliableSeconds, 10)
    expect(expectedMean).not.toBeCloseTo(unweightedIntervalMean, 4)
    const result = judge.result(target)
    expect(result.reliableSeconds).toBeCloseTo(expectedReliable, 10)
    expect(result.meanAbsoluteCents).toBeCloseTo(expectedMean, 10)
    expect(result).toMatchObject({ outcome: 'hit', grade: 2 })
  })

  it('resets continuity on accepted silence without crediting the interrupted interval', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const start = target.notes[0]!.startCourseSeconds
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, start))
    judge.observe(evidence(target, start + 0.1))
    judge.observe(evidence(target, start + 0.15, 0, { midi: null }))
    judge.observe(evidence(target, start + 0.2))
    judge.observe(evidence(target, start + 0.3))
    expect(judge.result(target).reliableSeconds).toBeCloseTo(0.2, 10)
  })

  it('clears fresh feedback immediately on silence and weak confidence without clearing fill', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const start = target.notes[0]!.startCourseSeconds
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, start))
    judge.observe(evidence(target, start + 0.1))
    const filled = judge.targetSnapshot(target, start + 0.1)
    expect(filled.pitchFeedback.state).toBe('accepted')
    expect(filled.notes[0]!.fillProgress).toBeGreaterThan(0)

    judge.observe(evidence(target, start + 0.11, 0, { midi: null }))
    const silent = judge.targetSnapshot(target, start + 0.11)
    expect(silent.pitchFeedback.state).toBe('neutral')
    expect(silent.notes[0]!.fillProgress).toBe(filled.notes[0]!.fillProgress)

    judge.observe(evidence(target, start + 0.12))
    expect(judge.targetSnapshot(target, start + 0.12).pitchFeedback.state).toBe(
      'accepted',
    )
    judge.observe(
      evidence(target, start + 0.13, 0, {
        confidence: course.voice.judge.minimumConfidence - 0.01,
      }),
    )
    const uncertain = judge.targetSnapshot(target, start + 0.13)
    expect(uncertain.pitchFeedback.state).toBe('neutral')
    expect(uncertain.notes[0]!.fillProgress).toBe(filled.notes[0]!.fillProgress)
  })

  it('classifies the tolerance boundary and gives wrong notes a correction direction', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const capture = target.notes[0]!.startCourseSeconds
    const tolerance = course.voice.judge.centsTolerance
    const judge = createRunnerJudge(course, 60)

    judge.observe(evidence(target, capture, tolerance))
    const accepted = judge.targetSnapshot(target, capture).pitchFeedback
    expect(accepted).toMatchObject({
      state: 'accepted',
      correction: null,
    })
    expect(accepted.errorCents).toBeCloseTo(tolerance, 8)

    judge.observe(evidence(target, capture + 0.01, tolerance + 1))
    const high = judge.targetSnapshot(target, capture + 0.01).pitchFeedback
    expect(high).toMatchObject({
      state: 'wrong',
      correction: 'lower',
    })
    expect(high.errorCents).toBeCloseTo(tolerance + 1, 8)

    judge.observe(evidence(target, capture + 0.02, -tolerance - 1))
    const low = judge.targetSnapshot(target, capture + 0.02).pitchFeedback
    expect(low).toMatchObject({
      state: 'wrong',
      correction: 'higher',
    })
    expect(low.errorCents).toBeCloseTo(-tolerance - 1, 8)
  })

  it('retains the capture-time target while a glide advances', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'arc-diadem',
    )!
    const note = target.notes[1]!
    const capture =
      note.startCourseSeconds +
      (note.endCourseSeconds - note.startCourseSeconds) * 0.25
    const snapshotAt = Math.min(
      note.endCourseSeconds - 1e-6,
      capture + course.voice.judge.maximumEvidenceGapSeconds / 2,
    )
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, capture, -15))
    const snapshot = judge.targetSnapshot(target, snapshotAt)
    const captureTargetMidi = runnerTargetMidiAt(
      target.notes,
      capture,
      rootMidi,
    )
    expect(snapshot.currentTargetMidi).not.toBeCloseTo(captureTargetMidi, 8)
    expect(snapshot.pitchFeedback).toMatchObject({
      state: 'accepted',
      observedMidi: captureTargetMidi - 0.15,
      comparedTargetMidi: captureTargetMidi,
      correction: null,
    })
    expect(snapshot.pitchFeedback.errorCents).toBeCloseTo(-15, 8)
    expect(snapshot.notes[1]).toMatchObject({
      startMidi: rootMidi,
      endMidi: rootMidi + 2,
      targetMidi: rootMidi + 2,
      state: 'hollow',
    })
  })

  it('retains eligible feedback while a newer capture waits for the snapshot clock', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const capture = target.notes[0]!.startCourseSeconds + 0.2
    const futureCapture = capture + 0.02
    const judge = createRunnerJudge(course, 60)

    judge.observe(evidence(target, capture))
    const accepted = judge.targetSnapshot(target, capture).pitchFeedback
    expect(accepted.state).toBe('accepted')

    judge.observe(evidence(target, futureCapture, 100))
    expect(
      judge.targetSnapshot(target, futureCapture - 0.01).pitchFeedback,
    ).toEqual(accepted)
    expect(
      judge.targetSnapshot(target, futureCapture).pitchFeedback,
    ).toMatchObject({
      state: 'wrong',
      errorCents: 100,
      correction: 'lower',
    })
  })

  it('selects the newest eligible capture from a burst before projection', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const start = target.notes[0]!.startCourseSeconds
    const judge = createRunnerJudge(course, 60)

    judge.observe(evidence(target, start + 0.01, 100))
    judge.observe(evidence(target, start + 0.14))

    expect(
      judge.targetSnapshot(target, start + 0.15).pitchFeedback,
    ).toMatchObject({
      state: 'accepted',
      errorCents: 0,
      correction: null,
    })
  })

  it('expires feedback by capture course time at the existing evidence gap', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const capture = target.notes[0]!.startCourseSeconds + 0.2
    const gap = course.voice.judge.maximumEvidenceGapSeconds
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, capture))

    expect(
      judge.targetSnapshot(target, capture + gap).pitchFeedback.state,
    ).toBe('accepted')
    expect(
      judge.targetSnapshot(target, capture + gap + 1e-6).pitchFeedback.state,
    ).toBe('neutral')
  })

  it('clears a prior-note candidate at the exact half-open note boundary', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'arc-diadem',
    )!
    const prior = target.notes[0]!
    const next = target.notes[1]!
    const capture = prior.endCourseSeconds - 1e-6
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, capture))

    expect(judge.targetSnapshot(target, capture).pitchFeedback.state).toBe(
      'accepted',
    )
    const transitioned = judge.targetSnapshot(target, next.startCourseSeconds)
    expect(transitioned.noteIndex).toBe(next.index)
    expect(transitioned.pitchFeedback.state).toBe('neutral')
  })

  it('keeps settlement neutral while preserving the accumulated result', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'home-window',
    )!
    const note = target.notes[0]!
    const judge = createRunnerJudge(course, 60)
    fillNote(judge, target, note)
    const resultBeforeSettlement = judge.result(target)

    const snapshot = judge.targetSnapshot(
      target,
      target.judgeCloseCourseSeconds + 1e-6,
    )

    expect(snapshot.phase).toBe('settling')
    expect(snapshot.pitchFeedback.state).toBe('neutral')
    expect(judge.result(target)).toEqual(resultBeforeSettlement)
  })
})
