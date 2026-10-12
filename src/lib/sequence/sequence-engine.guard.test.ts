// ============================================================
// Sequence engine — the held-over guard: one voiced run lands one note
// ============================================================
//
// The voiced run that landed a note never lands a later one while it stays
// on that note: until a gap starts a new run, or its smoothed centre leaves
// that note's band. In free mode the note ahead hears it as silence, and so
// does the current note once a note between has missed by its deadline:
// otherwise a 5 held through the #4's deadline in 5-#4-5 would land the
// last 5.
//
// Frame counts as in sequence-engine.test.ts: a note sung out of silence
// lands on its 18th, 15th or 12th frame at Learning, Singer and
// Professional; one sung straight on from a note a semitone or more away,
// on its 22nd, 21st or 20th.

import { describe, expect, it } from 'vitest'
import { sequence } from '@/lib/glass/test-frames'
import { ECHO_LEVELS } from './sequence-engine'
import { A4, asMissed, C4, causes, D4, E4, F4, FS4, G4, landings, micro, phraseOf, play, rest, sing, vibrato, } from './test-echo'

/** 5-#4-5-3-1 at Professional, Merc's 0.45 s a note. */
const FIVE_SHARP_FOUR = phraseOf([G4, FS4, G4, E4, C4], 0.45)

describe('tickSequence, the held-over guard on the note ahead', () => {
  it('never lands the note after next from a note still held', () => {
    // Arrange: 1-3-5-3 at Singer. The singer holds E (the second note)
    // 0.65 s past G's turn, then sings G and E. Unguarded, the held E
    // would land the fourth note 15 frames after the second landed.
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.65),
      sing(E4, 1.3),
      sing(G4, 0.65),
      sing(E4, 0.65),
      rest(2),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4, G4, E4], 0.65),
      ECHO_LEVELS.singer,
    )

    // Assert: each note lands in turn, on its own pitch.
    expect(landings(state.outcomes)).toEqual([
      micro(0.3 + 14 / 60),
      micro(0.95 + 20 / 60),
      micro(2.25 + 20 / 60),
      micro(2.9 + 20 / 60),
    ])
  })

  it('keeps hold of a held note through vibrato wider than the band', () => {
    // Arrange: as above, but the held E swings 50 cents either side at
    // 5.5 Hz, past Singer's 35. The band is judged on the smoothed centre,
    // which the swing barely moves, so the guard never lets go of it.
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.65),
      vibrato(E4, 1.3, 50, 5.5),
      sing(G4, 0.65),
      sing(E4, 0.65),
      rest(2),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4, G4, E4], 0.65),
      ECHO_LEVELS.singer,
    )

    // Assert: G lands on its own pitch, and the last E only once sung.
    expect(causes(state.outcomes)).toEqual([
      'landed',
      'landed',
      'landed',
      'landed',
    ])
    expect(landings(state.outcomes)[2]).toBe(micro(2.25 + 20 / 60))
    expect(landings(state.outcomes)[3]).toBe(micro(2.9 + 20 / 60))
  })

  it.each([
    // A gap starts a new run: the E after it counts, sung out of silence.
    ['a gap', [sing(E4, 0.65), rest(0.2), sing(E4, 0.65)], 1.8 + 14 / 60, null],
    // F leaves E's band; the E after it, on the same run, counts.
    [
      'a move off the note',
      [sing(E4, 0.65), sing(F4, 0.65), sing(E4, 0.65)],
      2.25 + 20 / 60,
      { midi: F4, cents: -200 },
    ],
  ] as const)(
    'lets go of the held note after %s',
    (_name, parts, fourthLandsAt, closest) => {
      // Arrange: 1-3-5-3 at Singer: C, then E (the second note lands),
      // then the parts; G is never sung.
      const frames = sequence(rest(0.3), sing(C4, 0.65), ...parts, rest(2))

      // Act
      const { state } = play(
        frames,
        phraseOf([C4, E4, G4, E4], 0.65),
        ECHO_LEVELS.singer,
      )

      // Assert: G is skipped when the fourth note lands. After the gap
      // nothing steady was sung for G but the held-over E.
      const g = asMissed(state.outcomes[2])
      expect(causes(state.outcomes)).toEqual([
        'landed',
        'landed',
        'skipped',
        'landed',
      ])
      expect(landings(state.outcomes)[3]).toBe(micro(fourthLandsAt))
      expect(
        g?.closest === null || g?.closest === undefined
          ? null
          : { midi: g.closest.midi, cents: Math.round(g.closest.cents) },
      ).toEqual(closest)
    },
  )
})

