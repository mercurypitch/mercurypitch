// ============================================================
// Guitar score debug tests — the four failure classes must stay distinguishable.
// ============================================================
//
// The point of this module is that "missed" is never the whole story. Each
// case below is a real way a player loses a note, and each must come back with
// its own diagnosis rather than a shared shrug.

import { describe, expect, it } from 'vitest'
import type { GuitarInputProfileKind } from './guitar-input-profile'
import type { GuitarLiveScoreTargetInput } from './guitar-live-score'
import { createGuitarLiveScoreEngine } from './guitar-live-score'
import { buildGuitarScoreDebugModel, describeGuitarScoreDiagnosis, } from './guitar-score-debug'
import type { GuitarTakeEvent, GuitarTakeSnapshot, } from './guitar-take-recorder'

const SAMPLE_RATE = 1_000
const STARTED_AT_FRAME = 10_000

function attack(
  id: string,
  frame: number,
  midi: number | null,
  clarity = 0.95,
  source: GuitarInputProfileKind = 'microphone',
  kind: GuitarTakeEvent['kind'] = 'attack',
): GuitarTakeEvent {
  const capturedAtFrame = STARTED_AT_FRAME + frame
  return {
    id,
    kind,
    source,
    voiceId: null,
    at: capturedAtFrame / SAMPLE_RATE,
    capturedAt: capturedAtFrame / SAMPLE_RATE,
    rawTransportFrame: frame,
    compensatedTransportFrame: frame,
    level: 0.3,
    clock: {
      kind: 'audio-worklet',
      atFrame: capturedAtFrame,
      sampleRate: SAMPLE_RATE,
    },
    pitch:
      midi === null
        ? null
        : { midi, noteName: `MIDI ${midi}`, cents: 0, clarity },
  }
}

function take(
  events: readonly GuitarTakeEvent[],
  lifecycle: GuitarTakeSnapshot['lifecycle'] = 'recording',
): GuitarTakeSnapshot {
  return {
    id: 'take-1',
    lifecycle,
    input: {
      kind: 'microphone',
      requestedDeviceId: null,
      activeDeviceId: 'test-mic',
      activeDeviceLabel: 'Test mic',
    },
    clock: {
      startedAtFrame: STARTED_AT_FRAME,
      sampleRate: SAMPLE_RATE,
      attack: { timingSource: 'audio-clock', precision: 'sample-exact' },
      latency: {
        seconds: 0,
        frames: 0,
        provenance: 'none',
        uncertaintySeconds: null,
      },
    },
    events,
    durationFrames: null,
    filteredBeforeStart: 0,
    filteredAfterEnd: 0,
    rejectedAfterEnd: 0,
    retractedAfterEnd: 0,
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
  }
}

function engineFor(
  targets: readonly GuitarLiveScoreTargetInput[],
  debug = true,
  matchPitchChanges = false,
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
    inputKind: 'microphone',
    matchPitchChanges,
    debug,
  })
}

/** One target per second, so nothing is excluded as a fast passage. */
function spacedTargets(midis: readonly number[]): GuitarLiveScoreTargetInput[] {
  return midis.map((midi, index) => ({
    id: `target-${index}`,
    midi,
    startBeat: index,
  }))
}

function modelFor(
  targets: readonly GuitarLiveScoreTargetInput[],
  events: readonly GuitarTakeEvent[],
  matchPitchChanges = false,
) {
  const live = engineFor(targets, true, matchPitchChanges)
  const snapshot = take(events, 'completed')
  live.sample(snapshot, targets.length * SAMPLE_RATE, 'good')
  const debug = live.debugSnapshot()
  expect(debug).not.toBeNull()
  return buildGuitarScoreDebugModel(debug!, snapshot)
}

