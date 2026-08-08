import { describe, expect, it } from 'vitest'
import type { ScorableNote } from './transcription-score'
import { bestWindowOffset, pickReferenceTrack, pitchHistogram, scoreAgainstTruth, } from './transcription-score'

const note = (midi: number, startSeconds: number): ScorableNote => ({
  midi,
  startSeconds,
})

describe('scoreAgainstTruth', () => {
  it('counts an exact pitch at the right time as exact', () => {
    const line = [note(40, 0), note(42, 0.5), note(45, 1)]
    const score = scoreAgainstTruth(line, line, 0.12)
    expect(score.exact).toBe(3)
    expect(score.octaveOff).toBe(0)
    expect(score.wrongPitch).toBe(0)
    expect(score.missed).toBe(0)
    expect(score.precision).toBe(1)
    expect(score.recall).toBe(1)
  })

  it('separates an octave error from a correct note', () => {
    const truth = [note(40, 0), note(42, 0.5)]
    const heard = [note(52, 0), note(42, 0.5)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.exact).toBe(1)
    expect(score.octaveOff).toBe(1)
    expect(score.precision).toBe(0.5)
    expect(score.octaveTolerantPrecision).toBe(1)
  })

  it('records what kind of wrong a wrong pitch was', () => {
    // Every note heard a fifth below the tab — the signature of a detector
    // locking onto 1.5x the true period, and the reason the interval is kept.
    // No pair here is a whole octave apart, deliberately: with one that is,
    // the aligner can shift the window to land on it and the fifth-below line
    // scores as a single octave error instead of three wrong pitches.
    const truth = [note(45, 0), note(47, 0.5), note(49, 1)]
    const heard = [note(38, 0), note(40, 0.5), note(42, 1)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.wrongPitch).toBe(3)
    expect(score.pitchErrors).toEqual([[7, 3]])
  })

  it('calls a note with nothing near it spurious rather than wrong', () => {
    const truth = [note(40, 0)]
    const heard = [note(40, 0), note(55, 3)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.exact).toBe(1)
    expect(score.wrongPitch).toBe(0)
    expect(score.unmatched).toBe(1)
    expect(score.notes.find((entry) => entry.index === 1)?.verdict).toBe(
      'spurious',
    )
  })

  it('uses each reference note once, so a doubled note is not double credit', () => {
    const truth = [note(40, 0)]
    const heard = [note(40, 0), note(40, 0.02)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.exact).toBe(1)
    expect(score.unmatched).toBe(1)
    expect(score.missed).toBe(0)
  })

  it('follows a shift no single global offset could fit', () => {
    // The tab is half a second late for the first two windows and three
    // seconds late after that. One offset gets at most part of it right;
    // per-window offsets get all of it, which is why alignment is windowed.
    // The shift lands on a window boundary, as real drift effectively does —
    // a step INSIDE a window is unfittable by any single offset, and losing
    // that window's far side would be the correct result, not a regression.
    const PITCHES = [40, 43, 45, 47, 50]
    const heard: ScorableNote[] = []
    const truth: ScorableNote[] = []
    for (let index = 0; index < 20; index += 1) {
      const at = index * 0.9
      const pitch = PITCHES[index % PITCHES.length] ?? 40
      heard.push(note(pitch, at))
      truth.push(note(pitch, at + (at < 12 ? 0.5 : 3)))
    }
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.exact).toBeGreaterThanOrEqual(19)
    expect(score.windowOffsetSpread).toBeGreaterThan(2)
  })

  it('holds the riff-period alias off with the continuity prior', () => {
    // A riff that repeats every 2.4 s: in isolation a window scores as well
    // one riff-period off as at the true offset, and every note lands on its
    // neighbour's pitch. The anchor from the previous window is what keeps
    // the alignment on the right bar.
    const RIFF = [40, 43, 45, 40, 47, 45]
    const heard: ScorableNote[] = []
    const truth: ScorableNote[] = []
    for (let index = 0; index < 40; index += 1) {
      const pitch = RIFF[index % RIFF.length] ?? 40
      heard.push(note(pitch, index * 0.4))
      truth.push(note(pitch, index * 0.4 + 0.3))
    }
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.exact).toBe(40)
    expect(score.windowOffsetSpread).toBeLessThan(0.5)
  })

  it('reports per-note verdicts against the caller original indices', () => {
    const truth = [note(40, 0), note(42, 0.5)]
    const heard = [note(40, 0), note(43, 0.5)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.notes).toHaveLength(2)
    expect(score.notes[0]).toMatchObject({ index: 0, verdict: 'exact' })
    expect(score.notes[1]).toMatchObject({
      index: 1,
      verdict: 'wrong-pitch',
      truthMidi: 42,
    })
  })

  // Anchors pin the window's offset at zero; without them the aligner is free
  // to slide a lone heard note onto its counterpart and there is nothing left
  // to classify.
  const ANCHORS_TRUTH = [note(30, 2), note(31, 3), note(33, 4)]
  const ANCHORS_HEARD = [note(30, 2), note(31, 3), note(33, 4)]

  it('calls a wrong pair a shadow when the tab holds the heard pitch nearby', () => {
    // Root-and-fifth riff: the tab has E2 then B2 180 ms later. We heard the
    // E2 but late enough that the B2 is the nearest reference note. The E2 is
    // not a wrong pitch — its counterpart is right there; the defect is the
    // unheard B2, and the verdict has to say so or the display sends whoever
    // reads it hunting a detector bug that does not exist.
    const truth = [...ANCHORS_TRUTH, note(40, 5), note(47, 5.18)]
    const heard = [...ANCHORS_HEARD, note(40, 5.22)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.shadowed).toBe(1)
    expect(score.wrongPitch).toBe(0)
    expect(score.notes[3]?.verdict).toBe('shadow')
  })

  it('keeps a genuine wrong pitch wrong when no such neighbour exists', () => {
    const truth = [...ANCHORS_TRUTH, note(47, 5.18)]
    const heard = [...ANCHORS_HEARD, note(40, 5.22)]
    const score = scoreAgainstTruth(heard, truth, 0.12)
    expect(score.shadowed).toBe(0)
    expect(score.wrongPitch).toBe(1)
    expect(score.notes[3]?.verdict).toBe('wrong-pitch')
  })

  it('has no reference notes to miss when the tab is empty', () => {
    const score = scoreAgainstTruth([note(40, 0)], [], 0.12)
    expect(score.unmatched).toBe(1)
    expect(score.missed).toBe(0)
    expect(score.recall).toBe(0)
  })
})

