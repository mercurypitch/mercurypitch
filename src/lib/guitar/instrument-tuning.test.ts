// Tuning tests pin the rows the stage draws to instruments people actually play.
// ============================================================

import { describe, expect, it } from 'vitest'
import { assignStringForMidi, clampStringCount, DEFAULT_BASS_TUNING, DEFAULT_GUITAR_TUNING, fingeringMatchesTuning, liftIntoTuningRange, standardTuning, suggestInstrumentForMidi, tuningLabels, } from './instrument-tuning'

describe('standardTuning', () => {
  it('gives a six string guitar its standard rows, high to low', () => {
    expect(DEFAULT_GUITAR_TUNING.openMidi).toEqual([64, 59, 55, 50, 45, 40])
    expect(DEFAULT_GUITAR_TUNING.labels).toEqual(['e', 'B', 'G', 'D', 'A', 'E'])
  })

  it('gives a four string bass its standard rows, not a guitar’s', () => {
    expect(DEFAULT_BASS_TUNING.openMidi).toEqual([43, 38, 33, 28])
    expect(DEFAULT_BASS_TUNING.labels).toEqual(['G', 'D', 'A', 'E'])
  })

  it('extends downwards for seven and eight string guitars', () => {
    expect(standardTuning('guitar', 7).openMidi).toEqual([
      64, 59, 55, 50, 45, 40, 35,
    ])
    expect(standardTuning('guitar', 8).openMidi).toEqual([
      64, 59, 55, 50, 45, 40, 35, 30,
    ])
  })

  it('adds the low B for a five string bass and the high C for a six', () => {
    expect(standardTuning('bass', 5).openMidi).toEqual([43, 38, 33, 28, 23])
    expect(standardTuning('bass', 6).openMidi).toEqual([48, 43, 38, 33, 28, 23])
  })

  it('clamps counts to what the stage supports', () => {
    expect(clampStringCount(2)).toBe(4)
    expect(clampStringCount(99)).toBe(8)
    expect(standardTuning('bass', 3).stringCount).toBe(4)
    expect(standardTuning('guitar', 12).stringCount).toBe(8)
  })
})

describe('tuningLabels', () => {
  it('lowercases the higher of two strings sharing a note name', () => {
    expect(tuningLabels([64, 59, 55, 50, 45, 40])).toEqual([
      'e',
      'B',
      'G',
      'D',
      'A',
      'E',
    ])
  })

  it('leaves unique names alone', () => {
    expect(tuningLabels([43, 38, 33, 28])).toEqual(['G', 'D', 'A', 'E'])
  })
})

describe('assignStringForMidi', () => {
  it('picks the lowest fret that reaches the note', () => {
    // A3 (57) is fret 2 on the G string, not fret 7 on D.
    expect(assignStringForMidi(57, DEFAULT_GUITAR_TUNING)).toEqual({
      stringIndex: 2,
      fret: 2,
    })
  })

  it('places a bass note on bass rows', () => {
    expect(assignStringForMidi(28, DEFAULT_BASS_TUNING)).toEqual({
      stringIndex: 3,
      fret: 0,
    })
  })

  it('refuses a note the neck cannot reach', () => {
    expect(assignStringForMidi(20, DEFAULT_GUITAR_TUNING)).toBeNull()
    expect(assignStringForMidi(120, DEFAULT_GUITAR_TUNING)).toBeNull()
  })
})

describe('fingeringMatchesTuning', () => {
  it('accepts fingering that describes this instrument', () => {
    expect(fingeringMatchesTuning(40, 5, 0, DEFAULT_GUITAR_TUNING)).toBe(true)
    expect(fingeringMatchesTuning(28, 3, 0, DEFAULT_BASS_TUNING)).toBe(true)
  })

  it('rejects a bass fingering read against guitar rows', () => {
    // Bass low E indexed as its own string 3 is a D string on a guitar.
    expect(fingeringMatchesTuning(28, 3, 0, DEFAULT_GUITAR_TUNING)).toBe(false)
  })

  it('rejects a row this instrument does not have', () => {
    expect(fingeringMatchesTuning(35, 6, 0, DEFAULT_GUITAR_TUNING)).toBe(false)
    expect(fingeringMatchesTuning(35, 6, 0, standardTuning('guitar', 7))).toBe(
      true,
    )
  })
})

describe('liftIntoTuningRange', () => {
  it('raises below-range notes by whole octaves', () => {
    expect(liftIntoTuningRange(28, DEFAULT_GUITAR_TUNING)).toBe(40)
    expect(liftIntoTuningRange(31, DEFAULT_GUITAR_TUNING)).toBe(43)
  })

  it('leaves a bass note alone on a bass', () => {
    expect(liftIntoTuningRange(28, DEFAULT_BASS_TUNING)).toBe(28)
  })
})

describe('suggestInstrumentForMidi', () => {
  it('calls a line that lives below the guitar a bass part', () => {
    expect(suggestInstrumentForMidi([28, 33, 30, 35, 40])).toBe('bass')
  })

  it('leaves a guitar part on guitar', () => {
    expect(suggestInstrumentForMidi([64, 59, 55, 50, 40])).toBe('guitar')
  })

  it('defaults to guitar with nothing to go on', () => {
    expect(suggestInstrumentForMidi([])).toBe('guitar')
  })
})
