// ============================================================
// Instrument tuner domain tests — dynamic strings, targets, and readings
// ============================================================

import { describe, expect, it } from 'vitest'
import { midiToFrequency } from '@/lib/frequency-to-note'
import { instrumentTuningFromSource, standardTuning, } from '@/lib/guitar/instrument-tuning'
import { ALTERNATE_TUNINGS, classifyInstrumentPitch, classifyPitchAgainstTarget, findNearestTunerTarget, getTunerTargets, instrumentTuningForPreset, TUNER_CLOSE_CENTS, TUNER_IN_TUNE_CENTS, TUNER_MAX_SIGNAL_CENTS, } from './tuner'

function shiftCents(frequency: number, cents: number): number {
  return frequency * 2 ** (cents / 1200)
}

describe('getTunerTargets', () => {
  it('uses the stage row order and identity for a standard guitar', () => {
    const targets = getTunerTargets(standardTuning('guitar'))

    expect(targets).toHaveLength(6)
    expect(targets[0]).toMatchObject({
      stringIndex: 0,
      stringName: 'E4',
      stringLabel: 'e',
      targetMidi: 64,
    })
    expect(targets[5]).toMatchObject({
      stringIndex: 5,
      stringName: 'E2',
      stringLabel: 'E',
      targetMidi: 40,
    })
    expect(targets[0].targetHz).toBeCloseTo(midiToFrequency(64), 10)
  })

  it('builds every supported guitar and bass string count', () => {
    for (const instrument of ['guitar', 'bass'] as const) {
      for (let stringCount = 4; stringCount <= 8; stringCount += 1) {
        const tuning = standardTuning(instrument, stringCount)
        const targets = getTunerTargets(tuning)

        expect(targets, `${instrument} ${stringCount}`).toHaveLength(
          stringCount,
        )
        for (const target of targets) {
          const reading = classifyInstrumentPitch(target.targetHz, 1, tuning)
          expect(
            reading,
            `${instrument} string ${target.stringIndex}`,
          ).toMatchObject({
            stringIndex: target.stringIndex,
            stringName: target.stringName,
            targetMidi: target.targetMidi,
            inTune: true,
          })
          expect(reading!.centsDeviation).toBeCloseTo(0, 10)
        }
      }
    }
  })

  it('applies source tuning and capo to the sounding targets', () => {
    const tuning = instrumentTuningFromSource(
      'guitar',
      [64, 59, 55, 50, 45, 40, 35, 30],
      { name: 'Eight-string capo', capo: 2 },
    )!

    const targets = getTunerTargets(tuning)

    expect(targets).toHaveLength(8)
    expect(targets[0]).toMatchObject({
      stringIndex: 0,
      stringName: 'F#4',
      stringLabel: 'e',
      targetMidi: 66,
    })
    expect(targets[7]).toMatchObject({
      stringIndex: 7,
      stringName: 'G#1',
      stringLabel: 'F#',
      targetMidi: 32,
    })
  })

  it('honours a custom concert pitch without changing MIDI identity', () => {
    const target = getTunerTargets(standardTuning('guitar'), 442)[0]

    expect(target.targetMidi).toBe(64)
    expect(target.targetHz).toBeCloseTo(442 * 2 ** ((64 - 69) / 12), 10)
    expect(target.targetHz).not.toBeCloseTo(midiToFrequency(64), 5)
  })
})

