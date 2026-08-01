// ── Jam run scoring tests ─────────────────────────────────────────────
// The properties that make a room's scoreboard mean something: notes are
// judged in their own slot, an unsung note costs you, beats are the
// coordinate (never wall-clock), takes do not bleed into each other, and
// only your own samples can ever become your own score.

import { describe, expect, it } from 'vitest'
import { scoreJamRun, scoreOwnJamRun } from '@/lib/jam/jam-scoring'
import type { TimeStampedPitchSample } from '@/lib/jam/types'
import type { MelodyData, MelodyItem, NoteName } from '@/types'

const A4 = 440
const midiToFreq = (m: number) => A4 * 2 ** ((m - 69) / 12)

function item(midi: number, startBeat: number, duration = 1): MelodyItem {
  return {
    id: startBeat + 1,
    note: { midi, name: 'C' as NoteName, octave: 4, freq: midiToFreq(midi) },
    duration,
    startBeat,
  }
}

/** C4 D4 E4, one beat each. */
function melody(items: MelodyItem[] = [item(60, 0), item(62, 1), item(64, 2)]) {
  return {
    id: 'm',
    name: 'Test',
    bpm: 60,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items,
  } as MelodyData
}

function sample(
  midi: number,
  beat: number | undefined,
  timestamp = 1000,
): TimeStampedPitchSample {
  return {
    frequency: midiToFreq(midi),
    noteName: 'C',
    cents: 0,
    clarity: 1,
    midi,
    timestamp,
    ...(beat === undefined ? {} : { beat }),
  }
}

describe('scoreJamRun', () => {
  it('scores a note sung dead on its target', () => {
    const run = scoreJamRun(melody([item(60, 0)]), [sample(60, 0.5)])
    expect(run.score).toBe(100)
    expect(run.coverage).toBe(1)
  })

  it('judges each note only against the samples in its own slot', () => {
    // Right notes, wrong order: C sung during E's beat and E during C's.
    // A window-wide best-match would call this perfect; slot-aligned
    // scoring must not.
    const run = scoreJamRun(melody(), [
      sample(64, 0.5),
      sample(62, 1.5),
      sample(60, 2.5),
    ])
    expect(run.notes[0]!.score).toBe(0)
    expect(run.notes[2]!.score).toBe(0)
    // The middle note was in the right place, so it still scores.
    expect(run.notes[1]!.score).toBe(100)
  })

  it('charges you for notes you never sang', () => {
    // One perfect note out of three is a third of a run, not a perfect run.
    const run = scoreJamRun(melody(), [sample(60, 0.5)])
    expect(run.coverage).toBeCloseTo(1 / 3)
    expect(run.score).toBeLessThan(40)
    expect(run.notes[1]!.voiced).toBe(false)
    expect(run.notes[1]!.score).toBe(0)
  })

  it('ignores samples with no beat', () => {
    // Captured while nothing was playing, or sent by a peer old enough not
    // to stamp a beat -- either way there is no honest place to put them.
    const run = scoreJamRun(melody([item(60, 0)]), [sample(60, undefined)])
    expect(run.coverage).toBe(0)
    expect(run.score).toBe(0)
  })

  it('scores a flat note below a dead-on one', () => {
    const dead = scoreJamRun(melody([item(60, 0)]), [sample(60, 0.5)])
    const flat = scoreJamRun(melody([item(60, 0)]), [sample(59, 0.5)])
    expect(flat.score).toBeLessThan(dead.score)
    expect(flat.coverage).toBe(1) // sung, just not in tune
  })

  it('keeps the previous take out of this one', () => {
    // Beats repeat every take, so a looped run walks 0..N again. Without a
    // take boundary the first pass sits in the second pass's slots.
    const samples = [sample(64, 0.5, 1000), sample(60, 0.5, 5000)]
    const bothTakes = scoreJamRun(melody([item(60, 0)]), samples)
    const secondOnly = scoreJamRun(melody([item(60, 0)]), samples, 4000)
    expect(secondOnly.score).toBe(100)
    expect(bothTakes.score).toBeLessThan(secondOnly.score)
  })

  it('is empty for no melody or an empty one', () => {
    expect(scoreJamRun(null, [sample(60, 0)]).score).toBe(0)
    expect(scoreJamRun(melody([]), [sample(60, 0)]).notes).toEqual([])
  })

  it('spans a note over its full duration, not just its first beat', () => {
    const long = melody([item(60, 0, 4)])
    const run = scoreJamRun(long, [sample(60, 3.5)])
    expect(run.score).toBe(100)
  })
})

describe('scoreOwnJamRun', () => {
  const history = {
    me: [sample(60, 0.5)],
    // A peer claiming a flawless take. The DataChannel is an
    // unauthenticated relay, so this is untrusted input.
    them: [sample(60, 0.5), sample(62, 1.5), sample(64, 2.5)],
  }

  it('scores only my own samples, never those of a peer', () => {
    const mine = scoreOwnJamRun(melody(), history, 'me')
    expect(mine.coverage).toBeCloseTo(1 / 3)
    // If peer samples leaked in, this would be a perfect run.
    expect(mine.score).toBeLessThan(40)
  })

  it('is empty when I have no peer id yet', () => {
    expect(scoreOwnJamRun(melody(), history, null).score).toBe(0)
    expect(scoreOwnJamRun(melody(), history, '').score).toBe(0)
  })

  it('is empty when I sang nothing', () => {
    expect(scoreOwnJamRun(melody(), history, 'absent').coverage).toBe(0)
  })
})
