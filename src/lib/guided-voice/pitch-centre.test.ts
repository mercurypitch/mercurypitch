// ============================================================
// Pitch Centre tests — exact register, absence, and stable aggregation
// ============================================================

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/pitch-measurements'
import type { PitchCentreLandingProtocol, PitchCentreLandingResult, } from './pitch-centre'
import { aggregatePitchCentreLandings, measurePitchCentreLanding, } from './pitch-centre'

const HOP_SECONDS = 0.02
const TARGET_MIDI_CENTS = 6_900
const PROTOCOL: PitchCentreLandingProtocol = {
  confidenceFloor: 0.6,
  medianWindow: 5,
  maxVoicedGapMilliseconds: 80,
  minimumObservationMilliseconds: 300,
  minimumConfidentFrames: 8,
  settleToleranceCents: 35,
  settleHoldMilliseconds: 120,
  minimumSettlingFrames: 5,
  approachDeadbandCents: 12,
  approachConsensusRatio: 0.7,
}

function centsToHz(cents: number): number {
  return 440 * 2 ** ((cents - 6_900) / 1_200)
}

function track(
  centsAt: (index: number) => number,
  count = 24,
  confidence = 0.95,
  startSeconds = 0,
): F0Frame[] {
  return Array.from({ length: count }, (_, index) => ({
    t: startSeconds + index * HOP_SECONDS,
    f0: centsToHz(centsAt(index)),
    conf: confidence,
  }))
}

function measured(result: PitchCentreLandingResult) {
  expect(result.kind).toBe('measured')
  if (result.kind !== 'measured') throw new Error('Expected measurement')
  return result
}

describe('measurePitchCentreLanding', () => {
  it('settles on the exact target with near-zero signed error', () => {
    const result = measured(
      measurePitchCentreLanding(
        track(() => TARGET_MIDI_CENTS),
        TARGET_MIDI_CENTS,
        PROTOCOL,
      ),
    )
    expect(result.settled).toBe(true)
    expect(result.medianSignedErrorCents).toBeCloseTo(0, 6)
    expect(result.medianAbsoluteErrorCents).toBeCloseTo(0, 6)
    expect(result.approach).toBe('direct')
    expect(result.confidentCoverage).toEqual({
      numeratorFrames: 24,
      denominatorFrames: 24,
    })
  })

  it.each([
    { offset: 22, expected: 'above' },
    { offset: -18, expected: 'below' },
  ])('preserves the sign of a $expected landing', ({ offset }) => {
    const result = measured(
      measurePitchCentreLanding(
        track(() => TARGET_MIDI_CENTS + offset),
        TARGET_MIDI_CENTS,
        PROTOCOL,
      ),
    )
    expect(result.medianSignedErrorCents).toBeCloseTo(offset, 5)
    expect(result.medianAbsoluteErrorCents).toBeCloseTo(Math.abs(offset), 5)
  })

  it('does not treat the target in another octave as settled', () => {
    const result = measured(
      measurePitchCentreLanding(
        track(() => TARGET_MIDI_CENTS - 1_200),
        TARGET_MIDI_CENTS,
        PROTOCOL,
      ),
    )
    expect(result.settled).toBe(false)
    expect(result.medianSignedErrorCents).toBeNull()
    expect(result.approach).toBe('unavailable')
  })

  it.each([
    { side: 'below', initialOffset: -90 },
    { side: 'above', initialOffset: 90 },
  ] as const)(
    'identifies an approach from $side and the stable-window timestamp',
    ({ side, initialOffset }) => {
      const result = measured(
        measurePitchCentreLanding(
          track((index) =>
            index < 6 ? TARGET_MIDI_CENTS + initialOffset : TARGET_MIDI_CENTS,
          ),
          TARGET_MIDI_CENTS,
          PROTOCOL,
        ),
      )
      expect(result.approach).toBe(side)
      expect(result.settledAtMilliseconds).toBeCloseTo(120, 5)
      expect(result.evidenceMoments).toEqual([
        {
          kind: 'approach',
          startMilliseconds: 0,
          endMilliseconds: 100,
        },
        {
          kind: 'settling-window',
          startMilliseconds: 120,
          endMilliseconds: 220,
        },
      ])
    },
  )

  it('returns absence instead of a zero result for low-confidence voice', () => {
    const result = measurePitchCentreLanding(
      track(() => TARGET_MIDI_CENTS, 24, 0.2),
      TARGET_MIDI_CENTS,
      PROTOCOL,
    )
    expect(result).toMatchObject({
      kind: 'insufficient-evidence',
      reason: 'no-confident-voice',
      confidentCoverage: { numeratorFrames: 0, denominatorFrames: 24 },
    })
    expect(result).not.toHaveProperty('score')
  })

  it('requires the configured observation duration', () => {
    const result = measurePitchCentreLanding(
      track(() => TARGET_MIDI_CENTS, 5),
      TARGET_MIDI_CENTS,
      PROTOCOL,
    )
    expect(result).toMatchObject({
      kind: 'insufficient-evidence',
      reason: 'too-short',
    })
  })

  it('resets contiguous settling across a voiced gap', () => {
    const first = track(() => TARGET_MIDI_CENTS, 4)
    const second = track(() => TARGET_MIDI_CENTS, 4, 0.95, 0.4)
    const result = measured(
      measurePitchCentreLanding([...first, ...second], TARGET_MIDI_CENTS, {
        ...PROTOCOL,
        minimumObservationMilliseconds: 120,
      }),
    )
    expect(result.settled).toBe(false)
  })

  it('does not turn isolated frames into a sustained settling window', () => {
    const sparse = Array.from({ length: 5 }, (_, index) => ({
      t: index * 0.2,
      f0: centsToHz(TARGET_MIDI_CENTS),
      conf: 0.95,
    }))
    const result = measured(
      measurePitchCentreLanding(sparse, TARGET_MIDI_CENTS, {
        ...PROTOCOL,
        minimumObservationMilliseconds: 50,
        minimumConfidentFrames: 5,
        minimumSettlingFrames: 1,
      }),
    )
    expect(result.settled).toBe(false)
  })

  it('includes the same-run post-settle hold in landing error', () => {
    const result = measured(
      measurePitchCentreLanding(
        track((index) =>
          index < 6 ? TARGET_MIDI_CENTS : TARGET_MIDI_CENTS + 100,
        ),
        TARGET_MIDI_CENTS,
        PROTOCOL,
      ),
    )
    expect(result.settled).toBe(true)
    expect(result.medianSignedErrorCents).toBeGreaterThan(50)
  })

  it('suppresses an isolated octave glitch without folding the target error', () => {
    const frames = track((index) =>
      index === 8 ? TARGET_MIDI_CENTS + 1_200 : TARGET_MIDI_CENTS,
    )
    const result = measured(
      measurePitchCentreLanding(frames, TARGET_MIDI_CENTS, PROTOCOL),
    )
    expect(result.settled).toBe(true)
    expect(result.medianAbsoluteErrorCents).toBeCloseTo(0, 6)
  })

  it('rejects malformed duplicate timestamps as ambiguous evidence', () => {
    const frames = track(() => TARGET_MIDI_CENTS)
    frames[4] = { ...frames[4], t: frames[3].t }
    expect(
      measurePitchCentreLanding(frames, TARGET_MIDI_CENTS, PROTOCOL),
    ).toMatchObject({
      kind: 'insufficient-evidence',
      reason: 'ambiguous',
    })
  })

  it.each([
    { field: 'confidence above one', frame: { f0: 440, conf: 2 } },
    { field: 'negative frequency', frame: { f0: -440, conf: 0.9 } },
  ])('rejects malformed $field as ambiguous evidence', ({ frame }) => {
    const frames = track(() => TARGET_MIDI_CENTS).map((entry) => ({
      ...entry,
      ...frame,
    }))
    expect(
      measurePitchCentreLanding(frames, TARGET_MIDI_CENTS, PROTOCOL),
    ).toMatchObject({
      kind: 'insufficient-evidence',
      reason: 'ambiguous',
    })
  })

  it.each([
    { name: 'even median window', patch: { medianWindow: 4 } },
    { name: 'half consensus', patch: { approachConsensusRatio: 0.5 } },
    {
      name: 'deadband outside settle tolerance',
      patch: { approachDeadbandCents: 36 },
    },
  ])('rejects a biased $name configuration', ({ patch }) => {
    expect(() =>
      measurePitchCentreLanding(
        track(() => TARGET_MIDI_CENTS),
        TARGET_MIDI_CENTS,
        { ...PROTOCOL, ...patch },
      ),
    ).toThrow()
  })
})

