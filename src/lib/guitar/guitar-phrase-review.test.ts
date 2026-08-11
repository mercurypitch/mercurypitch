// Guitar phrase review tests keep score comparisons frame-pinned, bounded, and honest.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarPhraseAssessmentWindow, GuitarPhraseTargetInput, } from './guitar-phrase-review'
import { createGuitarPhraseAssessmentWindow, reviewGuitarPhrase, } from './guitar-phrase-review'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'
import type { GuitarInputHealthReading, GuitarInputSource, } from './input-events'

const SAMPLE_RATE = 1_000
const STARTED_AT_SECONDS = 10
const GOOD_HEALTH: GuitarInputHealthReading = {
  state: 'good',
  hint: 'Input level looks good.',
}

function targets(count = 4): GuitarPhraseTargetInput[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `target-${index}`,
    midi: 60 + index,
    startBeat: index,
  }))
}

function window(
  overrides: Partial<
    Parameters<typeof createGuitarPhraseAssessmentWindow>[0]
  > = {},
): GuitarPhraseAssessmentWindow {
  return createGuitarPhraseAssessmentWindow({
    id: 'window-1',
    takeId: 'take-1',
    referenceId: 'song-1',
    trackId: 'track-1',
    range: { startBeat: 0, endBeat: 4 },
    startedAtSeconds: STARTED_AT_SECONDS,
    sampleRate: SAMPLE_RATE,
    beatToSeconds: (beat) => beat,
    targets: targets(),
    matchToleranceMs: 200,
    minimumPitchClarity: 0.6,
    ...overrides,
  })
}

function event(
  id: string,
  frame: number,
  midi: number | null,
  options: {
    clarity?: number
    kind?: GuitarTakeEvent['kind']
    source?: GuitarInputSource
    latencyFrames?: number
  } = {},
): GuitarTakeEvent {
  const latencyFrames = options.latencyFrames ?? 40
  const rawTransportFrame = frame + latencyFrames
  const capturedAtFrame =
    Math.round(STARTED_AT_SECONDS * SAMPLE_RATE) + rawTransportFrame
  return {
    id,
    kind: options.kind ?? 'attack',
    source: options.source ?? 'microphone',
    voiceId: null,
    at: STARTED_AT_SECONDS + frame / SAMPLE_RATE,
    capturedAt: capturedAtFrame / SAMPLE_RATE,
    rawTransportFrame,
    compensatedTransportFrame: frame,
    level: 0.2,
    clock: {
      kind: 'audio-worklet',
      atFrame: capturedAtFrame,
      sampleRate: SAMPLE_RATE,
    },
    pitch:
      midi === null
        ? null
        : {
            midi,
            noteName: `MIDI ${midi}`,
            cents: 0,
            clarity: options.clarity ?? 0.9,
          },
  }
}

function take(
  events: readonly GuitarTakeEvent[],
  overrides: Partial<GuitarTakeSnapshot> = {},
): GuitarTakeSnapshot {
  return {
    id: 'take-1',
    lifecycle: 'completed',
    input: {
      kind: 'microphone',
      requestedDeviceId: null,
      activeDeviceId: 'test-mic',
      activeDeviceLabel: 'Test microphone',
    },
    clock: {
      startedAtFrame: STARTED_AT_SECONDS * SAMPLE_RATE,
      sampleRate: SAMPLE_RATE,
      attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
      latency: {
        seconds: 0.04,
        frames: 40,
        provenance: 'stored-round-trip',
        uncertaintySeconds: 0.006,
      },
    },
    events,
    durationFrames: 4_000,
    filteredBeforeStart: 0,
    filteredAfterEnd: 0,
    truncated: false,
    droppedEventCount: 0,
    inputHealth: {
      readings: 1,
      states: {
        silent: 0,
        quiet: 0,
        good: 1,
        hot: 0,
        clipping: 0,
        noisy: 0,
        uncertain: 0,
      },
    },
    ...overrides,
  }
}

