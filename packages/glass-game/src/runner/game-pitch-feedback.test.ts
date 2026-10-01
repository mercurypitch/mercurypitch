// ============================================================
// Song runner pitch feedback integration tests — envelope rejection and lifecycle isolation.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { RunnerVoiceEvidence, SongRunnerGame } from './contracts'
import { SINGING_CURRENT } from './first-course'
import { createSongRunnerGame } from './game'
import { runnerTargetMidiAt } from './pitch'

const course = SINGING_CURRENT
const comfortableMidi = 60
const epoch = 'feedback-one'
const target = course.targets[0]!
const note = target.notes[0]!
const rootMidi = comfortableMidi + course.voice.comfortableRootOffsetSemitones
const step = course.movement.fixedStepSeconds
const capture = note.startCourseSeconds + step * 6

function evidence(
  sequence: number,
  captureCourseSeconds: number,
  overrides: Partial<RunnerVoiceEvidence> = {},
): RunnerVoiceEvidence {
  return {
    epoch,
    sequence,
    captureCourseSeconds,
    receivedCourseSeconds: captureCourseSeconds,
    midi: runnerTargetMidiAt(target.notes, captureCourseSeconds, rootMidi),
    confidence: 1,
    ...overrides,
  }
}

function gameAt(courseSeconds = capture): SongRunnerGame {
  const game = createSongRunnerGame(course, { comfortableMidi })
  expect(game.beginEpoch(epoch)).toMatchObject({ ok: true })
  let requested = 0
  while (requested < courseSeconds) {
    requested = Math.min(courseSeconds, requested + 0.1)
    game.advanceTo(epoch, requested)
  }
  return game
}

describe('song runner pitch feedback envelope', () => {
  it('leaves valid feedback unchanged after every rejected evidence envelope', () => {
    const game = gameAt()
    expect(game.observe(evidence(1, capture))).toBe(true)
    const valid = game.snapshot().activeTarget!.pitchFeedback
    expect(valid.state).toBe('accepted')
    const wrongMidi = rootMidi + 3
    const rejected: RunnerVoiceEvidence[] = [
      evidence(2, capture + step, { epoch: 'wrong-epoch', midi: wrongMidi }),
      evidence(1, capture + step, { midi: wrongMidi }),
      evidence(2, capture + step * 2, {
        receivedCourseSeconds: capture + step,
        midi: wrongMidi,
      }),
      evidence(2, capture + step * 3, {
        receivedCourseSeconds:
          capture +
          step * 3 +
          course.voice.judge.maximumDeliveryLatencySeconds +
          step,
        midi: wrongMidi,
      }),
      evidence(2, target.judgeCloseCourseSeconds + step, { midi: wrongMidi }),
      evidence(2, target.judgeCloseCourseSeconds + 0.5e-9, {
        receivedCourseSeconds: target.settleAfterCourseSeconds + 1.5e-9,
        midi: wrongMidi,
      }),
    ]

    for (const observation of rejected) {
      expect(game.observe(observation)).toBe(false)
      expect(game.snapshot().activeTarget!.pitchFeedback).toEqual(valid)
    }

    let requested = capture
    while (requested < target.settleAfterCourseSeconds + step) {
      requested = Math.min(
        target.settleAfterCourseSeconds + step,
        requested + 0.1,
      )
      game.advanceTo(epoch, requested)
    }
    const resolved = game.snapshot().resolvedTargets[0]!
    expect(
      game.observe(
        evidence(2, target.judgeCloseCourseSeconds - step, {
          midi: wrongMidi,
        }),
      ),
    ).toBe(false)
    expect(game.snapshot().resolvedTargets[0]).toEqual(resolved)
  })

  it('keeps score-valid evidence neutral once its capture is display-stale', () => {
    expect(course.voice.judge.maximumDeliveryLatencySeconds).toBe(0.18)
    expect(course.voice.judge.maximumEvidenceGapSeconds).toBe(0.12)
    const game = gameAt()
    expect(game.observe(evidence(1, capture))).toBe(true)
    const secondCapture = capture + 0.05
    const receivedCourseSeconds = secondCapture + 0.15

    expect(
      game.observe(
        evidence(2, secondCapture, {
          receivedCourseSeconds,
        }),
      ),
    ).toBe(true)
    game.advanceTo(epoch, receivedCourseSeconds)
    const snapshot = game.snapshot().activeTarget!

    expect(snapshot.pitchFeedback.state).toBe('neutral')
    expect(snapshot.notes[0]!.fillProgress).toBeGreaterThan(0)
  })

  it.each(['pause', 'recovery'] as const)(
    'clears feedback through %s without changing accumulated fill',
    (boundary) => {
      const game = gameAt()
      expect(game.observe(evidence(1, capture - 0.05))).toBe(true)
      expect(game.observe(evidence(2, capture))).toBe(true)
      const before = game.snapshot().activeTarget!
      expect(before.pitchFeedback.state).toBe('accepted')
      expect(before.notes[0]!.fillProgress).toBeGreaterThan(0)

      if (boundary === 'pause') game.pause()
      else
        game.advanceTo(
          epoch,
          capture + course.movement.maxCatchUpSeconds + step,
        )
      const after = game.snapshot().activeTarget!

      expect(after.pitchFeedback.state).toBe('neutral')
      expect(after.notes[0]!.fillProgress).toBe(before.notes[0]!.fillProgress)
      if (boundary === 'pause') {
        expect(game.beginEpoch('feedback-two')).toMatchObject({ ok: true })
        expect(game.snapshot().activeTarget!.pitchFeedback.state).toBe(
          'neutral',
        )
      }
    },
  )
})
