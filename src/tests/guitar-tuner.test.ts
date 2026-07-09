// ============================================================
// Guitar Tuner Tests — classifyPitch + tuning-preset decode
// ============================================================

import { describe, expect, it } from 'vitest'
import { midiToNoteName } from '@/lib/frequency-to-note'
import { GUITAR_TUNING } from '@/lib/guitar/guitar-synth'
import { ALTERNATE_TUNINGS, classifyPitch, getTuningFrequencies, getTuningStringNames, STRING_NAMES, TUNER_CLOSE_CENTS, TUNER_IN_TUNE_CENTS, } from '@/lib/guitar/tuner'

// Standard open-string frequencies (Hz), low→high.
const STD = STRING_NAMES.map((n) => GUITAR_TUNING[n])

// Expected note names each preset should decode to (low→high).
const PRESET_NOTES: Record<string, string[]> = {
  Standard: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'Drop D': ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  'Half Step Down': ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'],
  'Open G': ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'],
  DADGAD: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'],
}

describe('classifyPitch — standard strings', () => {
  it('maps each exact open-string frequency to its own string, ~0 cents, in tune', () => {
    for (const name of STRING_NAMES) {
      const r = classifyPitch(GUITAR_TUNING[name], 1)
      expect(r, `string ${name}`).not.toBeNull()
      expect(r!.stringName).toBe(name)
      expect(Math.abs(r!.centsDeviation)).toBeLessThan(0.5)
      expect(r!.inTune).toBe(true)
      expect(r!.close).toBe(true)
      // MIDI matches the note the string decodes to (midiToNoteName from
      // frequency-to-note includes the octave, e.g. "E2").
      expect(midiToNoteName(r!.midi)).toBe(name)
    }
  })

  it('reports a positive cents deviation when sharp, negative when flat', () => {
    const a2 = GUITAR_TUNING.A2 // 110 Hz
    const sharp = classifyPitch(a2 * 2 ** (10 / 1200), 1) // +10 cents
    const flat = classifyPitch(a2 * 2 ** (-10 / 1200), 1) // -10 cents
    expect(sharp!.stringName).toBe('A2')
    expect(flat!.stringName).toBe('A2')
    expect(sharp!.centsDeviation).toBeGreaterThan(0)
    expect(flat!.centsDeviation).toBeLessThan(0)
    expect(sharp!.centsDeviation).toBeCloseTo(10, 0)
    expect(flat!.centsDeviation).toBeCloseTo(-10, 0)
  })

  it('honours the ±5 (in tune) and ±15 (close) cent thresholds', () => {
    const d3 = GUITAR_TUNING.D3
    // +4 cents: within in-tune band.
    const inTune = classifyPitch(d3 * 2 ** (4 / 1200), 1)!
    expect(inTune.inTune).toBe(true)
    expect(inTune.close).toBe(true)

    // +10 cents: close but not in tune.
    const close = classifyPitch(d3 * 2 ** (10 / 1200), 1)!
    expect(close.inTune).toBe(false)
    expect(close.close).toBe(true)

    // Just inside each threshold (a hair under, to avoid float-equality noise
    // right on the boundary — real audio never lands exactly on it).
    const nearInTune = classifyPitch(
      d3 * 2 ** ((TUNER_IN_TUNE_CENTS - 0.1) / 1200),
      1,
    )!
    expect(nearInTune.inTune).toBe(true)
    const nearClose = classifyPitch(
      d3 * 2 ** ((TUNER_CLOSE_CENTS - 0.1) / 1200),
      1,
    )!
    expect(nearClose.close).toBe(true)
    expect(nearClose.inTune).toBe(false)
  })
})

describe('classifyPitch — signal gate & guards', () => {
  it('returns null for off-string noise far from any string (e.g. 300 Hz)', () => {
    // 300 Hz sits ~155 cents above B3 (246.94) and ~163 below E4 (329.63) —
    // beyond TUNER_MAX_SIGNAL_CENTS, so it is not a tuning signal.
    expect(classifyPitch(300, 1)).toBeNull()
  })

  it('accepts a pitch within the signal window even if not in tune', () => {
    // ~40 cents above A2: inside the ±50 signal gate, so a result is returned.
    const r = classifyPitch(GUITAR_TUNING.A2 * 2 ** (40 / 1200), 1)
    expect(r).not.toBeNull()
    expect(r!.inTune).toBe(false)
  })

  it('returns null when clarity is below the minimum (0.3)', () => {
    expect(classifyPitch(GUITAR_TUNING.E2, 0.29)).toBeNull()
    expect(classifyPitch(GUITAR_TUNING.E2, 0.3)).not.toBeNull()
  })

  it('returns null for non-positive or NaN frequencies', () => {
    expect(classifyPitch(0, 1)).toBeNull()
    expect(classifyPitch(-100, 1)).toBeNull()
    expect(classifyPitch(Number.NaN, 1)).toBeNull()
  })
})

describe('tuning presets', () => {
  it('every preset is monotonically ascending (low→high)', () => {
    for (const [name, freqs] of Object.entries(ALTERNATE_TUNINGS)) {
      for (let i = 1; i < freqs.length; i++) {
        expect(
          freqs[i],
          `${name}: ${freqs[i - 1]} → ${freqs[i]} should ascend`,
        ).toBeGreaterThan(freqs[i - 1])
      }
    }
  })

  it('each preset decodes to the expected note names (catches Open G)', () => {
    for (const [preset, expected] of Object.entries(PRESET_NOTES)) {
      expect(getTuningStringNames(preset), preset).toEqual(expected)
    }
  })

  it('preset frequencies match the notes they decode to (within 1 cent)', () => {
    for (const preset of Object.keys(ALTERNATE_TUNINGS)) {
      const freqs = getTuningFrequencies(preset)
      const names = getTuningStringNames(preset)
      for (let i = 0; i < freqs.length; i++) {
        // Round-trip: the frequency should classify to its own string ~0 cents.
        const r = classifyPitch(freqs[i], 1, freqs, names)
        expect(r, `${preset}[${i}]`).not.toBeNull()
        expect(Math.abs(r!.centsDeviation)).toBeLessThan(1)
        expect(r!.stringName).toBe(names[i])
      }
    }
  })

  it('changing the preset changes the classification (Drop D low D)', () => {
    const dropD = getTuningFrequencies('Drop D')
    const dropDNames = getTuningStringNames('Drop D')
    const lowD = 73.42 // D2

    // Under Drop D, 73.42 Hz is the (in-tune) low string.
    const inDropD = classifyPitch(lowD, 1, dropD, dropDNames)!
    expect(inDropD.stringName).toBe('D2')
    expect(inDropD.inTune).toBe(true)

    // Under standard tuning, the nearest string to 73.42 Hz is low E2 (82.41),
    // which is ~200 cents away — outside the signal gate entirely.
    const inStandard = classifyPitch(
      lowD,
      1,
      STD,
      STRING_NAMES as unknown as string[],
    )
    expect(inStandard).toBeNull()
  })

  it('Open G decodes to D2 G2 D3 G3 B3 D4 (regression for the bad preset)', () => {
    expect(getTuningStringNames('Open G')).toEqual([
      'D2',
      'G2',
      'D3',
      'G3',
      'B3',
      'D4',
    ])
    // And the raw frequencies are the correct Open G targets (D2 G2 D3 G3 B3 D4).
    expect(getTuningFrequencies('Open G')).toEqual([
      73.42, 98.0, 146.83, 196.0, 246.94, 293.66,
    ])
  })
})
