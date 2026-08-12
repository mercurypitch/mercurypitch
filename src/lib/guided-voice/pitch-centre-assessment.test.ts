// ============================================================
// Pitch Centre pilot assessment tests — fitted route and refusal states
// ============================================================

import { describe, expect, it } from 'vitest'
import type { F0Frame } from '@/lib/pitch-measurements'
import { assessPitchCentrePilot, createPitchCentrePilotProtocol, isPersistedPitchCentrePilotFocus, PITCH_CENTRE_PILOT_THRESHOLDS_V1, } from './pitch-centre-assessment'

const HOP_SECONDS = 0.02

function centsToHz(cents: number): number {
  return 440 * 2 ** ((cents - 6_900) / 1_200)
}

function landingFrames(input: {
  startSeconds: number
  targetMidiCents: number
  initialOffsetCents?: number
  confidence?: number
}): F0Frame[] {
  return Array.from({ length: 90 }, (_, index) => ({
    t: input.startSeconds + index * HOP_SECONDS,
    f0: centsToHz(
      input.targetMidiCents + (index < 8 ? (input.initialOffsetCents ?? 0) : 0),
    ),
    conf: input.confidence ?? 0.95,
  }))
}

function assessmentInput(
  overrides: Partial<Parameters<typeof assessPitchCentrePilot>[0]> = {},
): Parameters<typeof assessPitchCentrePilot>[0] {
  const protocol = createPitchCentrePilotProtocol({
    comfortableRangeMidiCents: [5_700, 7_300],
    preferredMidiCents: 6_913,
  })
  return {
    runId: 'pitch-centre.run-1',
    protocol,
    captureDurationMilliseconds: protocol.task.durationMilliseconds,
    landingWindows: protocol.task.targetMidiCents.map((target, index) => {
      const startSeconds =
        (index * PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds) /
        1000
      return {
        startSeconds,
        endSeconds:
          startSeconds +
          PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds / 1000,
        frames: landingFrames({
          startSeconds,
          targetMidiCents: target,
          initialOffsetCents: index === 1 ? -80 : 0,
        }),
      }
    }),
    quality: {
      microphoneContinuous: true,
      clippingDetected: false,
      noiseSeparation: 'sufficient',
      taskCompleted: true,
      analysisAvailable: true,
    },
    safety: { preCapture: 'proceed', singerEffort: 'workable' },
    captureContext: {
      inputContextKey: 'input.local-1',
      detectorId: 'yin',
      detectorVersion: '1.0.0',
      sampleRateHz: 48_000,
    },
    ...overrides,
  }
}

describe('createPitchCentrePilotProtocol', () => {
  it('fits an exact three-target route around the nearest comfortable note', () => {
    const protocol = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [5_700, 7_300],
      preferredMidiCents: 6_913,
    })

    expect(protocol.task.targetMidiCents).toEqual([6_700, 6_900, 7_100])
    expect(protocol.task.repetitions).toBe(3)
    expect(protocol.task.parameters).toMatchObject({
      fittedCentreMidiCents: 6_900,
      exactRegister: true,
      octaveFold: false,
    })
    expect(protocol.comparisonFingerprint).toContain('pitch-centre')
  })

  it('shifts the authored route inside the declared range without wrapping', () => {
    const protocol = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [6_100, 6_900],
      preferredMidiCents: 6_900,
    })
    expect(protocol.task.targetMidiCents).toEqual([6_500, 6_700, 6_900])
  })

  it('rejects a range that cannot contain the three-note pilot route', () => {
    expect(() =>
      createPitchCentrePilotProtocol({
        comfortableRangeMidiCents: [6_400, 6_700],
        preferredMidiCents: 6_500,
      }),
    ).toThrow(/too narrow/u)
  })

  it('returns deeply immutable protocol provenance', () => {
    const protocol = createPitchCentrePilotProtocol({
      comfortableRangeMidiCents: [5_700, 7_300],
      preferredMidiCents: 6_900,
    })
    expect(Object.isFrozen(protocol)).toBe(true)
    expect(Object.isFrozen(protocol.task)).toBe(true)
    expect(Object.isFrozen(protocol.task.targetMidiCents)).toBe(true)
    expect(Object.isFrozen(protocol.task.parameters)).toBe(true)
  })
})

