// ============================================================
// Sequence engine — rhythm at Professional, timed mode, and its events
// ============================================================
//
// Frame counts as in sequence-engine.test.ts: a note sung out of silence
// lands on its land-time-th frame (15 at Singer's 250 ms, so 14/60 s after
// its first), and a fresh note whose first frame is already in band lands
// land-time frames after it (15/60 s at Singer).

import { describe, expect, it } from 'vitest'
import { sequence, silence } from '@/lib/glass/test-frames'
import type { PitchFrame } from '@/lib/pitch-f0-stream'
import type { Phrase, SequencePreset } from './sequence-engine'
import { ECHO_LEVELS } from './sequence-engine'
import { sequenceMetrics } from './sequence-metrics'
import type { Played } from './test-echo'
import { asMissed, C4, C5, D4, E4, G4, landings, micro, onsets, phraseOf, play, rest, sing, } from './test-echo'

describe('tickSequence, rhythm at Professional', () => {
  it('puts a clean echo in time and one late last note out of it', () => {
    // Arrange: C G C G E at 0.45 s; in the late take the fourth note is
    // held 0.2 s longer, so the last arrives 200 ms after Merc's spacing.
    const preset = ECHO_LEVELS.professional
    const notes = [C4, G4, C5, G4, E4]
    const phrase = phraseOf(notes, 0.45)
    const take = (lengths: number[]) =>
      sequence(
        rest(0.3),
        ...notes.map((midi, i) => sing(midi, lengths[i])),
        rest(2),
      )

    // Act
    const clean = play(take([0.45, 0.45, 0.45, 0.45, 0.45]), phrase, preset)
    const late = play(take([0.45, 0.45, 0.45, 0.65, 0.45]), phrase, preset)

    // Assert
    const rhythm = (played: Played) =>
      sequenceMetrics([{ phrase, outcomes: played.state.outcomes }], 120).rhythm
    expect(late.state.outcomes.every((o) => o.landed)).toBe(true)
    expect(rhythm(clean)).toEqual({ inTime: 5, notes: 5 })
    expect(rhythm(late)).toEqual({ inTime: 4, notes: 5 })
  })
})

/** Singer's band and land time, on a clock: 100 ms early, 150 ms late. */
const TIMED: SequencePreset = {
  tolCents: 35,
  landMs: 250,
  octaveFold: false,
  timing: { mode: 'timed', earlyMs: 100, lateMs: 150 },
}

/** Notes on the response's clock: 0.6 s each from 0.5 s. */
const timedPhrase = (midis: readonly number[]): Phrase => ({
  notes: midis.map((midi, i) => ({ midi, at: 0.5 + 0.6 * i, seconds: 0.6 })),
})

describe('tickSequence, timed mode', () => {
  it('closes each note on its window, so a miss never holds up the next', () => {
    // Arrange: windows C 0.4-1.25, E 1.0-1.85, G 1.6-2.45. E is sung
    // 60 cents flat; G from 1.7 s, in tune.
    const frames = sequence(
      rest(0.5),
      sing(C4, 0.6),
      sing(E4, 0.6, -60),
      sing(G4, 0.6),
      rest(1),
    )

    // Act
    const { state } = play(frames, timedPhrase([C4, E4, G4]), TIMED)

    // Assert: E misses when its window closes; G listens from then (1.85)
    // and lands 15 frames on, inside its own window.
    const e = asMissed(state.outcomes[1])
    expect(landings(state.outcomes)).toEqual([
      micro(0.5 + 14 / 60),
      null,
      micro(1.85 + 15 / 60),
    ])
    expect([e?.cause, micro(e?.missedAt ?? 0)]).toEqual(['window', micro(1.85)])
    expect(e?.closest?.midi).toBe(E4 - 1)
    expect(e?.closest?.cents).toBeCloseTo(-60, 6)
  })

  it('does not listen before a note window opens', () => {
    // Arrange: one note at 1.0 s (window from 0.9); the voice from 0.3 s.
    const phrase: Phrase = { notes: [{ midi: C4, at: 1, seconds: 0.5 }] }
    const frames = sequence(rest(0.3), sing(C4, 1.1), rest(1))

    // Act
    const { state } = play(frames, phrase, TIMED)

    // Assert
    expect(onsets(state.outcomes)).toEqual([micro(0.9)])
    expect(landings(state.outcomes)).toEqual([micro(0.9 + 15 / 60)])
  })

  it('lands a repeated note once in each window while the voice holds it', () => {
    // Arrange: C C; the voice holds C4 from 0.5 to 1.7 s.
    const frames = sequence(rest(0.5), sing(C4, 1.2), rest(1))

    // Act
    const { state } = play(frames, timedPhrase([C4, C4]), TIMED)

    // Assert: the second listens from its window (1.0) once the first is in.
    expect(landings(state.outcomes)).toEqual([
      micro(0.5 + 14 / 60),
      micro(1 + 15 / 60),
    ])
  })

  it('never skips ahead: a note sung early waits for its own window', () => {
    // Arrange: C E G; the singer leaves E out and sings G from 1.0 s,
    // inside E's window (1.0 to 1.85), and holds it to 2.3 s.
    const frames = sequence(rest(0.5), sing(C4, 0.5), sing(G4, 1.3), rest(1))

    // Act
    const { state } = play(frames, timedPhrase([C4, E4, G4]), TIMED)

    // Assert: E misses when its window closes, not when G is sung; G
    // listens from then and lands 15 frames on.
    expect(state.outcomes.map((o) => (o.landed ? 'landed' : o.cause))).toEqual([
      'landed',
      'window',
      'landed',
    ])
    expect(landings(state.outcomes)).toEqual([
      micro(0.5 + 14 / 60),
      null,
      micro(1.85 + 15 / 60),
    ])
  })
})

