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
    rejectedAfterEnd?: number
    retractedAfterEnd?: number
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
    rejectedAfterEnd: options.rejectedAfterEnd ?? 0,
    retractedAfterEnd: options.retractedAfterEnd ?? 0,
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
  instrumentation?: {
    onRetainedEventVisit?(): void
    onTargetVisit?(): void
  },
  overrides: Partial<Parameters<typeof createGuitarLiveScoreEngine>[0]> = {},
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
    instrumentation,
    ...overrides,
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

  it('does not advance the unresolved frontier past a provisional attack', () => {
    const score = engine([
      { id: 'chord-c', midi: 60, startBeat: 0 },
      { id: 'chord-e', midi: 64, startBeat: 0 },
    ])
    const provisional = event('event-c', 170, null)
    const exact = event('event-e', 0, 64)

    const waiting = score.sample(take([provisional, exact]), 181, 'good')
    expect(waiting.totals.judgedTargets).toBe(0)

    const enriched = { ...provisional, pitch: event('x', 0, 60).pitch }
    const settled = score.sample(take([enriched, exact]), 181, 'good')
    expect(settled.totals).toMatchObject({
      judgedTargets: 2,
      hitTargets: 2,
      missedTargets: 0,
    })
    expect(
      settled.recentJudgments.map((judgment) => judgment.targetId),
    ).toEqual(['chord-c', 'chord-e'])
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

  it('does not turn rejected post-End events into an in-range evidence gap', () => {
    const score = engine([
      target(0),
      target(1),
      target(2),
      target(3),
      target(4),
    ])
    const earned = [0, 1, 2, 3].map((index) =>
      event(`event-${index}`, index * SAMPLE_RATE, 60 + index),
    )

    score.sample(take(earned), 3_250, 'good')
    const result = score.sample(
      take(earned, {
        lifecycle: 'completed',
        durationFrames: 3_250,
        filteredAfterEnd: 1,
        rejectedAfterEnd: 1,
      }),
      3_250,
      'good',
    )

    expect(result).toMatchObject({
      phase: 'completed',
      basis: 'cumulative',
      evidenceStatus: 'complete',
      targetCount: 5,
      totals: {
        judgedTargets: 4,
        hitTargets: 4,
        missedTargets: 0,
        skippedTargets: 0,
      },
    })
    expect(
      result.recentJudgments.some(
        (judgment) => judgment.targetId === 'target-4',
      ),
    ).toBe(false)
  })

  it('forgets a previously published event beyond the pinned manual End', () => {
    const score = engine([
      target(0),
      target(1),
      target(2),
      { id: 'target-before-end', midi: 64, startBeat: 3.2 },
      target(4),
    ])
    const earned = [0, 1, 2].map((index) =>
      event(`event-${index}`, index * SAMPLE_RATE, 60 + index),
    )
    const removedAfterEnd = event('event-after-end', 3_300, 64)

    score.sample(take([...earned, removedAfterEnd]), 3_250, 'good')
    const result = score.sample(
      take(earned, {
        lifecycle: 'completed',
        durationFrames: 3_250,
        filteredAfterEnd: 1,
        retractedAfterEnd: 1,
      }),
      3_250,
      'good',
    )

    expect(result).toMatchObject({
      phase: 'completed',
      evidenceStatus: 'complete',
      totals: {
        judgedTargets: 4,
        hitTargets: 3,
        missedTargets: 1,
        skippedTargets: 0,
      },
    })
    expect(
      result.recentJudgments.find(
        (judgment) => judgment.targetId === 'target-before-end',
      ),
    ).toMatchObject({ outcome: 'miss', eventId: null })
  })

  it('still detects an unseen recorder drop when pinEnd also retracts evidence', () => {
    const score = engine([target(0), target(1), target(2), target(3)])
    const first = event('event-0', 0, 60)
    const laterRetracted = event('event-after-end', 3_300, 63)

    score.sample(take([first, laterRetracted]), 200, 'good')
    const result = score.sample(
      take([first], {
        lifecycle: 'completed',
        durationFrames: 3_250,
        droppedEventCount: 1,
        filteredAfterEnd: 1,
        retractedAfterEnd: 1,
      }),
      3_250,
      'good',
    )

    expect(result).toMatchObject({
      phase: 'completed',
      evidenceStatus: 'event-gap',
      detectedGapCount: 1,
      totals: {
        judgedTargets: 1,
        hitTargets: 1,
        missedTargets: 0,
        skippedTargets: 3,
      },
    })
    expect(
      result.recentJudgments.filter(
        (judgment) => judgment.skipReason === 'event-gap',
      ),
    ).toHaveLength(3)
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

  it('judges an excluded onset against the evidence and still misses when there is none', () => {
    const targets = [
      { id: 'fast-d', midi: 62, startBeat: 1 },
      { id: 'fast-f', midi: 65, startBeat: 1.1 },
      { id: 'slow-g', midi: 67, startBeat: 2 },
    ]
    const score = engine(targets, 'microphone', undefined, {
      scorePolicy: 'evidence-first',
    })
    const result = score.sample(
      take(
        [
          event('fast-d-event', 1_000, 62, 'microphone'),
          event('slow-g-event', 2_000, 67, 'microphone'),
        ],
        { kind: 'microphone' },
      ),
      2_181,
      'good',
    )

    // fast-d was played and is now credited; fast-f was not played and is now
    // a miss rather than a shrug. Under exclude-first both were skipped, and
    // the run reported 100% off the single note it was willing to grade.
    expect(result.totals).toMatchObject({
      judgedTargets: 3,
      hitTargets: 2,
      missedTargets: 1,
      skippedTargets: 0,
    })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'fast-d'),
    ).toMatchObject({ outcome: 'hit', reclaimedFrom: 'fast-passage' })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'fast-f'),
    ).toMatchObject({ outcome: 'miss', reclaimedFrom: 'fast-passage' })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'slow-g'),
    ).toMatchObject({ outcome: 'hit', reclaimedFrom: null })
  })

  it('judges a chord once, through the voice it heard', () => {
    const targets = [
      { id: 'chord-c', midi: 60, startBeat: 0 },
      { id: 'chord-g', midi: 67, startBeat: 0 },
    ]
    const score = engine(targets, 'microphone', undefined, {
      scorePolicy: 'evidence-first',
    })
    const result = score.sample(
      take([event('chord-event', 0, 67, 'microphone')], {
        kind: 'microphone',
      }),
      1_181,
      'good',
    )

    // One detector hears one pitch, so the second voice is unprovable rather
    // than wrong. Exactly one judged unit, and it is a hit.
    expect(result.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 1,
      missedTargets: 0,
      skippedTargets: 1,
    })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'chord-g'),
    ).toMatchObject({ outcome: 'hit', reclaimedFrom: 'polyphonic-onset' })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'chord-c'),
    ).toMatchObject({ outcome: 'skipped', skipReason: 'unheard-voice' })
  })

  it('judges a chord as one voice even when dense exclusion is switched off', () => {
    const targets = [
      { id: 'chord-low', midi: 60, startBeat: 0 },
      { id: 'chord-high', midi: 67, startBeat: 0 },
    ]
    // denseTargetSpacingMs 0 turns dense-passage EXCLUSION off. It must not
    // also turn off chord-unit judging: one detector still hears one pitch, so
    // judging the voices independently would score the unheard one as a miss.
    // Measured on a real take of fast power chords with this setting live, ten
    // chords came back as one hit and one miss apiece.
    const score = engine(targets, 'microphone', undefined, {
      scorePolicy: 'evidence-first',
      denseTargetSpacingMs: 0,
    })
    const result = score.sample(
      take([event('chord-event', 0, 67, 'microphone')], {
        kind: 'microphone',
      }),
      1_181,
      'good',
    )

    expect(result.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 1,
      missedTargets: 0,
      skippedTargets: 1,
    })
    expect(
      result.recentJudgments.find((j) => j.targetId === 'chord-low'),
    ).toMatchObject({ outcome: 'skipped', skipReason: 'unheard-voice' })
  })

  it('lets a chord miss, so reclaiming cannot only ever raise the score', () => {
    const targets = [
      { id: 'chord-c', midi: 60, startBeat: 0 },
      { id: 'chord-g', midi: 67, startBeat: 0 },
    ]
    const score = engine(targets, 'microphone', undefined, {
      scorePolicy: 'evidence-first',
    })
    const result = score.sample(take([], { kind: 'microphone' }), 1_181, 'good')

    expect(result.totals).toMatchObject({
      judgedTargets: 1,
      hitTargets: 0,
      missedTargets: 1,
      skippedTargets: 1,
    })
  })

  it('spends a chord credit on the voice it matched outright, not an octave away', () => {
    const targets = [
      { id: 'chord-low', midi: 60, startBeat: 0 },
      { id: 'chord-high', midi: 67, startBeat: 0 },
    ]
    const score = engine(targets, 'microphone', undefined, {
      scorePolicy: 'evidence-first',
      octaveTolerantPitch: true,
    })
    // 72 is an octave above chord-low and an exact match for nothing; 67 is
    // chord-high outright. The exact voice has to win, or the one available
    // credit is spent on a harmonic while the fretted note goes unclaimed.
    const result = score.sample(
      take(
        [
          event('octave-event', 0, 72, 'microphone'),
          event('exact-event', 10, 67, 'microphone'),
        ],
        { kind: 'microphone' },
      ),
      1_181,
      'good',
    )

    expect(
      result.recentJudgments.find((j) => j.targetId === 'chord-high'),
    ).toMatchObject({ outcome: 'hit', eventId: 'exact-event' })
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

  it('judges a 2,245-target session from a monotonic frontier without re-ingesting unchanged snapshots', () => {
    const count = 2_245
    const targets = Array.from({ length: count }, (_, index) => target(index))
    let targetVisits = 0
    let retainedEventVisits = 0
    const score = engine(targets, 'midi', {
      onTargetVisit: () => {
        targetVisits += 1
      },
      onRetainedEventVisit: () => {
        retainedEventVisits += 1
      },
    })
    let result = score.snapshot()

    for (let index = 0; index < count; index += 1) {
      const note = targets[index]
      if (note === undefined) continue
      const frame = Math.round(note.startBeat * SAMPLE_RATE)
      const snapshot = take([event(`event-${index}`, frame, note.midi)], {
        droppedEventCount: index,
      })
      score.sample(snapshot, frame, 'good')
      result = score.sample(snapshot, frame + 181, 'good')
    }

    const finalIndex = count - 1
    const finalFrame = finalIndex * SAMPLE_RATE
    result = score.sample(
      take(
        [event(`event-${finalIndex}`, finalFrame, targets[finalIndex]!.midi)],
        {
          lifecycle: 'completed',
          durationFrames: finalFrame + 182,
          droppedEventCount: finalIndex,
        },
      ),
      finalFrame + 181,
      'good',
    )

    expect(result).toMatchObject({
      phase: 'completed',
      basis: 'cumulative',
      score: 100,
      evidenceStatus: 'complete',
      totals: {
        judgedTargets: count,
        hitTargets: count,
        missedTargets: 0,
        points: count * 100,
      },
    })
    expect(targetVisits).toBe(count * 3 - 1)
    expect(retainedEventVisits).toBe(count + 1)
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

  it("waits for a late strike's pitch instead of judging it unpitched", () => {
    // A strike's pitch is attached up to PITCH_ATTACH_WINDOW_MS after the
    // attack, so an attack landing later than `lateTolerance - pitchGrace`
    // into the window used to run out of grace before its target expired and
    // was judged while still unpitched. Measured on a real take: a B4 struck
    // 228.6 ms into a 320 ms window, exact pitch at clarity 0.97, missed live
    // and hit when the same events were replayed through the same engine.
    const score = engine(
      [{ id: 'late', midi: 60, startBeat: 0 }],
      'microphone',
      undefined,
      {
        matchToleranceMs: 180,
        lateToleranceMs: 320,
      },
    )
    const unpitched = event('strike', 228, null, 'microphone')
    const pitched = event('strike', 228, 60, 'microphone')

    // Past the late window, before the pitch has been attached.
    score.sample(take([unpitched], { kind: 'microphone' }), 330, 'good')
    expect(score.debugSnapshot()?.judgments ?? []).toHaveLength(0)

    // The recorder fills the pitch in on the same event, same frame, same id.
    const display = score.sample(
      take([pitched], { kind: 'microphone' }),
      420,
      'good',
    )
    expect(display.recentJudgments[0]).toMatchObject({
      outcome: 'hit',
      eventId: 'strike',
      score: 100,
    })
  })
})