describe('assessPitchCentrePilot', () => {
  it('normalizes global frame times and returns validated direct evidence', () => {
    const result = assessPitchCentrePilot(assessmentInput())

    expect(result.outcome.kind).toBe('focus-reading')
    expect(result.quality.outcome).toBe('ready')
    expect(result.aggregate).toMatchObject({
      totalRepetitions: 3,
      measuredRepetitions: 3,
      settledRepetitions: 3,
    })
    expect(result.landings[1]).toMatchObject({
      kind: 'measured',
      approach: 'below',
    })
    expect(result.evidence).not.toHaveProperty('score')
    expect(result.reading?.primaryEvidenceId).toBe(
      'pitch-centre.evidence.settled-landings',
    )
    expect(result.reading?.recommendation.exercise.exerciseId).toBe(
      'pitch-hold',
    )
    expect(result.reading?.recommendation.dose).toEqual({
      durationMilliseconds: 5_000,
      repetitions: 3,
      sets: 1,
      comfortableRangeMidiCents: null,
      demand: 'same',
    })
    expect(result.persistedContext).toMatchObject({
      runId: 'pitch-centre.run-1',
      captureSource: 'dry-microphone',
      comparisonFingerprint: result.protocol.comparisonFingerprint,
    })
    expect(result.persistedContext?.recommendation?.retake).toEqual(
      result.protocol,
    )

    const secondWindowSettling = result.evidence
      .flatMap((evidence) =>
        evidence.availability === 'available' ? evidence.moments : [],
      )
      .find((moment) => moment.id.includes('2-settling-window'))
    expect(secondWindowSettling?.startSeconds).toBeGreaterThan(1.8)
  })

  it('does not reject millisecond windows after seconds conversion', () => {
    const input = assessmentInput()
    const segmentStartsMilliseconds = [0, 1_901, 3_802]
    const landingWindows = input.landingWindows.map((window, index) => ({
      ...window,
      startSeconds: segmentStartsMilliseconds[index] / 1000,
      endSeconds:
        (segmentStartsMilliseconds[index] +
          PITCH_CENTRE_PILOT_THRESHOLDS_V1.landingWindowMilliseconds) /
        1000,
      frames: landingFrames({
        startSeconds: 0,
        targetMidiCents: input.protocol.task.targetMidiCents[index],
      }),
    }))
    const result = assessPitchCentrePilot({
      ...input,
      captureDurationMilliseconds: 5_703,
      landingWindows,
    })

    expect(result.quality.blockingCheckIds).not.toContain('duration')
    expect(result.outcome.kind).toBe('focus-reading')
    expect(result.persistedContext).not.toBeNull()
    expect(result.reading).not.toBeNull()
    expect(
      isPersistedPitchCentrePilotFocus({
        assessment: result.persistedContext!,
        reading: result.reading!,
        captureDurationSeconds: 5.703,
      }),
    ).toBe(true)
  })

  it('marks unavailable noise separation as partial without blocking reading', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      quality: { ...input.quality, noiseSeparation: 'unavailable' },
    })

    expect(result.quality.outcome).toBe('partial')
    expect(result.quality.partialCheckIds).toEqual(['noise-separation'])
    expect(result.outcome.kind).toBe('focus-reading')
    if (result.outcome.kind === 'focus-reading') {
      expect(result.outcome.quality).toBe('partial')
    }
  })

  it('fails closed when the microphone was interrupted during capture', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      quality: { ...input.quality, microphoneContinuous: false },
    })

    expect(result.quality.outcome).toBe('needs-another-recording')
    expect(result.quality.blockingCheckIds).toContain('microphone-continuity')
    expect(result.outcome.kind).toBe('needs-another-recording')
    expect(result.reading).toBeNull()
    expect(result.persistedContext).toBeNull()
  })

  it('fails closed when voiced evidence is below the pilot floor', () => {
    const input = assessmentInput()
    const landingWindows = input.landingWindows.map((window, index) => ({
      ...window,
      frames: landingFrames({
        startSeconds: window.startSeconds,
        targetMidiCents: input.protocol.task.targetMidiCents[index],
        confidence: 0.2,
      }),
    }))
    const result = assessPitchCentrePilot({ ...input, landingWindows })

    expect(result.quality.outcome).toBe('needs-another-recording')
    expect(result.quality.blockingCheckIds).toEqual([
      'signal-coverage',
      'pitch-confidence',
    ])
    expect(result.outcome.kind).toBe('needs-another-recording')
    expect(result.reading).toBeNull()
    expect(result.persistedContext).toBeNull()
  })

  it('requests a new recording when no landing windows arrived', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({ ...input, landingWindows: [] })

    expect(result.outcome.kind).toBe('needs-another-recording')
    expect(result.quality.blockingCheckIds).toEqual([
      'signal-coverage',
      'pitch-confidence',
      'task-completion',
      'duration',
      'repetitions',
    ])
    expect(result.persistedContext).toBeNull()
  })

  it('fails closed when a required capture fact is missing at runtime', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      quality: {
        ...input.quality,
        analysisAvailable: undefined as unknown as boolean,
      },
    })

    expect(result.outcome.kind).toBe('unavailable-here')
    expect(result.quality.blockingCheckIds).toContain('analysis-capability')
  })

  it('does not convert unavailable clipping evidence into a passing check', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      quality: {
        ...input.quality,
        clippingDetected: 'unavailable',
      },
    })

    expect(result.outcome.kind).toBe('unavailable-here')
    expect(result.quality.blockingCheckIds).toContain('clipping')
    expect(result.quality.observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'clipping',
          status: 'unavailable',
          reasonCode: 'pitch-centre.clipping-unavailable',
        }),
      ]),
    )
    expect(result.reading).toBeNull()
    expect(result.persistedContext).toBeNull()
  })

  it('lets reported discomfort override a complete acoustic result', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      safety: { preCapture: 'proceed', singerEffort: 'uncomfortable' },
    })

    expect(result.outcome).toEqual({ kind: 'safety-stop' })
    expect(result.reading).toBeNull()
    expect(result.persistedContext).toBeNull()
  })

  it('keeps an octave miss outside the target instead of folding it', () => {
    const input = assessmentInput()
    const landingWindows = input.landingWindows.map((window, index) => ({
      ...window,
      frames: landingFrames({
        startSeconds: window.startSeconds,
        targetMidiCents: input.protocol.task.targetMidiCents[index] - 1_200,
      }),
    }))
    const result = assessPitchCentrePilot({ ...input, landingWindows })

    expect(result.quality.outcome).toBe('ready')
    expect(result.aggregate.settledRepetitions).toBe(0)
    expect(result.outcome.kind).toBe('focus-reading')
    if (result.outcome.kind !== 'focus-reading') return
    expect(result.outcome.reading.focusFinding.findingCode).toBe(
      'pitch-centre.finding.refine-centre',
    )
    expect(result.outcome.reading.recommendation.id).toBe(
      'pitch-centre.recommendation.pitch-hold-refine',
    )
  })

  it('refuses overlapping scored windows as insufficient task duration', () => {
    const input = assessmentInput()
    const landingWindows = input.landingWindows.map((window, index) =>
      index === 1
        ? { ...window, startSeconds: input.landingWindows[0].endSeconds - 0.2 }
        : window,
    )
    const result = assessPitchCentrePilot({ ...input, landingWindows })

    expect(result.quality.outcome).toBe('needs-another-recording')
    expect(result.quality.blockingCheckIds).toContain('duration')
    expect(result.persistedContext).toBeNull()
  })

  it('rejects altered task provenance instead of scoring a non-pilot task', () => {
    const input = assessmentInput()
    const result = assessPitchCentrePilot({
      ...input,
      protocol: {
        ...input.protocol,
        task: {
          ...input.protocol.task,
          targetMidiCents: [5_500, 5_700, 5_900],
        },
      },
    })

    expect(result.outcome).toEqual({
      kind: 'analysis-failed',
      reasonCode: 'pitch-centre.invalid-assessment-input',
    })
    expect(result.persistedContext).toBeNull()
  })

  it('uses the immutable task as the exact matched retake', () => {
    const result = assessPitchCentrePilot(assessmentInput())
    expect(result.outcome.kind).toBe('focus-reading')
    if (result.outcome.kind !== 'focus-reading') return

    const retake = result.outcome.reading.recommendation.retake
    expect(retake.comparisonFingerprint).toBe(
      result.protocol.comparisonFingerprint,
    )
    expect(retake.task.targetMidiCents).toEqual(
      result.protocol.task.targetMidiCents,
    )
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(retake.task)).toBe(true)
  })
})
