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
    const samples: { time: number; error: number }[] = [
      { time: note.startCourseSeconds, error: 10 },
    ]
    let time = note.startCourseSeconds
    for (let index = 0; index < 18; index++) {
      time += index % 2 === 0 ? 0.12 : 0.04
      samples.push({ time, error: index < 9 ? 10 : 50 })
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
    const result = judge.result(target)
    expect(result.reliableSeconds).toBeCloseTo(expectedReliable, 10)
    expect(result.meanAbsoluteCents).toBeCloseTo(
      expectedCentSeconds / expectedReliable,
      10,
    )
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

  it('exposes resolved contour MIDI, live error, and immutable fill state', () => {
    const target = course.targets.find(
      (candidate) => candidate.id === 'arc-diadem',
    )!
    const note = target.notes[1]!
    const capture = (note.startCourseSeconds + note.endCourseSeconds) / 2
    const judge = createRunnerJudge(course, 60)
    judge.observe(evidence(target, capture, -15))
    const snapshot = judge.targetSnapshot(target, capture)
    expect(snapshot.currentTargetMidi).toBeCloseTo(rootMidi + 1, 10)
    expect(snapshot.latestPitchErrorCents).toBeCloseTo(-15, 8)
    expect(snapshot.notes[1]).toMatchObject({
      startMidi: rootMidi,
      endMidi: rootMidi + 2,
      targetMidi: rootMidi + 2,
      state: 'hollow',
    })
  })
})
