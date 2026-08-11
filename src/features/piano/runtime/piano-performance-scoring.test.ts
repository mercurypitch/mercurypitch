// ============================================================
// Piano performance scoring tests — onset evidence and safe discontinuities
// ============================================================

import { describe, expect, it } from 'vitest'
import type { PianoInputSnapshot, PianoInputVoice, } from '@/features/piano/input/piano-input-state'
import type { PianoPerformanceNote } from './piano-performance-contract'
import type { PianoPerformanceScoringSource } from './piano-performance-scoring'
import { createPianoPerformanceScoringEngine, PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT, } from './piano-performance-scoring'

const keyboard = Object.freeze({ kind: 'midi' as const, id: 'keyboard-a' })

function note(
  id: string,
  midi: number,
  startBeat: number,
  isBacking = false,
): PianoPerformanceNote {
  return {
    id,
    midi,
    name: `MIDI ${midi}`,
    startBeat,
    duration: 0.5,
    targetFreq: 440,
    isBacking,
  }
}

function voice(id: string, midi: number, startedAtMs: number): PianoInputVoice {
  return {
    id,
    source: keyboard,
    channel: 0,
    midi,
    velocity: 0.8,
    keyId: `${midi}`,
    startedAtMs,
    pressed: true,
    heldBySustain: false,
    heldBySostenuto: false,
    softPedalValue: 0,
  }
}

function input(
  revision: number,
  soundingNotes: readonly PianoInputVoice[] = [],
): PianoInputSnapshot {
  return {
    revision,
    pressedNotes: soundingNotes,
    soundingNotes,
    primaryNote: soundingNotes.at(-1) ?? null,
    pedals: [],
  }
}

function source(
  notes: readonly PianoPerformanceNote[],
  sourceId = 'song-a',
  scoreTimeAtBeatMs = (beat: number) => beat * 500,
): PianoPerformanceScoringSource {
  return { sourceId, notes, scoreTimeAtBeatMs }
}

function playing(
  playheadBeat: number,
  sampledAtMs: number,
  snapshot: PianoInputSnapshot,
  playbackRate = 1,
) {
  return {
    phase: 'playing' as const,
    playheadBeat,
    sampledAtMs,
    playbackRate,
    input: snapshot,
  }
}