describe('target selection and classification', () => {
  it('selects the nearest bass string by cents', () => {
    const targets = getTunerTargets(standardTuning('bass', 5))
    const lowB = targets[4]

    expect(findNearestTunerTarget(shiftCents(lowB.targetHz, 18), targets)).toBe(
      lowB,
    )
    expect(findNearestTunerTarget(0, targets)).toBeNull()
    expect(findNearestTunerTarget(110, [])).toBeNull()
  })

  it('keeps detector precision and derives status from exact cents', () => {
    const target = getTunerTargets(standardTuning('guitar'))[4]
    const cents = 12.34567
    const reading = classifyPitchAgainstTarget(
      shiftCents(target.targetHz, cents),
      0.9,
      target,
    )!

    expect(reading.centsDeviation).toBeCloseTo(cents, 5)
    expect(reading.centsDeviation).not.toBe(12.3)
    expect(reading.inTune).toBe(false)
    expect(reading.close).toBe(true)
    expect(reading.targetHz).toBe(target.targetHz)
  })

  it('uses the existing in-tune and close thresholds', () => {
    const target = getTunerTargets(standardTuning('guitar'))[0]
    const inTune = classifyPitchAgainstTarget(
      shiftCents(target.targetHz, TUNER_IN_TUNE_CENTS - 0.01),
      1,
      target,
    )!
    const close = classifyPitchAgainstTarget(
      shiftCents(target.targetHz, TUNER_CLOSE_CENTS - 0.01),
      1,
      target,
    )!

    expect(inTune).toMatchObject({ inTune: true, close: true })
    expect(close).toMatchObject({ inTune: false, close: true })
  })

  it('gates automatic acquisition at fifty cents', () => {
    const tuning = standardTuning('guitar')
    const target = getTunerTargets(tuning)[5]

    expect(
      classifyInstrumentPitch(
        shiftCents(target.targetHz, TUNER_MAX_SIGNAL_CENTS - 0.1),
        1,
        tuning,
      ),
    ).not.toBeNull()
    expect(
      classifyInstrumentPitch(
        shiftCents(target.targetHz, TUNER_MAX_SIGNAL_CENTS + 0.1),
        1,
        tuning,
      ),
    ).toBeNull()
  })

  it('keeps guidance outside the auto window for a manual target', () => {
    const tuning = standardTuning('guitar')
    const target = getTunerTargets(tuning)[5]
    const farSharp = shiftCents(target.targetHz, 240.125)

    expect(classifyInstrumentPitch(farSharp, 1, tuning)).toBeNull()
    const reading = classifyInstrumentPitch(farSharp, 1, tuning, {
      targetStringIndex: 5,
    })!
    expect(reading.stringIndex).toBe(5)
    expect(reading.centsDeviation).toBeCloseTo(240.125, 5)
    expect(reading.inTune).toBe(false)
    expect(reading.close).toBe(false)
  })

  it('manual identity is index-based even for duplicate target pitches', () => {
    const tuning = instrumentTuningFromSource('guitar', [64, 64, 55, 50])!
    const targets = getTunerTargets(tuning)

    const reading = classifyInstrumentPitch(targets[1].targetHz, 1, tuning, {
      targetStringIndex: 1,
    })!
    expect(reading.stringIndex).toBe(1)
    expect(reading.targetMidi).toBe(64)
  })

  it('rejects invalid readings and manual indices', () => {
    const tuning = standardTuning('bass')
    const target = getTunerTargets(tuning)[0]

    expect(classifyPitchAgainstTarget(0, 1, target)).toBeNull()
    expect(
      classifyPitchAgainstTarget(Number.POSITIVE_INFINITY, 1, target),
    ).toBeNull()
    expect(
      classifyPitchAgainstTarget(target.targetHz, Number.NaN, target),
    ).toBeNull()
    expect(classifyPitchAgainstTarget(target.targetHz, 0.29, target)).toBeNull()
    expect(
      classifyInstrumentPitch(target.targetHz, 1, tuning, {
        targetStringIndex: -1,
      }),
    ).toBeNull()
    expect(
      classifyInstrumentPitch(target.targetHz, 1, tuning, {
        targetStringIndex: 4,
      }),
    ).toBeNull()
    expect(
      classifyInstrumentPitch(target.targetHz, 1, tuning, {
        targetStringIndex: 0.5,
      }),
    ).toBeNull()
  })
})

describe('instrumentTuningForPreset', () => {
  it.each([
    ['Standard', [64, 59, 55, 50, 45, 40]],
    ['Drop D', [64, 59, 55, 50, 45, 38]],
    ['Half Step Down', [63, 58, 54, 49, 44, 39]],
    ['Open G', [62, 59, 55, 50, 43, 38]],
    ['DADGAD', [62, 57, 55, 50, 45, 38]],
  ] as const)('maps %s into high-string-first stage rows', (preset, midi) => {
    const tuning = instrumentTuningForPreset(preset)

    expect(tuning).toMatchObject({
      instrument: 'guitar',
      stringCount: 6,
      openMidi: midi,
      name: preset,
    })
    expect(tuning.capo).toBeUndefined()
  })

  it('leaves the legacy preset arrays low-string first', () => {
    expect(ALTERNATE_TUNINGS['Drop D'][0]).toBeCloseTo(73.42, 2)
    expect(ALTERNATE_TUNINGS['Drop D'][5]).toBeCloseTo(329.63, 2)
  })
})