describe('bestWindowOffset', () => {
  it('finds a constant shift between the two lines', () => {
    const heard = [note(40, 0), note(42, 0.5), note(45, 1)]
    const truth = heard.map((entry) => note(entry.midi, entry.startSeconds + 2))
    expect(bestWindowOffset(heard, truth, 0.12)).toBeCloseTo(2, 2)
  })

  it('is not dragged off by the octave errors it is meant to expose', () => {
    // Everything heard an octave low and half a second early. Scoring on pitch
    // class rather than exact pitch is what lets the offset still be found —
    // and what stops the octave error hiding itself in the alignment.
    const truth = [note(52, 0.5), note(54, 1), note(57, 1.5)]
    const heard = [note(40, 0), note(42, 0.5), note(45, 1)]
    expect(bestWindowOffset(heard, truth, 0.12)).toBeCloseTo(0.5, 2)
  })
})

describe('pickReferenceTrack', () => {
  const track = (id: string, name: string, instrumentName = '') => ({
    id,
    name,
    instrumentName,
    noteCount: 1,
    notes: [note(40, 0)],
  })

  it('matches a named track case-insensitively on name or instrument', () => {
    const tracks = [track('1', 'Bruce Dickinson'), track('2', 'Steve Harris')]
    expect(pickReferenceTrack(tracks, 'steve')?.id).toBe('2')
    expect(pickReferenceTrack(tracks, 'harris')?.id).toBe('2')
  })

  it('returns null rather than a wrong track when the name misses', () => {
    expect(pickReferenceTrack([track('1', 'Vocals')], 'trombone')).toBeNull()
  })

  it('guesses the bass when unnamed, and the first track when it cannot', () => {
    expect(
      pickReferenceTrack([track('1', 'Lead'), track('2', 'Bass Guitar')])?.id,
    ).toBe('2')
    expect(
      pickReferenceTrack([track('1', 'Lead'), track('2', 'Rhythm')])?.id,
    ).toBe('1')
    expect(pickReferenceTrack([])).toBeNull()
  })
})

describe('pitchHistogram', () => {
  it('ranks pitches by how often they occur', () => {
    const notes = [
      note(40, 0),
      note(40, 1),
      note(40, 2),
      note(42, 3),
      note(42, 4),
      note(45, 5),
    ]
    expect(pitchHistogram(notes)).toEqual([
      [40, 3],
      [42, 2],
      [45, 1],
    ])
    expect(pitchHistogram(notes, 2)).toHaveLength(2)
  })
})