function withoutStoredLatency(
  snapshot: GuitarTakeSnapshot,
): GuitarTakeSnapshot {
  return {
    ...snapshot,
    clock: {
      ...snapshot.clock,
      latency: {
        seconds: 0,
        frames: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    },
  }
}

function review(
  takeSnapshot: GuitarTakeSnapshot,
  assessmentWindow = window(),
  inputHealth: GuitarInputHealthReading | null = GOOD_HEALTH,
) {
  return reviewGuitarPhrase({
    window: assessmentWindow,
    take: takeSnapshot,
    inputHealth,
  })
}

describe('createGuitarPhraseAssessmentWindow', () => {
  it('pins a mapped beat range to integer frames and keeps it half-open', () => {
    const assessment = window({
      range: { startBeat: 1, endBeat: 3 },
      sampleRate: 100,
      startedAtSeconds: 7.25,
      beatToSeconds: (beat) => (beat <= 2 ? beat * 0.5 : 1 + (beat - 2)),
      targets: [
        { id: 'before', midi: 60, startBeat: 0 },
        { id: 'at-a', midi: 61, startBeat: 1 },
        { id: 'inside', midi: 62, startBeat: 2.5 },
        { id: 'at-b', midi: 63, startBeat: 3 },
      ],
    })

    expect(assessment.startedAtFrame).toBe(725)
    expect(assessment.durationFrames).toBe(150)
    expect(assessment.targets).toEqual([
      { id: 'at-a', midi: 61, startBeat: 1, onsetFrame: 0 },
      { id: 'inside', midi: 62, startBeat: 2.5, onsetFrame: 100 },
    ])
  })

  it('derives every relative frame from the same fractional audio epoch', () => {
    const assessment = window({
      range: { startBeat: 0, endBeat: 1.0049 },
      sampleRate: 100,
      startedAtSeconds: 7.2549,
      beatToSeconds: (beat) => beat,
      targets: [{ id: 'inside', midi: 60, startBeat: 1.0048 }],
    })

    // round(825.98) - round(725.49), matching recorder.complete(). Rounding
    // the 100.49-frame duration on its own would incorrectly produce 100.
    expect(assessment.startedAtFrame).toBe(725)
    expect(assessment.durationFrames).toBe(101)
    expect(assessment.targets[0]?.onsetFrame).toBe(101 - 1)
  })

  it('rejects a non-increasing pinned beat clock', () => {
    expect(() => window({ beatToSeconds: () => 1 })).toThrow(
      'The pinned beat clock must increase across the range.',
    )
  })
})

describe('reviewGuitarPhrase', () => {
  it('reports exact-clock consistency and calibrated offset from matched attacks', () => {
    const result = review(
      take([
        event('event-0', 20, 60),
        event('event-1', 990, 61),
        event('event-2', 2_030, 62),
        event('event-3', 3_000, 63),
      ]),
    )

    expect(result.metrics.timingConsistency).toMatchObject({
      status: 'available',
      confidence: 'supported',
      value: { matchedAttacks: 4, medianAbsoluteDeviationMs: 15 },
    })
    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'available',
      confidence: 'supported',
      value: {
        matchedAttacks: 4,
        medianOffsetMs: 10,
        direction: 'late',
      },
    })
    expect(result.metrics.pitchRelationship).toMatchObject({
      status: 'available',
      value: {
        comparedEvents: 4,
        exactMidiMatches: 4,
        differentMidiEvents: 0,
        exactMatchRatio: 1,
        medianClarity: 0.9,
      },
    })
  })

  it('maximizes ordered matches, then chooses the smallest total timing error', () => {
    const assessment = window({
      range: { startBeat: 0, endBeat: 0.2 },
      beatToSeconds: (beat) => beat,
      targets: [
        { id: 'first', midi: 60, startBeat: 0 },
        { id: 'second', midi: 62, startBeat: 0.1 },
      ],
      matchToleranceMs: 70,
    })
    const result = review(
      take(
        [
          event('near-first', 30, 60, { source: 'midi' }),
          event('middle-extra', 60, 61, { source: 'midi' }),
          event('near-second', 130, 62, { source: 'midi' }),
        ],
        { durationFrames: 200 },
      ),
      assessment,
    )

    const pitch = result.metrics.pitchRelationship
    expect(pitch.status).toBe('available')
    if (pitch.status === 'available') {
      expect(pitch.evidence.eventIds).toEqual(['near-first', 'near-second'])
      expect(pitch.evidence.targetIds).toEqual(['first', 'second'])
      expect(pitch.value.exactMidiMatches).toBe(2)
    }
  })

  it('never treats MIDI release pitches as compared evidence', () => {
    const assessment = window({
      range: { startBeat: 0, endBeat: 2 },
      targets: [
        { id: 'first', midi: 60, startBeat: 0 },
        { id: 'second', midi: 61, startBeat: 1 },
      ],
    })
    const result = review(
      take(
        [
          event('midi-attack', 0, 60, { source: 'midi' }),
          event('midi-release', 1_000, 61, {
            kind: 'release',
            source: 'midi',
          }),
        ],
        { durationFrames: 2_000 },
      ),
      assessment,
    )

    const pitch = result.metrics.pitchRelationship
    expect(pitch.status).toBe('available')
    if (pitch.status === 'available') {
      expect(pitch.value).toMatchObject({
        comparedEvents: 1,
        exactMidiMatches: 1,
      })
      expect(pitch.evidence.eventIds).toEqual(['midi-attack'])
      expect(pitch.evidence.targetIds).toEqual(['first'])
    }
  })

  it('uses clarity-qualified exact MIDI instead of octave-folded matches', () => {
    const result = review(
      take([
        event('clear-exact', 0, 60, { clarity: 0.8 }),
        event('unclear', 1_000, 61, { clarity: 0.4 }),
        event('clear-octave-wrong', 2_000, 74, { clarity: 0.9 }),
      ]),
    )
    const pitch = result.metrics.pitchRelationship

    expect(pitch.status).toBe('available')
    if (pitch.status === 'available') {
      expect(pitch.value).toEqual({
        comparedEvents: 2,
        exactMidiMatches: 1,
        differentMidiEvents: 1,
        exactMatchRatio: 0.5,
        medianClarity: 0.85,
      })
      expect(pitch.confidence).toBe('limited')
    }
    expect(result.recovery).toMatchObject({
      kind: 'slow-down',
      tempoScale: 0.85,
    })
  })

  it('excludes captured evidence exactly at the range end', () => {
    const result = review(
      take([event('inside', 3_999, 63), event('at-b', 4_000, 63)]),
    )

    expect(result.eventCount).toBe(1)
    expect(result.attackCount).toBe(1)
  })

  it('treats a take one frame shorter than its pinned range as partial', () => {
    const result = review(take([], { durationFrames: 3_999 }))

    expect(result.metrics.timingConsistency).toMatchObject({
      status: 'unavailable',
      reason: 'partial-take',
    })
  })

  it('keeps relative consistency but withholds offset on an uncalibrated input', () => {
    const result = review(
      take(
        [
          event('event-0', 20, 60, { latencyFrames: 0 }),
          event('event-1', 1_020, 61, { latencyFrames: 0 }),
          event('event-2', 2_020, 62, { latencyFrames: 0 }),
          event('event-3', 3_020, 63, { latencyFrames: 0 }),
        ],
        {
          clock: {
            startedAtFrame: STARTED_AT_SECONDS * SAMPLE_RATE,
            sampleRate: SAMPLE_RATE,
            attack: {
              timingSource: 'audio-clock',
              precision: 'sample-exact',
            },
            latency: {
              seconds: 0,
              frames: 0,
              provenance: 'none',
              uncertaintySeconds: null,
            },
          },
        },
      ),
    )

    expect(result.metrics.timingConsistency.status).toBe('available')
    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason: 'uncalibrated-input',
    })
    expect(result.recovery.kind).toBe('calibrate')
  })

  it('addresses clear pitch differences before offering timing calibration', () => {
    const result = review(
      withoutStoredLatency(
        take([
          event('event-0', 0, 61),
          event('event-1', 1_000, 62),
          event('event-2', 2_000, 63),
          event('event-3', 3_000, 64),
        ]),
      ),
    )

    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason: 'uncalibrated-input',
    })
    expect(result.metrics.pitchRelationship).toMatchObject({
      status: 'available',
      value: { differentMidiEvents: 4 },
    })
    expect(result.recovery).toMatchObject({
      kind: 'slow-down',
      tempoScale: 0.85,
    })
  })

  it('does not recommend calibration before a take contains enough attacks', () => {
    const result = review(withoutStoredLatency(take([])))

    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason: 'no-attacks',
    })
    expect(result.recovery).toMatchObject({ kind: 'replay' })
  })

  it('prioritizes an empty authored range over the input-health state', () => {
    const result = review(take([]), window({ targets: [] }), {
      state: 'silent',
      hint: 'No usable signal.',
    })

    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason: 'no-targets',
    })
    expect(result.recovery).toMatchObject({ kind: 'choose-range' })
  })

  it.each([
    {
      name: 'missing calibration uncertainty',
      uncertaintySeconds: null,
      reason: 'calibration-uncertainty-unavailable',
    },
    {
      name: 'broad calibration uncertainty',
      uncertaintySeconds: 0.026,
      reason: 'calibration-too-variable',
    },
  ])(
    'withholds absolute offset for $name while retaining relative consistency',
    ({ uncertaintySeconds, reason }) => {
      const result = review(
        take(
          [
            event('event-0', 20, 60),
            event('event-1', 1_020, 61),
            event('event-2', 2_020, 62),
            event('event-3', 3_020, 63),
          ],
          {
            clock: {
              startedAtFrame: STARTED_AT_SECONDS * SAMPLE_RATE,
              sampleRate: SAMPLE_RATE,
              attack: {
                timingSource: 'audio-clock',
                precision: 'sample-exact',
              },
              latency: {
                seconds: 0.04,
                frames: 40,
                provenance: 'stored-round-trip',
                uncertaintySeconds,
              },
            },
          },
        ),
      )

      expect(result.metrics.timingConsistency.status).toBe('available')
      expect(result.metrics.calibratedOffset).toMatchObject({
        status: 'unavailable',
        reason,
      })
      expect(result.recovery.kind).toBe('calibrate')
    },
  )

  it('allows absolute offset at the tight calibration uncertainty ceiling', () => {
    const result = review(
      take(
        [
          event('event-0', 20, 60),
          event('event-1', 1_020, 61),
          event('event-2', 2_020, 62),
          event('event-3', 3_020, 63),
        ],
        {
          clock: {
            startedAtFrame: STARTED_AT_SECONDS * SAMPLE_RATE,
            sampleRate: SAMPLE_RATE,
            attack: {
              timingSource: 'audio-clock',
              precision: 'sample-exact',
            },
            latency: {
              seconds: 0.04,
              frames: 40,
              provenance: 'stored-round-trip',
              uncertaintySeconds: 0.025,
            },
          },
        },
      ),
    )

    expect(result.metrics.timingConsistency.status).toBe('available')
    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'available',
      confidence: 'supported',
      value: { medianOffsetMs: 20 },
    })
  })

  it('withholds fine timing on the coarse path while retaining pitch evidence', () => {
    const result = review(
      take(
        [
          event('event-0', 0, 60),
          event('event-1', 1_000, 61),
          event('event-2', 2_000, 62),
          event('event-3', 3_000, 63),
        ],
        {
          clock: {
            startedAtFrame: STARTED_AT_SECONDS * SAMPLE_RATE,
            sampleRate: SAMPLE_RATE,
            attack: {
              timingSource: 'frame-loop',
              precision: 'coarse-frame-loop',
            },
            latency: {
              seconds: 0.04,
              frames: 40,
              provenance: 'stored-round-trip',
              uncertaintySeconds: null,
            },
          },
        },
      ),
    )

    expect(result.metrics.timingConsistency).toMatchObject({
      status: 'unavailable',
      reason: 'coarse-attack-clock',
    })
    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason: 'coarse-attack-clock',
    })
    expect(result.metrics.pitchRelationship.status).toBe('available')
  })

  it.each([
    {
      name: 'partial take',
      snapshot: take([], { durationFrames: 2_000 }),
      health: GOOD_HEALTH,
      reason: 'partial-take',
    },
    {
      name: 'truncated take',
      snapshot: take([], { truncated: true, droppedEventCount: 1 }),
      health: GOOD_HEALTH,
      reason: 'truncated-take',
    },
    {
      name: 'clipped input',
      snapshot: take([]),
      health: {
        state: 'clipping',
        hint: 'Too loud.',
      } as GuitarInputHealthReading,
      reason: 'input-clipping',
    },
    {
      name: 'unretained input health',
      snapshot: take([]),
      health: null,
      reason: 'input-health-unavailable',
    },
  ])('gates supported metrics for a $name', ({ snapshot, health, reason }) => {
    const result = review(snapshot, window(), health)

    expect(result.metrics.timingConsistency).toMatchObject({
      status: 'unavailable',
      reason,
    })
    expect(result.metrics.calibratedOffset).toMatchObject({
      status: 'unavailable',
      reason,
    })
    expect(result.metrics.pitchRelationship).toMatchObject({
      status: 'unavailable',
      reason,
    })
  })

  it('withholds single-note pitch relationships from chords and unverified fast microphone passages', () => {
    const chordWindow = window({
      targets: [
        { id: 'chord-e', midi: 64, startBeat: 0 },
        { id: 'chord-g', midi: 67, startBeat: 0 },
      ],
    })
    const chord = review(take([event('chord-event', 0, 64)]), chordWindow)
    expect(chord.metrics.pitchRelationship).toMatchObject({
      status: 'unavailable',
      reason: 'polyphonic-target',
    })

    const fastWindow = window({
      range: { startBeat: 0, endBeat: 1 },
      beatToSeconds: (beat) => beat,
      targets: [
        { id: 'fast-a', midi: 60, startBeat: 0 },
        { id: 'fast-b', midi: 62, startBeat: 0.1 },
      ],
    })
    const fast = review(
      take([event('fast-a', 0, 60), event('fast-b', 100, 62)], {
        durationFrames: 1_000,
      }),
      fastWindow,
    )
    expect(fast.metrics.pitchRelationship).toMatchObject({
      status: 'unavailable',
      reason: 'fast-passage-unverified',
    })
  })

  it('keeps unsupported articulation, sustain, center, and stability explicit', () => {
    const result = review(take([]))

    expect(result.metrics.attackCompleteness.reason).toBe(
      'reference-lacks-articulation',
    )
    expect(result.metrics.sustain.reason).toBe('release-evidence-unavailable')
    expect(result.metrics.pitchCenter.reason).toBe(
      'continuous-pitch-unavailable',
    )
    expect(result.metrics.pitchStability.reason).toBe(
      'continuous-pitch-unavailable',
    )
  })

  it('offers a shorter concrete recovery when bounded evidence was truncated', () => {
    const result = review(take([], { truncated: true, droppedEventCount: 12 }))

    expect(result.recovery).toEqual({
      kind: 'shorten-range',
      label: 'Review a shorter range',
      range: { startBeat: 0, endBeat: 2 },
    })
  })
})
