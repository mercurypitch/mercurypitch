// ============================================================
// Scale Runner's scales: what a run asks for, and what a launch may ask
// ============================================================
//
// The picker, a lesson's slug and the run all read one list. These tests
// hold each scale to the notes its name promises, since a name the degree
// table did not know would fall back to the major scale without a sound,
// and hold a launch to the list.

import { afterEach, describe, expect, it } from 'vitest'
import { clearLaunchOverride, setLaunchOverride, } from '@/features/practice-intelligence/launch-override'
import { midiToNoteName, noteToMidi } from '@/lib/frequency-to-note'
import { EXERCISE_INTERVAL_TRAINER, EXERCISE_SCALE_RUNNER } from '../types'
import type { ScaleRunDirection, ScaleRunnerScale } from './scale-runner-scales'
import { SCALE_RUNNER_SCALES, scaleRunnerLaunchScale, scaleRunnerScaleLabel, scaleRunNotes, } from './scale-runner-scales'

/** A run from A3, as note names. */
function runFromA(
  scale: ScaleRunnerScale,
  direction: ScaleRunDirection = 'up',
): string[] {
  return scaleRunNotes(noteToMidi('A3'), scale, direction).map(midiToNoteName)
}

describe('scaleRunNotes', () => {
  it('runs the harmonic minor with its raised seventh', () => {
    expect(runFromA('harmonic-minor')).toEqual([
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F4',
      'G#4',
      'A4',
    ])
  })

  it('runs the melodic minor up with its sixth and seventh raised', () => {
    expect(runFromA('melodic-minor')).toEqual([
      'A3',
      'B3',
      'C4',
      'D4',
      'E4',
      'F#4',
      'G#4',
      'A4',
    ])
  })

  it('brings the melodic minor down as the natural minor', () => {
    expect(runFromA('melodic-minor', 'down')).toEqual(runFromA('minor', 'down'))
    expect(runFromA('melodic-minor', 'down')).toEqual([
      'A4',
      'G4',
      'F4',
      'E4',
      'D4',
      'C4',
      'B3',
      'A3',
    ])
  })

  it('brings the harmonic minor down with its raised seventh still raised', () => {
    expect(runFromA('harmonic-minor', 'down')).toEqual(
      [...runFromA('harmonic-minor')].reverse(),
    )
  })

  it('runs the two pentatonics on their own five notes', () => {
    expect(runFromA('pentatonic')).toEqual([
      'A3',
      'B3',
      'C#4',
      'E4',
      'F#4',
      'A4',
    ])
    expect(runFromA('pentatonic-minor')).toEqual([
      'A3',
      'C4',
      'D4',
      'E4',
      'G4',
      'A4',
    ])
  })

  it('gives every scale on the list notes of its own', () => {
    // A name the degree table lacked would run the major scale instead.
    const runs = SCALE_RUNNER_SCALES.map((s) => runFromA(s.value).join(' '))

    expect(new Set(runs).size).toBe(SCALE_RUNNER_SCALES.length)
  })

  it('runs every scale from its first note to the octave, no note twice running', () => {
    const base = noteToMidi('A3')

    for (const { value } of SCALE_RUNNER_SCALES) {
      for (const direction of ['up', 'down'] as const) {
        const notes = scaleRunNotes(base, value, direction)
        const [first, last] =
          direction === 'up' ? [base, base + 12] : [base + 12, base]

        expect(notes[0], `${value} ${direction}`).toBe(first)
        expect(notes[notes.length - 1], `${value} ${direction}`).toBe(last)
        expect(
          notes.filter((n, i) => i > 0 && n === notes[i - 1]),
          `${value} ${direction}`,
        ).toEqual([])
      }
    }
  })
})

describe('scaleRunnerScaleLabel', () => {
  it("gives each scale the picker's name for it", () => {
    expect(scaleRunnerScaleLabel('harmonic-minor')).toBe('Harmonic Minor')
    expect(scaleRunnerScaleLabel('pentatonic-minor')).toBe('Minor Pentatonic')
  })
})

describe('scaleRunnerLaunchScale', () => {
  afterEach(clearLaunchOverride)

  it('is the scale a launch asked Scale Runner for', () => {
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'melodic-minor',
    })

    expect(scaleRunnerLaunchScale()).toBe('melodic-minor')
  })

  it('is nothing for a name that is not on the list', () => {
    // The Singing tab has a Dorian; Scale Runner does not.
    setLaunchOverride(EXERCISE_SCALE_RUNNER, {
      type: EXERCISE_SCALE_RUNNER,
      scale: 'dorian',
    })

    expect(scaleRunnerLaunchScale()).toBeUndefined()
  })

  it("is nothing for another exercise's launch, or for none", () => {
    expect(scaleRunnerLaunchScale()).toBeUndefined()

    setLaunchOverride(EXERCISE_INTERVAL_TRAINER, {
      type: EXERCISE_INTERVAL_TRAINER,
      scale: 'melodic-minor',
    })

    expect(scaleRunnerLaunchScale()).toBeUndefined()
  })
})
