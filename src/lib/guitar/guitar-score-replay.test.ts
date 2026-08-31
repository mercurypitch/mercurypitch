import { describe, expect, it } from 'vitest'
import type { GuitarScoreExport } from './guitar-score-replay'
import { diffGuitarScoreReplays, replayGuitarScoreExport, } from './guitar-score-replay'

const RATE = 48_000

function exported(
  rows: GuitarScoreExport['model']['rows'],
  played: GuitarScoreExport['model']['played'],
): GuitarScoreExport {
  return {
    model: {
      sampleRate: RATE,
      inputKind: 'microphone',
      throughFrame: RATE * 10,
      rows,
      played,
    },
  }
}

function row(id: string, midi: number, beat: number) {
  return {
    targetId: id,
    midi,
    startBeat: beat,
    onsetFrame: Math.round(beat * RATE),
    onsetSeconds: beat,
  }
}

function strike(id: string, frame: number, midi: number | null) {
  return {
    eventId: id,
    kind: 'attack' as const,
    clockKind: 'audio-worklet',
    frame,
    rawFrame: frame,
    seconds: frame / RATE,
    midi,
    noteName: midi === null ? null : `MIDI ${midi}`,
    clarity: midi === null ? null : 0.95,
    level: 0.3,
  }
}

describe('replayGuitarScoreExport', () => {
  it('recovers the beat grid from the export and scores a clean run', () => {
    const result = replayGuitarScoreExport(
      exported(
        [row('a', 60, 1), row('b', 62, 2), row('c', 64, 3)],
        [
          strike('e1', RATE, 60),
          strike('e2', RATE * 2, 62),
          strike('e3', RATE * 3, 64),
        ],
      ),
    )

    expect(result).toMatchObject({ hit: 3, miss: 0, skipped: 0, judged: 3 })
    expect(result.hitShare).toBe(1)
  })

  it('measures what a policy change did, target by target', () => {
    // Two voices on one onset and a note in a dense pair: everything the old
    // policy refuses to look at, and all of it played correctly.
    const take = exported(
      [
        row('chord-low', 60, 1),
        row('chord-high', 67, 1),
        row('fast-a', 62, 2),
        row('fast-b', 64, 2.1),
      ],
      [
        strike('chord-event', RATE, 67),
        strike('fast-a-event', RATE * 2, 62),
        strike('fast-b-event', Math.round(RATE * 2.1), 64),
      ],
    )
    const before = replayGuitarScoreExport(take, {
      scorePolicy: 'exclude-first',
    })
    const after = replayGuitarScoreExport(take, {
      scorePolicy: 'evidence-first',
    })

    expect(before).toMatchObject({ hit: 0, judged: 0, skipped: 4 })
    expect(after).toMatchObject({ hit: 3, miss: 0, judged: 3, skipped: 1 })
    expect(after.skipReasons).toEqual({ 'unheard-voice': 1 })
    expect(after.reclaimed).toEqual({
      'polyphonic-onset:hit': 1,
      'fast-passage:hit': 2,
    })

    const changes = diffGuitarScoreReplays(before, after)
    expect(changes.filter((change) => change.to === 'hit')).toHaveLength(3)
    // The direction that matters: nothing the old policy scored may be lost.
    expect(changes.filter((change) => change.from === 'hit')).toHaveLength(0)
  })

  it('reports a miss where a reclaimed target had nothing behind it', () => {
    const result = replayGuitarScoreExport(
      exported(
        [row('fast-a', 62, 2), row('fast-b', 64, 2.1)],
        [strike('fast-a-event', RATE * 2, 62)],
      ),
      { scorePolicy: 'evidence-first' },
    )

    // Judging a hard passage has to be able to cost points, or the percentage
    // could only ever climb.
    expect(result).toMatchObject({ hit: 1, miss: 1, judged: 2 })
    expect(result.reclaimed).toMatchObject({ 'fast-passage:miss': 1 })
  })
})
