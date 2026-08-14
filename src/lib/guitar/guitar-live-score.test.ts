// ============================================================
// Guitar live score tests — continuous feedback without diagnostic coupling.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { GuitarInputProfileKind } from './guitar-input-profile'
import type { GuitarLiveScoreTargetInput } from './guitar-live-score'
import { createGuitarLiveScoreEngine, GUITAR_LIVE_SCORE_ROLLING_TARGETS, } from './guitar-live-score'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'

const SAMPLE_RATE = 1_000
const STARTED_AT_FRAME = 10_000

function target(index: number, spacing = 1): GuitarLiveScoreTargetInput {
  return {
    id: `target-${index}`,
    midi: 60 + (index % 12),
    startBeat: index * spacing,
  }
}

function event(
  id: string,
  frame: number,
  midi: number | null,
  kind: GuitarInputProfileKind = 'midi',
): GuitarTakeEvent {
  const capturedAtFrame = STARTED_AT_FRAME + frame
  return {
    id,
    kind: 'attack',
    source: kind,
    voiceId: kind === 'midi' ? id : null,
    at: capturedAtFrame / SAMPLE_RATE,
    capturedAt: capturedAtFrame / SAMPLE_RATE,
    rawTransportFrame: frame,
    compensatedTransportFrame: frame,
    level: 0.3,
    clock:
      kind === 'midi'
        ? {
            kind: 'web-midi',
            eventTimestampMs: capturedAtFrame,
            observedPerformanceMs: capturedAtFrame,
            mappedAudioTime: capturedAtFrame / SAMPLE_RATE,
            inputId: 'test-midi',
            channel: 0,
          }
        : {
            kind: 'audio-worklet',
            atFrame: capturedAtFrame,
            sampleRate: SAMPLE_RATE,
          },
    pitch:
      midi === null
        ? null
        : { midi, noteName: `MIDI ${midi}`, cents: 0, clarity: 0.95 },
  }
}

function take(
  events: readonly GuitarTakeEvent[],
  options: {
    kind?: GuitarInputProfileKind
    lifecycle?: GuitarTakeSnapshot['lifecycle']
    durationFrames?: number | null
    droppedEventCount?: number
    filteredAfterEnd?: number
  } = {},
): GuitarTakeSnapshot {
  const kind = options.kind ?? 'midi'
  return {
    id: 'take-1',
    lifecycle: options.lifecycle ?? 'recording',
    input: {
      kind,
      requestedDeviceId: null,
      activeDeviceId: `test-${kind}`,
      activeDeviceLabel: `Test ${kind}`,
    },
    clock: {
      startedAtFrame: STARTED_AT_FRAME,
      sampleRate: SAMPLE_RATE,
      attack: {
        timingSource: kind === 'midi' ? 'midi-clock' : 'audio-clock',
        precision: kind === 'midi' ? 'high-resolution-midi' : 'sample-exact',
      },
      latency: {
        seconds: 0,
        frames: 0,
        provenance: kind === 'midi' ? 'midi-route-unmeasured' : 'none',
        uncertaintySeconds: null,
      },
    },
    events,
    durationFrames: options.durationFrames ?? null,
    filteredBeforeStart: 0,
    filteredAfterEnd: options.filteredAfterEnd ?? 0,
    truncated: (options.droppedEventCount ?? 0) > 0,
    droppedEventCount: options.droppedEventCount ?? 0,
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
  }
}

function engine(
  targets: readonly GuitarLiveScoreTargetInput[],
  inputKind: GuitarInputProfileKind = 'midi',
) {
  const finalBeat = Math.max(1, ...targets.map((note) => note.startBeat + 1))
  return createGuitarLiveScoreEngine({
    source: {
      referenceId: 'song-1',
      trackId: 'track-1',
      range: { startBeat: 0, endBeat: finalBeat },
    },
    sampleRate: SAMPLE_RATE,
    beatToSeconds: (beat) => beat,
    targets,
    inputKind,
  })
}