describe('tickSequence, events', () => {
  const scenarios: Array<[string, PitchFrame[], Phrase, SequencePreset]> = [
    [
      'a clean echo',
      sequence(rest(0.3), sing(C4, 0.9), sing(E4, 0.9), sing(G4, 0.9), rest(2)),
      phraseOf([C4, E4, G4], 0.9),
      ECHO_LEVELS.learning,
    ],
    [
      'a flat note and a stop',
      sequence(rest(0.3), sing(C4, 0.65), sing(D4, 0.65, -60), rest(5)),
      phraseOf([C4, D4, E4, G4], 0.65),
      ECHO_LEVELS.singer,
    ],
    [
      'a wrong note skipped',
      sequence(
        rest(0.3),
        sing(C4, 0.65),
        sing(D4, 0.65),
        sing(G4, 0.65),
        sing(E4, 0.65),
        rest(2),
      ),
      phraseOf([C4, E4, G4, E4], 0.65),
      ECHO_LEVELS.singer,
    ],
    [
      'a note held past the next one',
      sequence(
        rest(0.3),
        sing(C4, 0.65),
        sing(E4, 1.3),
        sing(G4, 0.65),
        sing(E4, 0.65),
        rest(2),
      ),
      phraseOf([C4, E4, G4, E4], 0.65),
      ECHO_LEVELS.singer,
    ],
    [
      'a silent response',
      silence(14),
      phraseOf([C4, D4, E4], 0.9),
      ECHO_LEVELS.learning,
    ],
    [
      'a timed line',
      sequence(
        rest(0.5),
        sing(C4, 0.6),
        sing(E4, 0.6, -60),
        sing(G4, 0.6),
        rest(1),
      ),
      timedPhrase([C4, E4, G4]),
      TIMED,
    ],
  ]

  it.each(scenarios)(
    'fires one land or miss per note and one phrase end, then nothing (%s)',
    (_name, frames, phrase, preset) => {
      // Arrange: a second of frames after the stream, past the end.
      const last = frames[frames.length - 1].t
      const after = silence(1, last + 1 / 60)

      // Act
      const { log } = play([...frames, ...after], phrase, preset)

      // Assert
      const notes = log
        .filter(({ event }) => event.type !== 'phraseEnd')
        .map(({ event }) => (event.type === 'phraseEnd' ? -1 : event.index))
      expect(notes).toEqual(phrase.notes.map((_, i) => i))
      expect(
        log.filter(({ event }) => event.type === 'phraseEnd'),
      ).toHaveLength(1)
      expect(log[log.length - 1].event.type).toBe('phraseEnd')
      expect(log[log.length - 1].t).toBeLessThanOrEqual(last)
    },
  )
})