describe('buildGuitarScoreDebugModel', () => {
  it('is unavailable unless the engine was created for debugging', () => {
    expect(engineFor(spacedTargets([60]), false).debugSnapshot()).toBeNull()
  })

  it('names a scored note as matched and keeps its timing offset', () => {
    const model = modelFor(spacedTargets([60]), [attack('e1', 40, 60)])
    const row = model.rows[0]
    expect(row?.outcome).toBe('hit')
    expect(row?.diagnosis).toBe('matched')
    expect(row?.timingOffsetMs).toBe(40)
    expect(model.played[0]?.matchedTargetId).toBe('target-0')
  })

  it('separates a silent bar from a strike that never got a pitch', () => {
    const model = modelFor(spacedTargets([60, 62]), [attack('e1', 1_000, null)])
    expect(model.rows[0]?.diagnosis).toBe('no-attack-nearby')
    expect(model.rows[1]?.diagnosis).toBe('attack-without-pitch')
  })

  it('calls out the octave error rather than reporting a wrong note', () => {
    const model = modelFor(spacedTargets([40]), [attack('e1', 30, 52)])
    const row = model.rows[0]
    expect(row?.diagnosis).toBe('octave-off')
    expect(row?.nearest?.semitoneDelta).toBe(12)
    expect(describeGuitarScoreDiagnosis(row!)).toContain('wrong octave')
  })

  it('distinguishes a genuinely different note from an octave', () => {
    const model = modelFor(spacedTargets([40]), [attack('e1', 30, 45)])
    expect(model.rows[0]?.diagnosis).toBe('wrong-pitch')
    expect(model.rows[0]?.nearest?.semitoneDelta).toBe(5)
  })

  it('reports the right note lost to the clarity floor', () => {
    const model = modelFor(spacedTargets([40]), [attack('e1', 30, 40, 0.45)])
    const row = model.rows[0]
    expect(row?.diagnosis).toBe('clarity-below-floor')
    expect(row?.nearest?.clarity).toBe(0.45)
  })

  it('reports the right note played outside the match window', () => {
    const model = modelFor(spacedTargets([40]), [attack('e1', 400, 40)])
    const row = model.rows[0]
    expect(row?.diagnosis).toBe('outside-timing-window')
    expect(row?.nearest?.offsetMs).toBe(400)
  })

  it('reports exclusion, with its reason, instead of a miss', () => {
    // Two notes on the same onset: a mono detector cannot prove either.
    const model = modelFor(
      [
        { id: 'a', midi: 40, startBeat: 0 },
        { id: 'b', midi: 47, startBeat: 0 },
      ],
      [attack('e1', 0, 40)],
    )
    expect(model.rows.map((row) => row.diagnosis)).toEqual([
      'excluded',
      'excluded',
    ])
    expect(model.summary.skipReasons['polyphonic-onset']).toBe(2)
    expect(describeGuitarScoreDiagnosis(model.rows[0]!)).toContain(
      'this exact onset',
    )
  })

  it('measures the route delay the take itself proves', () => {
    // Every note played a consistent 250 ms late: past the 180 ms window, so
    // nothing scores, but the offset is exactly what calibration would remove.
    const midis = [40, 45, 50, 55, 59, 64]
    const model = modelFor(
      spacedTargets(midis),
      midis.map((midi, index) =>
        attack(`e${index}`, index * 1_000 + 250, midi),
      ),
    )
    expect(model.summary.hit).toBe(0)
    expect(model.summary.suggestedLatencyOffsetMs).toBe(250)
    expect(model.summary.offsetSpreadMs).toBe(0)
    expect(model.summary.suggestedLatencySamples).toBe(midis.length)
    expect(model.summary.diagnoses['outside-timing-window']).toBe(midis.length)
  })

  it('cannot score a legato move until pitch changes are admitted', () => {
    // The attack detector only sees picked transients by design, so a
    // hammer-on or a pull-off produces a pitch change and nothing else. On a
    // fast passage that is most of what the take contains.
    const legato = [attack('e1', 40, 60, 0.95, 'microphone', 'pitch-change')]
    expect(modelFor(spacedTargets([60]), legato).rows[0]?.outcome).toBe('miss')

    const admitted = modelFor(spacedTargets([60]), legato, true)
    expect(admitted.matchPitchChanges).toBe(true)
    expect(admitted.rows[0]?.outcome).toBe('hit')
    expect(admitted.rows[0]?.diagnosis).toBe('matched')
  })

  it('reports which clock timed the take, so a coarse fallback is visible', () => {
    const model = modelFor(spacedTargets([60]), [attack('e1', 40, 60)])
    expect(model.clock.precision).toBe('sample-exact')
    expect(model.clock.coarseFallback).toBe(false)
    expect(model.clock.latencyProvenance).toBe('none')
    expect(model.played[0]?.clockKind).toBe('audio-worklet')
  })

  it('withholds a route delay it does not have the samples to claim', () => {
    const model = modelFor(spacedTargets([40, 45]), [attack('e1', 250, 40)])
    expect(model.summary.suggestedLatencyOffsetMs).toBeNull()
    expect(model.summary.suggestedLatencySamples).toBe(1)
  })
})