describe('createGuitarLiveScoreEngine', () => {
  it('scores exact MIDI notes, withholds the grade until four judgments, and is idempotent', () => {
    const score = engine(Array.from({ length: 4 }, (_, index) => target(index)))
    const events = [
      event('event-0', 0, 60),
      event('event-1', 1_000, 61),
      event('event-2', 2_000, 62),
      event('event-3', 3_000, 63),
    ]

    const warming = score.sample(take(events.slice(0, 3)), 2_181, 'good')
    expect(warming).toMatchObject({ score: 100, grade: null })
    expect(warming.totals.judgedTargets).toBe(3)

    const live = score.sample(take(events), 3_181, 'good')
    expect(live).toMatchObject({ score: 100, grade: 'S', basis: 'rolling-16' })
    expect(live.totals).toMatchObject({
      judgedTargets: 4,
      hitTargets: 4,
      missedTargets: 0,
      points: 400,
    })

    const repeated = score.sample(take(events), 3_181, 'good')
    expect(repeated.totals).toEqual(live.totals)
    expect(repeated.recentJudgments).toEqual(live.recentJudgments)
  })

  it('waits beyond 180 ms for a miss and lets a provisional attack gain pitch', () => {
    const noEventScore = engine([target(0)])
    expect(
      noEventScore.sample(take([]), 180, 'good').totals.judgedTargets,
    ).toBe(0)
    expect(
      noEventScore.sample(take([]), 181, 'good').recentJudgments[0],
    ).toMatchObject({ outcome: 'miss', score: 0 })

    const enrichedScore = engine([target(0)])
    const provisional = event('event-0', 170, null)
    const beforePitch = enrichedScore.sample(take([provisional]), 181, 'good')
    expect(beforePitch.totals.judgedTargets).toBe(0)

    const enriched = { ...provisional, pitch: event('x', 0, 60).pitch }
    const afterPitch = enrichedScore.sample(take([enriched]), 181, 'good')
    expect(afterPitch.recentJudgments[0]).toMatchObject({
      outcome: 'hit',
      eventId: 'event-0',
      score: 100,
    })
  })

  it('never reuses one retained attack for a later same-pitch target', () => {
    const score = engine([
      { id: 'first-c', midi: 60, startBeat: 0 },
      { id: 'second-c', midi: 60, startBeat: 0.1 },
    ])
    const retainedAttack = event('event-c', 0, 60)

    const first = score.sample(take([retainedAttack]), 181, 'good')
    expect(first.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 1,
      missedTargets: 0,
    })

    const second = score.sample(take([retainedAttack]), 281, 'good')
    expect(second.totals).toMatchObject({
      judgedTargets: 2,
      hitTargets: 1,
      missedTargets: 1,
    })
    expect(second.recentJudgments.map((judgment) => judgment.eventId)).toEqual([
      'event-c',
      null,
    ])
  })

  it('never scores an attack outside the pinned half-open range', () => {
    const score = createGuitarLiveScoreEngine({
      source: {
        referenceId: 'song-1',
        trackId: 'track-1',
        range: { startBeat: 0, endBeat: 1 },
      },
      sampleRate: SAMPLE_RATE,
      beatToSeconds: (beat) => beat,
      targets: [{ id: 'final-c', midi: 60, startBeat: 0.9 }],
      inputKind: 'midi',
    })

    const result = score.sample(
      take([event('after-end-c', 1_050, 60)], {
        lifecycle: 'completed',
        durationFrames: 1_150,
      }),
      1_000,
      'good',
    )

    expect(result.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 0,
      missedTargets: 1,
    })
  })

  it('scores MIDI chord onsets and passages faster than the acoustic pitch window', () => {
    const targets = [
      { id: 'chord-c', midi: 60, startBeat: 0 },
      { id: 'chord-e', midi: 64, startBeat: 0 },
      { id: 'fast-d', midi: 62, startBeat: 0.1 },
      { id: 'fast-f', midi: 65, startBeat: 0.2 },
    ]
    const score = engine(targets)
    const result = score.sample(
      take([
        event('event-c', 0, 60),
        event('event-e', 0, 64),
        event('event-d', 100, 62),
        event('event-f', 200, 65),
      ]),
      381,
      'good',
    )

    expect(result.totals).toMatchObject({
      judgedTargets: 4,
      hitTargets: 4,
      skippedTargets: 0,
    })
    expect(result.grade).toBe('S')
  })

  it('skips polyphonic and closely spaced acoustic onsets instead of pretending to hear them', () => {
    const targets = [
      { id: 'chord-c', midi: 60, startBeat: 0 },
      { id: 'chord-e', midi: 64, startBeat: 0 },
      { id: 'fast-d', midi: 62, startBeat: 1 },
      { id: 'fast-f', midi: 65, startBeat: 1.1 },
      { id: 'slow-g', midi: 67, startBeat: 2 },
    ]
    const score = engine(targets, 'microphone')
    const result = score.sample(
      take([event('slow-g-event', 2_000, 67, 'microphone')], {
        kind: 'microphone',
      }),
      2_181,
      'good',
    )

    expect(result.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 1,
      skippedTargets: 4,
    })
    expect(
      result.recentJudgments.filter(
        (judgment) => judgment.skipReason === 'polyphonic-onset',
      ),
    ).toHaveLength(2)
    expect(
      result.recentJudgments.filter(
        (judgment) => judgment.skipReason === 'fast-passage',
      ),
    ).toHaveLength(2)
  })

  it.each(['clipping', 'noisy', 'uncertain'] as const)(
    'skips an expiring target while input health is %s',
    (health) => {
      const score = engine([target(0)])
      const result = score.sample(take([]), 181, health)

      expect(result.totals).toMatchObject({
        judgedTargets: 0,
        missedTargets: 0,
        skippedTargets: 1,
      })
      expect(result.recentJudgments[0]).toMatchObject({
        outcome: 'skipped',
        skipReason: `input-${health}`,
      })
    },
  )

  it('uses the latest 16 judgments while active and the cumulative result when complete', () => {
    const targets = Array.from({ length: 20 }, (_, index) => target(index))
    const events = targets
      .slice(4)
      .map((note, index) =>
        event(
          `event-${index + 4}`,
          Math.round(note.startBeat * SAMPLE_RATE),
          note.midi,
        ),
      )
    const score = engine(targets)

    const active = score.sample(take(events), 19_181, 'good')
    expect(active).toMatchObject({
      basis: 'rolling-16',
      score: 100,
      grade: 'S',
      cumulativeScore: 80,
      cumulativeGrade: 'B',
    })

    const completed = score.sample(
      take(events, {
        lifecycle: 'completed',
        durationFrames: 20_000,
      }),
      20_000,
      'good',
    )
    expect(completed).toMatchObject({
      phase: 'completed',
      basis: 'cumulative',
      score: 80,
      grade: 'B',
    })
  })

  it('keeps totals through more than 256 rolling recorder events', () => {
    const count = 300
    const spacing = 0.2
    const targets = Array.from({ length: count }, (_, index) =>
      target(index, spacing),
    )
    const score = engine(targets)
    const allEvents: GuitarTakeEvent[] = []
    let result = score.snapshot()

    for (let index = 0; index < count; index += 1) {
      const note = targets[index]
      if (note === undefined) continue
      const frame = Math.round(note.startBeat * SAMPLE_RATE)
      allEvents.push(event(`event-${index}`, frame, note.midi))
      const retained = allEvents.slice(-256)
      result = score.sample(
        take(retained, {
          droppedEventCount: allEvents.length - retained.length,
        }),
        frame + 181,
        'good',
      )
    }

    expect(result.totals).toMatchObject({
      judgedTargets: 300,
      hitTargets: 300,
      missedTargets: 0,
      points: 30_000,
    })
    expect(result.evidenceStatus).toBe('complete')
    expect(result.recentJudgments).toHaveLength(
      GUITAR_LIVE_SCORE_ROLLING_TARGETS,
    )
  })

  it('detects a recorder page it never observed and skips targets the gap could affect', () => {
    const count = 300
    const spacing = 0.2
    const targets = Array.from({ length: count }, (_, index) =>
      target(index, spacing),
    )
    const allEvents = targets.map((note, index) =>
      event(
        `event-${index}`,
        Math.round(note.startBeat * SAMPLE_RATE),
        note.midi,
      ),
    )
    const score = engine(targets)
    const result = score.sample(
      take(allEvents.slice(-256), { droppedEventCount: 44 }),
      60_000,
      'good',
    )

    expect(result).toMatchObject({
      evidenceStatus: 'event-gap',
      detectedGapCount: 1,
    })
    expect(result.totals).toMatchObject({
      judgedTargets: 255,
      hitTargets: 255,
      missedTargets: 0,
      skippedTargets: 45,
    })
    expect(
      result.recentJudgments.some(
        (judgment) => judgment.skipReason === 'event-gap',
      ),
    ).toBe(false)
  })

  it('settles a cancelled take without treating its cleared recorder page as a gap', () => {
    const score = engine([target(0), target(1)])
    score.sample(take([event('event-0', 0, 60)]), 181, 'good')

    const cancelled = score.sample(
      take([], { lifecycle: 'cancelled' }),
      200,
      'good',
    )

    expect(cancelled).toMatchObject({
      phase: 'cancelled',
      evidenceStatus: 'complete',
      score: 100,
      grade: null,
    })
    expect(cancelled.totals.judgedTargets).toBe(1)
  })

  it('returns bounded frozen display data and rejects identity changes', () => {
    const targets = Array.from({ length: 20 }, (_, index) => target(index))
    const events = targets.map((note, index) =>
      event(`event-${index}`, index * SAMPLE_RATE, note.midi),
    )
    const score = engine(targets)
    const result = score.sample(take(events), 19_181, 'good')

    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.totals)).toBe(true)
    expect(Object.isFrozen(result.recentJudgments)).toBe(true)
    expect(Object.isFrozen(result.recentJudgments[0])).toBe(true)
    expect(result.recentJudgments).toHaveLength(16)

    const changed = {
      ...events[19]!,
      compensatedTransportFrame: 19_001,
    }
    expect(() =>
      score.sample(take([...events.slice(0, 19), changed]), 19_181, 'good'),
    ).toThrow('Guitar take event identity changed')
  })

  it('rejects duplicate target identities', () => {
    expect(() =>
      engine([
        { id: 'same', midi: 60, startBeat: 0 },
        { id: 'same', midi: 62, startBeat: 1 },
      ]),
    ).toThrow('Duplicate live-score target id')
  })
})
