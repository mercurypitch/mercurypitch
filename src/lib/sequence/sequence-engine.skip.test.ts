// ============================================================
// Sequence engine — a wrong note skipped: one note ahead, and its guard
// ============================================================
//
// In free mode the engine also listens one note ahead. While note k is
// pending, the voice landing note k+1 misses k (skipped) and lands k+1 on
// the same frame, so the stars lit are the notes sung right. The voice that
// landed k-1 never counts toward k+1 while it stays on k-1: until a gap
// starts a new run, or its smoothed centre leaves k-1's band.
//
// Frame counts as in sequence-engine.test.ts. A note sung straight on from
// a wrong note at least a semitone away starts 100 cents out, as any
// legato note does, so it lands on its 22nd, 21st or 20th frame at
// Learning, Singer and Professional. A note sung out of silence lands on
// its 18th, 15th or 12th.

import { describe, expect, it } from 'vitest'
import { sequence } from '@/lib/glass/test-frames'
import type { EchoLevelId, NoteOutcome } from './sequence-engine'
import { ECHO_LEVELS } from './sequence-engine'
import type { SteadyNote } from './steady-note'
import { asMissed, C4, C5, D4, E4, F4, FS4, G3, G4, landings, micro, onsets, phraseOf, play, rest, sing, slide, vibrato, } from './test-echo'

/** Each note as it came out: landed, or the cause it missed by. */
const causes = (outcomes: readonly NoteOutcome[]) =>
  outcomes.map((o) => (o.landed ? 'landed' : o.cause))

/** The frame a note lands on, from its first frame, at each level. */
const FROM_SILENCE: Record<EchoLevelId, number> = {
  learning: 18,
  singer: 15,
  professional: 12,
}
const LEGATO: Record<EchoLevelId, number> = {
  learning: 22,
  singer: 21,
  professional: 20,
}

describe('tickSequence, a wrong note skipped', () => {
  // level, Merc's notes, what the singer sings for the second instead, and
  // the steady note the skipped second names. At Professional the leap is
  // undershot: a wrong note held only Merc's 0.45 s after a leap of more
  // than about six semitones settles too late to count as steady.
  const WRONG_SECOND: ReadonlyArray<
    [EchoLevelId, number[], number, SteadyNote]
  > = [
    ['learning', [C4, D4, E4], F4, { midi: F4, cents: 300 }],
    ['singer', [C4, E4, G4, E4], D4, { midi: D4, cents: -200 }],
    ['professional', [C4, G4, C5, G4, E4], D4, { midi: D4, cents: -500 }],
  ]

  it.each(WRONG_SECOND)(
    'lights every note but a wrong second at %s, and names what was sung for it',
    (level, notes, wrong, closest) => {
      // Arrange: the phrase at Merc's pace, the second note sung wrong.
      const preset = ECHO_LEVELS[level]
      const seconds = preset.noteSeconds
      const frames = sequence(
        rest(0.3),
        ...notes.map((midi, i) => sing(i === 1 ? wrong : midi, seconds)),
        rest(2),
      )
      const starts = notes.map((_, i) => 0.3 + i * seconds)
      const landsAt = starts.map((start, i) =>
        i === 1
          ? null
          : start + ((i === 0 ? FROM_SILENCE[level] : LEGATO[level]) - 1) / 60,
      )

      // Act
      const { state } = play(frames, phraseOf(notes, seconds), preset)

      // Assert: the second misses on the frame the third lands, skipped.
      const skipped = asMissed(state.outcomes[1])
      expect(landings(state.outcomes)).toEqual(
        landsAt.map((t) => (t === null ? null : micro(t))),
      )
      expect(onsets(state.outcomes)).toEqual(
        starts.map((start, i) => (i === 1 ? null : micro(start))),
      )
      expect(
        skipped === null
          ? null
          : {
              ...skipped,
              missedAt: micro(skipped.missedAt),
              closest: skipped.closest && {
                midi: skipped.closest.midi,
                cents: Math.round(skipped.closest.cents * 1e6) / 1e6,
              },
            },
      ).toEqual({
        index: 1,
        landed: false,
        missedAt: micro(landsAt[2] ?? 0),
        cause: 'skipped',
        voiced: true,
        closest,
      })
    },
  )

  it('fires the miss for the skipped note, then the landing, on one frame', () => {
    // Arrange: 1-3-5-3 at Singer; D sung for the second note (E4).
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.65),
      sing(D4, 0.65),
      sing(G4, 0.65),
      sing(E4, 0.65),
      rest(2),
    )

    // Act
    const { state, log } = play(
      frames,
      phraseOf([C4, E4, G4, E4], 0.65),
      ECHO_LEVELS.singer,
    )

    // Assert: G lands on its 21st frame, and its time to land runs from
    // the moment E became the one to sing (C's landing): 1.4 s.
    expect(
      log.map(({ t, event }) => [
        micro(t),
        event.type,
        event.type === 'phraseEnd' ? null : event.index,
      ]),
    ).toEqual([
      [micro(0.3 + 14 / 60), 'land', 0],
      [micro(1.6 + 20 / 60), 'miss', 1],
      [micro(1.6 + 20 / 60), 'land', 2],
      [micro(2.25 + 20 / 60), 'land', 3],
      [micro(2.25 + 20 / 60), 'phraseEnd', null],
    ])
    const third = state.outcomes[2]
    expect(third.landed ? third.timeToLandMs : null).toBe(1400)
  })

  it.each([
    ['learning', ['landed', 'skipped', 'landed'], 1.6 + 21 / 60],
    ['singer', ['landed', 'deadline', 'silence'], null],
  ] as const)(
    'lands the note ahead sung an octave down only where the level folds: %s',
    (level, outcomes, thirdLandsAt) => {
      // Arrange: C, then D for E, then G3 for G4, then the voice stops.
      const preset = ECHO_LEVELS[level]
      const frames = sequence(
        rest(0.3),
        sing(C4, 0.65),
        sing(D4, 0.65),
        sing(G3, 0.65),
        rest(3),
      )

      // Act
      const { state } = play(
        frames,
        phraseOf([C4, E4, G4], preset.noteSeconds),
        preset,
      )

      // Assert: at Singer, E waits for its deadline (3 s after C's
      // landing, 3.5333), which comes before the silence's end (2.2333 +
      // 1.4), and G is left to the silence.
      const third = state.outcomes[2]
      expect(causes(state.outcomes)).toEqual(outcomes)
      expect(landings(state.outcomes)[2]).toBe(
        thirdLandsAt === null ? null : micro(thirdLandsAt),
      )
      expect(third.landed ? Math.abs(third.cents) < 1e-6 : null).toBe(
        thirdLandsAt === null ? null : true,
      )
      expect(asMissed(state.outcomes[1])?.closest?.midi).toBe(D4)
    },
  )

  it('never listens two notes ahead', () => {
    // Arrange: Singer, C E G C5; after C the voice sings C5, the fourth.
    const frames = sequence(rest(0.3), sing(C4, 0.65), sing(C5, 1.5), rest(3))

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4, G4, C5], 0.65),
      ECHO_LEVELS.singer,
    )

    // Assert: E misses on its deadline (0.5333 + 3) and the silence after
    // the voice (2.4333 + 1.4) takes G and C5.
    const e = asMissed(state.outcomes[1])
    expect(causes(state.outcomes)).toEqual([
      'landed',
      'deadline',
      'silence',
      'silence',
    ])
    expect(micro(e?.missedAt ?? 0)).toBe(micro(0.3 + 14 / 60 + 3))
  })
})

