// ============================================================
// Sequence engine — echoes sung back over synthetic frame streams
// ============================================================
//
// Frames are 1/60 s apart (glass/test-frames). Where the hold engine's
// smoothed centre decides a landing, the frame counts come from its
// one-pole step response, p = exp(-(1/60) / 0.1) = 0.8465 per frame:
//
// - A note sung out of silence is in band on its first frame, whose tick
//   already counts the 1/60 s since the frame before, so it lands on its
//   land-time-th frame: 18 at Learning, 15 at Singer, 12 at Professional.
// - A note sung straight on from the last one starts from the needle the
//   last note left, held to a semitone: 100 cents out. It enters the band
//   when 100 * p^j is inside it: on its 5th frame at Learning (43 c, inside
//   50), 7th at Singer (31 c, inside 35), 9th at Professional (22 c, inside
//   25). It lands land-time frames later: on its 22nd, 21st and 20th frame.
//
// Its onset is its first frame either way: the readings are in band from
// there, whatever the smoothed centre is doing.
//
// Rhythm, timed mode and the events are in sequence-engine.timing.test.ts;
// the streams and the runner both use are in test-echo.ts.

import { describe, expect, it } from 'vitest'
import { sequence, silence } from '@/lib/glass/test-frames'
import type { EchoLevelId } from './sequence-engine'
import { ECHO_LEVELS } from './sequence-engine'
import { asMissed, C3, C4, C5, D4, E4, F4, G4, landings, micro, onsets, phraseOf, play, rest, sing, slide, } from './test-echo'

// The phrase each level's echoes sing: its own length, Merc's own pace.
const ECHOES: ReadonlyArray<[EchoLevelId, number[], number]> = [
  // level, notes, frame each later note lands on (see the header)
  ['learning', [C4, E4, G4], 22],
  ['singer', [C4, E4, G4, E4], 21],
  ['professional', [C4, G4, C5, G4, E4], 20],
]

describe('tickSequence, a clean echo', () => {
  it.each(ECHOES)(
    'lands every note at %s, each from the frame the voice reached it',
    (level, notes, laterFrame) => {
      // Arrange: 0.3 s of silence, then the phrase at Merc's pace.
      const preset = ECHO_LEVELS[level]
      const seconds = preset.noteSeconds
      const frames = sequence(
        rest(0.3),
        ...notes.map((midi) => sing(midi, seconds)),
        rest(2),
      )
      const starts = notes.map((_, i) => 0.3 + i * seconds)
      const firstFrame = Math.round((preset.landMs * 60) / 1000)

      // Act
      const { state } = play(frames, phraseOf(notes, seconds), preset)

      // Assert
      expect(state.ended).toBe(true)
      expect(onsets(state.outcomes)).toEqual(starts.map(micro))
      expect(landings(state.outcomes)).toEqual(
        starts.map((start, i) =>
          micro(start + ((i === 0 ? firstFrame : laterFrame) - 1) / 60),
        ),
      )
      const cents = state.outcomes.map((o) => (o.landed ? o.cents : 999))
      expect(Math.max(...cents.map(Math.abs))).toBeLessThan(1e-6)
    },
  )

  it('counts the time to land from the moment a note became the one to sing', () => {
    // Arrange: Learning; the first note from the response start (0), each
    // later one from the landing before it.
    const frames = sequence(rest(0.3), sing(C4, 0.9), sing(E4, 0.9), rest(2))

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4], 0.9),
      ECHO_LEVELS.learning,
    )

    // Assert: 0.3 + 17/60 = 583 ms; then (1.2 + 21/60) - 0.5833 = 967 ms.
    expect(
      state.outcomes.map((o) => (o.landed ? o.timeToLandMs : null)),
    ).toEqual([583, 967])
  })
})

