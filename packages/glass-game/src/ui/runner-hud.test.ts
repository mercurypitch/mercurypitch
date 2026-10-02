// Song runner HUD tests — visible copy follows scoring, hazard, and recovery truth.

import { describe, expect, it } from 'vitest'
import type { RunnerTargetSnapshot } from '../runner/contracts'
import type { RunnerNotationNote } from '../runner/notation'
import { runnerDisplayNotationNotes, runnerEventAnnouncement, runnerMicrophoneStatus, runnerMovementCueCopy, runnerRecoveryCopy, runnerTargetResultNotice, runnerVoiceCue, } from './runner-hud'

function targetSnapshot(
  phase: RunnerTargetSnapshot['phase'],
): RunnerTargetSnapshot {
  return {
    id: 'pane',
    phase,
    phaseStartCourseSeconds: 1,
    phaseEndCourseSeconds: 2,
    phaseProgress: 0.5,
    noteIndex: 0,
    currentTargetMidi: 57,
    pitchFeedback: {
      state: 'neutral',
      observedMidi: null,
      comparedTargetMidi: null,
      errorCents: null,
      correction: null,
    },
    notes: [
      {
        index: 0,
        startMidi: 57,
        endMidi: 57,
        targetMidi: 57,
        fillProgress: 0,
        state: 'hollow',
      },
    ],
  }
}

describe('runner HUD semantics', () => {
  it.each([
    ['approaching', 'Listen', 'Scoring opens at Sing', false],
    ['emphasized', 'Get ready', 'Scoring opens at Sing', false],
    ['judging', 'Sing', 'Scoring now', true],
    ['settling', 'Checking', 'Scoring closed', false],
  ] as const)(
    'labels %s without claiming scoring is open at the wrong time',
    (phase, label, scoreStatus, scoringOpen) => {
      expect(runnerVoiceCue(targetSnapshot(phase))).toMatchObject({
        label,
        scoreStatus,
        scoringOpen,
      })
    },
  )

  it('reports microphone readiness separately from score eligibility', () => {
    expect(runnerMicrophoneStatus('ready')).toBe('Microphone ready')
    expect(runnerVoiceCue(targetSnapshot('approaching')).scoreStatus).toBe(
      'Scoring opens at Sing',
    )
  })

  it.each([
    ['gap-ahead', 'Gap ahead'],
    ['jump', 'Jump'],
    ['landing', 'Landing'],
    ['change-lane', 'Change lane'],
  ] as const)('gives %s its own physical action label', (stage, label) => {
    expect(runnerMovementCueCopy({ obstacleId: 'obstacle', stage }).label).toBe(
      label,
    )
  })

  it('tells a missed gap from a display interruption', () => {
    expect(runnerRecoveryCopy('fall')).toMatchObject({
      eyebrow: 'Gap missed',
      title: 'Take the jump again',
    })
    expect(runnerRecoveryCopy('frame-gap')).toMatchObject({
      eyebrow: 'Run interrupted',
      title: 'The display fell behind',
    })
    expect(runnerRecoveryCopy('collision')).toMatchObject({
      eyebrow: 'Path blocked',
      title: 'Try this stretch again',
    })
  })

  it('announces an early miss and a blocked path without claiming pane contact', () => {
    const base = {
      eventSequence: 1,
      epoch: 'run',
      atCourseSeconds: 4,
      atBeat: 8,
    }
    expect(
      runnerEventAnnouncement({
        ...base,
        type: 'target-miss',
        result: {
          targetId: 'pane',
          outcome: 'miss',
          grade: null,
          resolvedAtCourseSeconds: 4,
          reliableSeconds: 0,
          meanAbsoluteCents: null,
        },
      }),
    ).toBe('Phrase missed. Try the next one.')
    expect(
      runnerEventAnnouncement({
        ...base,
        type: 'recovery-required',
        reason: 'collision',
        checkpointId: 'checkpoint',
      }),
    ).toBe('Path blocked. Returning to the last checkpoint.')
  })

  it('keeps hit and miss result copy distinct, bounded, and tied to its epoch', () => {
    const course = {
      voice: { comfortableRootOffsetSemitones: 0 },
      targets: [
        {
          id: 'pane',
          notes: [{ endOffsetSemitones: 2 }],
        },
      ],
    }
    const hit = {
      id: 'pane',
      epoch: 'first-run',
      outcome: 'hit',
      resolvedAtCourseSeconds: 4,
    } as const
    const miss = { ...hit, outcome: 'miss' } as const

    expect(
      runnerTargetResultNotice(course, 60, null, 'first-run', 4),
    ).toBeNull()
    expect(
      runnerTargetResultNotice(course, 60, hit, 'first-run', 3.99),
    ).toBeNull()
    expect(runnerTargetResultNotice(course, 60, hit, 'first-run', 4)).toEqual({
      id: 'pane',
      outcome: 'hit',
      label: 'Released',
      instruction: 'D4 opened the glass',
    })
    expect(runnerTargetResultNotice(course, 60, miss, 'first-run', 4)).toEqual({
      id: 'pane',
      outcome: 'miss',
      label: 'Missed',
      instruction: 'Try the next one',
    })
    expect(
      runnerTargetResultNotice(course, 60, hit, 'first-run', 5.11),
    ).toBeNull()
    expect(
      runnerTargetResultNotice(course, 60, hit, 'rewound-run', 4),
    ).toBeNull()
  })

  it('removes duration claims from charge notation while preserving scheduled rhythm', () => {
    const notes: readonly RunnerNotationNote[] = [
      {
        index: 0,
        startBeat: 0,
        endBeat: 4,
        startMidi: 60,
        endMidi: 60,
        connection: 'separate',
        fillProgress: 0.5,
        state: 'filling',
      },
      {
        index: 1,
        startBeat: 4,
        endBeat: 6,
        startMidi: 62,
        endMidi: 62,
        connection: 'separate',
        fillProgress: 0,
        state: 'hollow',
      },
    ]
    const baseTarget = { completionPolicy: 'charge' } as const

    expect(runnerDisplayNotationNotes(baseTarget, notes)).toMatchObject([
      { startBeat: 0, endBeat: 1, fillProgress: 0.5 },
      { startBeat: 1, endBeat: 2, fillProgress: 0 },
    ])
    expect(
      runnerDisplayNotationNotes(
        { ...baseTarget, completionPolicy: 'scheduled' },
        notes,
      ),
    ).toBe(notes)
  })
})
