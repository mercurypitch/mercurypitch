// Runner pitch readout tests — the HUD preserves judge semantics and capture-time comparison.
import { describe, expect, it } from 'vitest'
import type { RunnerPitchFeedback } from '../runner/contracts'
import { runnerPitchReadout } from './runner-pitch-readout'

function readout(pitchFeedback: RunnerPitchFeedback, currentTargetMidi = 60) {
  return runnerPitchReadout({ currentTargetMidi, pitchFeedback })
}

describe('runner pitch readout', () => {
  it('shows only the current target while neutral, with no stale actual marker', () => {
    expect(
      readout(
        {
          state: 'neutral',
          observedMidi: null,
          comparedTargetMidi: null,
          errorCents: null,
          correction: null,
        },
        54,
      ),
    ).toEqual({
      state: 'neutral',
      targetLabel: 'F#3',
      observedLabel: null,
      markerTopPercent: null,
      correction: null,
      cue: 'Listening',
    })
  })

  it('uses the captured comparison for a glide instead of the later current target', () => {
    const result = readout(
      {
        state: 'accepted',
        observedMidi: 61.2,
        comparedTargetMidi: 61.1,
        errorCents: 10,
        correction: null,
      },
      64,
    )
    expect(result.targetLabel).toBe('C#4')
    expect(result.observedLabel).toBe('C#4')
    expect(result.cue).toBe('Matched')
  })

  it('does not impose a second tighter acceptance threshold', () => {
    const result = readout({
      state: 'accepted',
      observedMidi: 60.75,
      comparedTargetMidi: 60,
      errorCents: 75,
      correction: null,
    })
    expect(result.state).toBe('accepted')
    expect(result.cue).toBe('Matched')
    expect(result.markerTopPercent).toBe(50)
  })

  it.each([
    [-300, 'higher', 'Sing higher', 'A3', 95],
    [300, 'lower', 'Sing lower', 'D#4', 5],
  ] as const)(
    'shows correction text and clamps %s cents on the visual rail',
    (errorCents, correction, cue, observedLabel, markerTopPercent) => {
      expect(
        readout({
          state: 'wrong',
          observedMidi: 60 + errorCents / 100,
          comparedTargetMidi: 60,
          errorCents,
          correction,
        }),
      ).toMatchObject({ cue, correction, observedLabel, markerTopPercent })
    },
  )

  it.each([-2400, 2400])(
    'keeps distant %s-cent notes inside the rail',
    (errorCents) => {
      expect(
        readout({
          state: 'wrong',
          observedMidi: 60 + errorCents / 100,
          comparedTargetMidi: 60,
          errorCents,
          correction: errorCents < 0 ? 'higher' : 'lower',
        }).markerTopPercent,
      ).toBe(errorCents < 0 ? 95 : 5)
    },
  )
})