describe('tickSequence, notes that miss', () => {
  it('misses a note sung 60 cents flat at Singer and names where it sat', () => {
    // Arrange: C lands 14 frames in (0.5333 s). D is sung 60 cents flat,
    // outside Singer's 35, then F and G: no E, so the note ahead never
    // lands and D waits for its deadline (sequence-engine.skip.test.ts has
    // the E that skips it). The voice stops at 2.9 s (last frame 2.8833).
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.65),
      sing(D4, 0.65, -60),
      sing(F4, 0.65),
      sing(G4, 0.65),
      rest(3),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, D4, E4, G4], 0.65),
      ECHO_LEVELS.singer,
    )

    // Assert: D's deadline, 3 s after C's landing (3.5333), comes before
    // the silence's end (2.8833 + 1.4 = 4.2833), which takes E and G.
    const [, d, e, g] = state.outcomes.map(asMissed)
    expect(state.outcomes[0].landed).toBe(true)
    expect(d?.cause).toBe('deadline')
    expect(micro(d?.missedAt ?? 0)).toBe(micro(0.3 + 14 / 60 + 3))
    expect(d?.closest?.midi).toBe(D4 - 1)
    expect(d?.closest?.cents).toBeCloseTo(-60, 6)
    expect([e?.cause, g?.cause]).toEqual(['silence', 'silence'])
    expect([e?.missedAt, g?.missedAt].map((t) => micro(t ?? 0))).toEqual([
      micro(2.9 - 1 / 60 + 1.4),
      micro(2.9 - 1 / 60 + 1.4),
    ])
    expect([e?.voiced, e?.closest, g?.voiced, g?.closest]).toEqual([
      false,
      null,
      false,
      null,
    ])
  })

  it('lands a note sung 30 cents flat at Singer, and keeps its cents', () => {
    // Arrange
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.65),
      sing(E4, 0.65, -30),
      rest(2),
    )

    // Act
    const { state } = play(frames, phraseOf([C4, E4], 0.65), ECHO_LEVELS.singer)

    // Assert
    const second = state.outcomes[1]
    expect(second.landed).toBe(true)
    expect(second.landed ? second.cents : 0).toBeCloseTo(-30, 6)
  })

  it.each(['learning', 'singer', 'professional'] as const)(
    'never lands a voice sliding through the note at %s',
    (level) => {
      // Arrange: 2.5 semitones under E4 to 2.5 over in 0.5 s, 1000 c/s.
      const frames = sequence(
        rest(0.3),
        slide(E4 - 2.5, E4 + 2.5, 0.5),
        rest(2),
      )

      // Act
      const { state } = play(frames, phraseOf([E4], 0.9), ECHO_LEVELS[level])

      // Assert: no landing and no steady note; the silence after it ends
      // the echo 1.4 s after the slide's last frame.
      const missed = asMissed(state.outcomes[0])
      expect(state.outcomes).toHaveLength(1)
      expect(
        missed === null
          ? null
          : { ...missed, missedAt: micro(missed.missedAt) },
      ).toEqual({
        index: 0,
        landed: false,
        missedAt: micro(0.3 + 29 / 60 + 1.4),
        cause: 'silence',
        voiced: true,
        closest: null,
      })
    },
  )

  it('names the steady note nearest the one it missed', () => {
    // Arrange: Learning, C E G. After C lands the singer sings D, then F,
    // both steady, then stops. F is a semitone from E; D is a tone.
    const frames = sequence(
      rest(0.3),
      sing(C4, 0.9),
      sing(D4, 0.6),
      sing(F4, 0.6),
      rest(3),
    )

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4, G4], 0.9),
      ECHO_LEVELS.learning,
    )

    // Assert: the silence ends it (2.3833 + 1.4) before E's deadline.
    const e = asMissed(state.outcomes[1])
    expect(e?.cause).toBe('silence')
    expect(e?.closest?.midi).toBe(F4)
    expect(e?.closest?.cents).toBeCloseTo(100, 6)
  })
})