describe('aggregatePitchCentreLandings', () => {
  function landing(
    targetMidiCents: number,
    signedError: number,
    settledAtMilliseconds: number,
  ): PitchCentreLandingResult {
    return {
      kind: 'measured',
      targetMidiCents,
      confidentCoverage: { numeratorFrames: 20, denominatorFrames: 24 },
      settled: true,
      settledAtMilliseconds,
      medianSignedErrorCents: signedError,
      medianAbsoluteErrorCents: Math.abs(signedError),
      approach: signedError < 0 ? 'below' : 'above',
      evidenceMoments: [],
    }
  }

  it('reports counts, medians, and spread without a composite score', () => {
    const results: PitchCentreLandingResult[] = [
      landing(6_900, -20, 180),
      landing(7_100, 10, 120),
      landing(7_300, 40, 240),
      {
        kind: 'insufficient-evidence',
        targetMidiCents: 7_500,
        reason: 'no-confident-voice',
        confidentCoverage: { numeratorFrames: 0, denominatorFrames: 24 },
      },
    ]
    const aggregate = aggregatePitchCentreLandings(results)
    expect(aggregate).toMatchObject({
      totalRepetitions: 4,
      measuredRepetitions: 3,
      settledRepetitions: 3,
      settledCoverage: {
        numeratorRepetitions: 3,
        denominatorRepetitions: 4,
      },
      medianSignedErrorCents: 10,
      medianAbsoluteErrorCents: 20,
      signedErrorMedianAbsoluteDeviationCents: 30,
      medianSettledAtMilliseconds: 180,
    })
    expect(aggregate).not.toHaveProperty('score')
  })

  it('is deterministic and order-stable', () => {
    const results = [
      landing(6_900, -20, 180),
      landing(7_100, 10, 120),
      landing(7_300, 40, 240),
    ]
    expect(aggregatePitchCentreLandings([...results].reverse())).toEqual(
      aggregatePitchCentreLandings(results),
    )
  })
})