describe('tickSequence, the held-over guard', () => {
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

describe('tickSequence, slides between notes', () => {
  it.each([
    // 1-2-3 at Learning: C slides up to D, settles, slides on to E.
    ['learning', [C4, D4, E4], 0.9, 0.2, 0.6],
    // 5-#4-5-3-1 at Professional: G dips to F#, settles, rises back to G.
    ['professional', [G4, FS4, G4, E4, C4], 0.45, 0.1, 0.45],
  ] as const)(
    'lands a note the voice slides into and settles on, and never skips it (%s)',
    (level, notes, seconds, glide, settle) => {
      // Arrange
      const [first, second, third, ...after] = notes
      const frames = sequence(
        rest(0.3),
        sing(first, seconds),
        slide(first, second, glide),
        sing(second, settle),
        slide(second, third, glide),
        sing(third, seconds),
        ...after.map((midi) => sing(midi, seconds)),
        rest(2),
      )
      const settleFrom = 0.3 + seconds + glide

      // Act
      const { state, log } = play(
        frames,
        phraseOf(notes, seconds),
        ECHO_LEVELS[level],
      )

      // Assert: the second lands while the voice sits on it.
      const landedAt = landings(state.outcomes)[1] ?? 0
      expect(causes(state.outcomes)).toEqual(notes.map(() => 'landed'))
      expect(log.filter(({ event }) => event.type === 'miss')).toEqual([])
      expect(landedAt).toBeGreaterThanOrEqual(micro(settleFrom))
      expect(landedAt).toBeLessThan(micro(settleFrom + settle))
    },
  )

  it('skips a note the voice only dips through on its way back', () => {
    // Arrange: 5-#4-5-3-1 at Professional. G dips to F# and straight
    // back, never settling, then the rest of the phrase in tune.
    const frames = sequence(
      rest(0.3),
      sing(G4, 0.45),
      slide(G4, FS4, 0.1),
      slide(FS4, G4, 0.1),
      sing(G4, 0.45),
      sing(E4, 0.45),
      sing(C4, 0.45),
      rest(2),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([G4, FS4, G4, E4, C4], 0.45),
      ECHO_LEVELS.professional,
    )

    // Assert: the dip leaves G's band, so the G after it lands the third
    // note while it is held (from 0.95 s); F# names nothing.
    const third = landings(state.outcomes)[2] ?? 0
    expect(causes(state.outcomes)).toEqual([
      'landed',
      'skipped',
      'landed',
      'landed',
      'landed',
    ])
    expect(asMissed(state.outcomes[1])?.closest).toBeNull()
    expect(third).toBeGreaterThanOrEqual(micro(0.95))
    expect(third).toBeLessThan(micro(1.4))
  })
})