describe('tickSequence, the octave fold', () => {
  it.each([
    ['learning', [true, true, true]],
    ['singer', [false, false, false]],
    ['professional', [false, false, false]],
  ] as const)('lands an echo an octave down at %s: %j', (level, landed) => {
    // Arrange
    const preset = ECHO_LEVELS[level]
    const notes = [C4, E4, G4]
    const frames = sequence(
      rest(0.3),
      ...notes.map((midi) => sing(midi - 12, preset.noteSeconds)),
      rest(3),
    )

    // Act
    const { state } = play(frames, phraseOf(notes, preset.noteSeconds), preset)

    // Assert: at Singer and Pro the first note names the nearest note the
    // voice sat on, in the octave it was sung: G3, five semitones under C4.
    expect(state.outcomes.map((o) => o.landed)).toEqual(landed)
    const first = asMissed(state.outcomes[0])
    expect(first === null ? null : first.closest).toEqual(
      level === 'learning'
        ? null
        : { midi: G4 - 12, cents: expect.closeTo(-500, 6) },
    )
  })

  it('reads a folded landing at Learning as on the note', () => {
    // Arrange
    const frames = sequence(rest(0.3), sing(C3, 0.9), rest(2))

    // Act
    const { state } = play(frames, phraseOf([C4], 0.9), ECHO_LEVELS.learning)

    // Assert: the same frames as a C4 sung in tune.
    expect(landings(state.outcomes)).toEqual([micro(0.3 + 17 / 60)])
    expect(
      state.outcomes[0].landed ? state.outcomes[0].cents : 999,
    ).toBeCloseTo(0, 6)
  })
})

describe('tickSequence, the response gate', () => {
  it('ignores singing over the call, and ends by its deadlines when the response never starts', () => {
    // Arrange: the response starts at 2.0; the singer sings C4 over the
    // call (1.0 to 1.9 s) and then nothing.
    const frames = sequence(rest(1), sing(C4, 0.9), rest(13))

    // Act
    const { state, log } = play(
      frames,
      phraseOf([C4, E4, G4], 0.9),
      ECHO_LEVELS.learning,
      2,
    )

    // Assert: nothing before the gate, and each note misses on its own
    // deadline, 4 s after the one before.
    expect(log.map(({ t, event }) => [micro(t), event.type])).toEqual([
      [micro(6), 'miss'],
      [micro(10), 'miss'],
      [micro(14), 'miss'],
      [micro(14), 'phraseEnd'],
    ])
    expect(
      state.outcomes.map((o) =>
        o.landed ? null : [o.cause, o.voiced, o.closest],
      ),
    ).toEqual([
      ['deadline', false, null],
      ['deadline', false, null],
      ['deadline', false, null],
    ])
  })

  it('lands a note begun over the call only on what was sung after the gate', () => {
    // Arrange: C4 from 1.0 s, held through the gate at 2.0 to 2.6 s.
    const frames = sequence(rest(1), sing(C4, 1.6), rest(3))

    // Act
    const { state } = play(
      frames,
      phraseOf([C4, E4], 0.9),
      ECHO_LEVELS.learning,
      2,
    )

    // Assert: the first frame after the gate starts the count, and its
    // own tick adds nothing, so it lands 18 frames later.
    expect(onsets(state.outcomes)).toEqual([micro(2), null])
    expect(landings(state.outcomes)).toEqual([micro(2 + 18 / 60), null])
  })
})

describe('tickSequence, a silent response', () => {
  it.each(['learning', 'singer', 'professional'] as const)(
    'misses every note at %s on deadlines one after another',
    (level) => {
      // Arrange
      const preset = ECHO_LEVELS[level]
      const notes = [C4, D4, E4, F4, G4].slice(0, preset.notesPerPhrase)
      const deadline =
        preset.timing.mode === 'free' ? preset.timing.deadlineMs / 1000 : 0

      // Act
      const { state } = play(silence(14), phraseOf(notes, 0.5), preset)

      // Assert
      expect(
        state.outcomes.map((o) => (o.landed ? null : micro(o.missedAt))),
      ).toEqual(notes.map((_, i) => micro((i + 1) * deadline)))
      expect(state.ended).toBe(true)
    },
  )
})