describe('tickSequence, the held-over guard after a deadline miss', () => {
  it("lands nothing more from a first note held through the next one's deadline", () => {
    // Arrange: 5-#4-5-3-1 at Professional. The singer holds the first G
    // for 6 s. Unguarded, the held G would land the third note on its own
    // once the F# missed.
    const frames = sequence(rest(0.3), sing(G4, 6), rest(2))

    // Act
    const { state } = play(frames, FIVE_SHARP_FOUR, ECHO_LEVELS.professional)

    // Assert: the third note waits out its own deadline; the voice was
    // heard for it, but sat on no note of its own.
    const third = asMissed(state.outcomes[2])
    expect(causes(state.outcomes)).toEqual([
      'landed',
      'deadline',
      'deadline',
      'silence',
      'silence',
    ])
    expect(micro(third?.missedAt ?? 0)).toBe(micro(0.3 + 11 / 60 + 5))
    expect(third?.voiced).toBe(true)
    expect(third?.closest).toBeNull()
  })

  it.each([
    // A gap starts a new run: the G after it lands out of silence.
    ['a gap', [sing(G4, 3), rest(0.3), sing(G4, 0.45)], 3.6 + 11 / 60],
    // F# leaves G's band; the G after it, on the same run, lands legato.
    [
      'a move off the note',
      [sing(G4, 3), sing(FS4, 0.45), sing(G4, 0.45)],
      3.75 + 19 / 60,
    ],
  ] as const)(
    'lands the third note once the held first lets go, after %s',
    (_name, parts, thirdLandsAt) => {
      // Arrange: 5-#4-5-3-1 at Professional, the first G held 3 s, past
      // the F#'s deadline.
      const frames = sequence(rest(0.3), ...parts, rest(2))

      // Act
      const { state } = play(frames, FIVE_SHARP_FOUR, ECHO_LEVELS.professional)

      // Assert
      expect(causes(state.outcomes)).toEqual([
        'landed',
        'deadline',
        'landed',
        'silence',
        'silence',
      ])
      expect(landings(state.outcomes)[2]).toBe(micro(thirdLandsAt))
    },
  )

  it('names the note sung for the third once the held first lets go of it', () => {
    // Arrange: 5-#4-5-3-1 at Professional, the first G held 3 s, then A
    // straight on for the third note, then silence.
    const frames = sequence(rest(0.3), sing(G4, 3), sing(A4, 0.6), rest(2))

    // Act
    const { state } = play(frames, FIVE_SHARP_FOUR, ECHO_LEVELS.professional)

    // Assert: the A is the singer's own try at the third note, not the
    // held G, so Merc can name it.
    const third = asMissed(state.outcomes[2])
    expect(causes(state.outcomes)).toEqual([
      'landed',
      'deadline',
      'silence',
      'silence',
      'silence',
    ])
    expect(third?.voiced).toBe(true)
    expect(
      third?.closest === null || third?.closest === undefined
        ? null
        : { midi: third.closest.midi, cents: Math.round(third.closest.cents) },
    ).toEqual({ midi: A4, cents: 200 })
  })

  it('holds back the last note too, until a gap lets go (1-2-1 at Learning)', () => {
    // Arrange: C held 5 s, past D's 4 s deadline, then a breath and C
    // again.
    const frames = sequence(
      rest(0.3),
      sing(C4, 5),
      rest(0.3),
      sing(C4, 0.9),
      rest(2),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, D4, C4], 0.9),
      ECHO_LEVELS.learning,
    )

    // Assert: the last C lands on the C sung after the breath.
    expect(causes(state.outcomes)).toEqual(['landed', 'deadline', 'landed'])
    expect(landings(state.outcomes)[2]).toBe(micro(5.6 + 17 / 60))
  })
})