describe('createPianoPerformanceScoringEngine', () => {
  it('scores only score-lane notes and exposes immutable run metrics', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('score', 60, 1), note('backing', 64, 1, true)]),
      { playheadBeat: 0, input: input(0) },
    )

    const update = scorer.sample(
      playing(1, 1_000, input(1, [voice('score-voice', 60, 1_000)])),
    )
    scorer.sample(
      playing(
        1.1,
        1_050,
        input(2, [
          voice('score-voice', 60, 1_000),
          voice('backing-voice', 64, 1_050),
        ]),
      ),
    )

    expect(update.judgments).toHaveLength(1)
    expect(update.judgments[0]).toMatchObject({
      noteId: 'score',
      outcome: 'hit',
      timing: 'perfect',
      pitchAccuracy: 'perfect',
      score: 100,
      timingDeltaMs: 0,
    })
    expect(scorer.snapshot()).toMatchObject({
      score: 100,
      accuracyPercent: 100,
      combo: 1,
      streak: 1,
      hits: 1,
      misses: 0,
      totalNotes: 1,
      complete: true,
    })
    expect(Object.isFrozen(update.state)).toBe(true)
    expect(Object.isFrozen(update.state.judgments)).toBe(true)
  })

  it.each([
    { offsetMs: -30, timing: 'perfect', score: 100 },
    { offsetMs: 30, timing: 'perfect', score: 100 },
    { offsetMs: 75, timing: 'great', score: 85 },
    { offsetMs: -150, timing: 'good', score: 70 },
    { offsetMs: 150, timing: 'good', score: 70 },
  ] as const)(
    'uses legacy timing and 60/40 weighting at $offsetMs ms',
    ({ offsetMs, timing, score: expectedScore }) => {
      const scorer = createPianoPerformanceScoringEngine(
        source([note('target', 60, 2)]),
        { playheadBeat: 0, input: input(0) },
      )
      const update = scorer.sample(
        playing(2, 2_000, input(1, [voice('strike', 60, 2_000 + offsetMs)])),
      )

      expect(update.judgments[0]).toMatchObject({
        timing,
        score: expectedScore,
        timingDeltaMs: offsetMs,
      })
    },
  )

  it('waits through wrong pitch, then records one miss after the window closes', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('target', 60, 1)]),
      { playheadBeat: 0, input: input(0) },
    )

    expect(
      scorer.sample(playing(1, 1_000, input(1, [voice('wrong', 61, 1_000)])))
        .judgments,
    ).toEqual([])
    expect(scorer.sample(playing(1.3, 1_150, input(2))).judgments).toEqual([])
    const missed = scorer.sample(playing(1.302, 1_151, input(3)))

    expect(missed.judgments).toHaveLength(1)
    expect(missed.judgments[0]).toMatchObject({
      outcome: 'miss',
      timing: 'miss',
      pitchAccuracy: 'off',
      score: 0,
      timingDeltaMs: null,
    })
    expect(scorer.snapshot()).toMatchObject({
      accuracyPercent: 0,
      combo: 0,
      streak: 0,
      hits: 0,
      misses: 1,
      judgedNotes: 1,
      complete: true,
    })
  })

  it('finalizes the last pending onset when transport completion closes its window', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('last', 60, 4), note('backing', 64, 8, true)]),
      { playheadBeat: 0, input: input(0) },
    )

    const completed = scorer.sample({
      phase: 'complete',
      playheadBeat: 4,
      sampledAtMs: 3_000,
      playbackRate: 1,
      input: input(1),
    })

    expect(completed.judgments).toHaveLength(1)
    expect(completed.judgments[0]).toMatchObject({
      noteId: 'last',
      outcome: 'miss',
    })
    expect(completed.state).toMatchObject({
      totalNotes: 1,
      misses: 1,
      pendingNotes: 0,
      complete: true,
    })
  })

  it('accepts a timestamp-valid final onset delivered with completion', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('last', 60, 4)]),
      { playheadBeat: 0, input: input(0) },
    )
    scorer.sample(playing(3.9, 2_950, input(1)))

    const completed = scorer.sample({
      phase: 'complete',
      playheadBeat: 4,
      sampledAtMs: 3_000,
      playbackRate: 1,
      input: input(2, [voice('delayed-final-onset', 60, 2_975)]),
    })

    expect(completed.judgments).toHaveLength(1)
    expect(completed.judgments[0]).toMatchObject({
      noteId: 'last',
      outcome: 'hit',
      timing: 'perfect',
      timingDeltaMs: -25,
    })
    expect(completed.state).toMatchObject({
      hits: 1,
      misses: 0,
      pendingNotes: 0,
      complete: true,
    })
  })

  it('matches chord onsets independently and never reuses sustained voices', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('c', 60, 1), note('e', 64, 1), note('later-c', 60, 2)]),
      { playheadBeat: 0, input: input(0) },
    )
    const chord = [voice('c-voice', 60, 1_000), voice('e-voice', 64, 1_010)]

    const first = scorer.sample(playing(1, 1_000, input(1, chord)))
    const held = scorer.sample(playing(2, 1_500, input(2, chord)))
    const released = scorer.sample(playing(2.31, 1_655, input(3)))

    expect(first.judgments.map((judgment) => judgment.noteId)).toEqual([
      'c',
      'e',
    ])
    expect(held.judgments).toEqual([])
    expect(released.judgments).toHaveLength(1)
    expect(released.judgments[0]).toMatchObject({
      noteId: 'later-c',
      outcome: 'miss',
    })
    expect(scorer.snapshot()).toMatchObject({
      hits: 2,
      misses: 1,
      combo: 0,
      streak: 2,
      accuracyPercent: 67,
    })
  })

  it('freezes judgment during pause and seeds held input across resume', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([note('first', 60, 1), note('second', 64, 2)]),
      { playheadBeat: 0, input: input(0) },
    )
    scorer.sample(playing(0.9, 1_000, input(1)))
    const heldDuringPause = input(2, [voice('paused-key', 60, 2_000)])

    const paused = scorer.sample({
      phase: 'paused',
      playheadBeat: 0.9,
      sampledAtMs: 4_000,
      playbackRate: 1,
      input: heldDuringPause,
    })
    scorer.discontinue({
      reason: 'resume',
      playheadBeat: 0.9,
      input: heldDuringPause,
    })
    const resumed = scorer.sample(playing(1, 4_050, heldDuringPause))
    const second = scorer.sample(
      playing(
        2,
        4_550,
        input(3, [
          voice('paused-key', 60, 2_000),
          voice('fresh-key', 64, 4_550),
        ]),
      ),
    )

    expect(paused.judgments).toEqual([])
    expect(resumed.judgments).toEqual([])
    expect(second.judgments.map((judgment) => judgment.noteId)).toEqual([
      'first',
      'second',
    ])
    expect(second.judgments.map((judgment) => judgment.outcome)).toEqual([
      'miss',
      'hit',
    ])
    expect(second.state.combo).toBe(1)
  })

  it('skips forward-seek spans, re-arms skipped notes on rewind, and locks judgments', () => {
    const scorer = createPianoPerformanceScoringEngine(
      source([
        note('first', 60, 1),
        note('second', 62, 2),
        note('third', 64, 3),
      ]),
      { playheadBeat: 0, input: input(0) },
    )
    scorer.sample(playing(1, 1_000, input(1, [voice('first-hit', 60, 1_000)])))

    const sought = scorer.discontinue({
      reason: 'seek',
      playheadBeat: 3,
      input: input(2, [voice('held-at-seek', 64, 1_500)]),
    })
    scorer.sample(
      playing(3, 2_000, input(2, [voice('held-at-seek', 64, 1_500)])),
    )

    expect(sought.state).toMatchObject({
      hits: 1,
      misses: 0,
      combo: 0,
      skippedNotes: 1,
      pendingNotes: 1,
    })

    const rewound = scorer.discontinue({
      reason: 'seek',
      playheadBeat: 1.5,
      input: input(3),
    })
    const replay = scorer.sample(
      playing(2, 2_250, input(4, [voice('second-hit', 62, 2_250)])),
    )

    expect(rewound.state).toMatchObject({ skippedNotes: 0, pendingNotes: 2 })
    expect(replay.judgments[0]).toMatchObject({
      noteId: 'second',
      outcome: 'hit',
    })
    expect(scorer.snapshot()).toMatchObject({
      hits: 2,
      misses: 0,
      combo: 1,
      streak: 1,
    })
  })

  it('resets metrics on source replacement and cannot score a held old voice', () => {
    const oldVoice = voice('same-held-voice', 60, 1_000)
    const scorer = createPianoPerformanceScoringEngine(
      source([note('old', 60, 1)]),
      { playheadBeat: 0, input: input(0) },
    )
    scorer.sample(playing(1, 1_000, input(1, [oldVoice])))

    const replaced = scorer.replaceSource(
      source([note('new', 60, 0)], 'song-b'),
      { playheadBeat: 0, input: input(1, [oldVoice]) },
    )
    const held = scorer.sample(playing(0, 2_000, input(1, [oldVoice])))
    const fresh = scorer.sample(
      playing(
        0.1,
        2_050,
        input(2, [oldVoice, voice('fresh-voice', 60, 2_000)]),
      ),
    )

    expect(replaced.discontinuity).toBe('source-replacement')
    expect(replaced.state).toMatchObject({
      sourceId: 'song-b',
      score: 0,
      hits: 0,
      misses: 0,
      combo: 0,
      streak: 0,
    })
    expect(held.judgments).toEqual([])
    expect(fresh.judgments[0]).toMatchObject({
      noteId: 'new',
      outcome: 'hit',
      timing: 'perfect',
    })
  })

  it('turns an unexplained playhead jump into a safe boundary, not bulk misses', () => {
    const held = voice('held-across-jump', 64, 1_100)
    const scorer = createPianoPerformanceScoringEngine(
      source([note('first', 60, 1), note('second', 64, 4)]),
      { playheadBeat: 0, input: input(0) },
    )
    scorer.sample(playing(0.5, 1_000, input(1)))

    const jump = scorer.sample(playing(4, 1_100, input(2, [held])))
    const afterJump = scorer.sample(playing(4.1, 1_150, input(2, [held])))

    expect(jump.discontinuity).toBe('clock-jump')
    expect(jump.judgments).toEqual([])
    expect(jump.state).toMatchObject({
      hits: 0,
      misses: 0,
      skippedNotes: 1,
      pendingNotes: 1,
    })
    expect(afterJump.judgments).toEqual([])
  })

  it('uses the supplied tempo-map integration and playback rate for timing', () => {
    const scoreTimeAtBeatMs = (beat: number) =>
      beat <= 1 ? beat * 500 : 500 + (beat - 1) * 1_000
    const scorer = createPianoPerformanceScoringEngine(
      source([note('after-change', 60, 2)], 'tempo-map', scoreTimeAtBeatMs),
      { playheadBeat: 0, input: input(0) },
    )

    const update = scorer.sample(
      playing(1.5, 2_000, input(1, [voice('strike', 60, 2_250)]), 2),
    )

    expect(update.judgments[0]).toMatchObject({
      noteId: 'after-change',
      timing: 'perfect',
      timingDeltaMs: 0,
    })
  })

  it('bounds dense snapshot history without truncating the current update', () => {
    const judgmentCount = PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT + 32
    const notes = Array.from({ length: judgmentCount }, (_, index) =>
      note(`dense-${index}`, 36 + (index % 72), 1),
    )
    const voices = Array.from({ length: judgmentCount }, (_, index) =>
      voice(`dense-voice-${index}`, 36 + (index % 72), 1_000),
    )
    const scorer = createPianoPerformanceScoringEngine(source(notes), {
      playheadBeat: 0,
      input: input(0),
    })

    const update = scorer.sample(playing(1, 1_000, input(1, voices)))

    expect(update.judgments).toHaveLength(judgmentCount)
    expect(update.state).toMatchObject({
      hits: judgmentCount,
      misses: 0,
      pendingNotes: 0,
      skippedNotes: 0,
      judgedNotes: judgmentCount,
      complete: true,
    })
    expect(update.state.judgments).toHaveLength(
      PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT,
    )
    expect(update.state.judgments).toEqual(
      update.judgments.slice(-PIANO_PERFORMANCE_JUDGMENT_HISTORY_LIMIT),
    )
  })
})
