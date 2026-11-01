import { describe, expect, it } from 'vitest'
import type { NoteOutcome, SequenceState } from '@/lib/sequence/sequence-engine'
import { leapOutcome, leapPhrase, mercNotes } from './leap-phrase'
import type { LeapRound } from './leap-round'
import { MERC_GAP_SECONDS, MERC_NOTE_SECONDS } from './leap-rules'

const UP_A_FIFTH: LeapRound = {
  index: 0,
  kind: { size: 7, up: true },
  from: 55,
  to: 62,
}
const DOWN_A_FOURTH: LeapRound = {
  index: 1,
  kind: { size: 5, up: false },
  from: 60,
  to: 55,
}

function landed(index: number, landedAt: number, onset: number): NoteOutcome {
  return { index, landed: true, cents: -6, onset, landedAt, timeToLandMs: 400 }
}

function missed(
  index: number,
  closest: number | null,
  voiced = true,
): NoteOutcome {
  return {
    index,
    landed: false,
    missedAt: 5,
    cause: 'deadline',
    voiced,
    closest: closest === null ? null : { midi: 62, cents: closest },
  } as NoteOutcome
}

function engine(...outcomes: NoteOutcome[]): SequenceState {
  return { responseStart: 1.2, outcomes } as unknown as SequenceState
}

const QUIET = { voiced: false, heardAgain: false }

describe('a leap as the engine hears it', () => {
  it("is Merc's note alone, or both notes with a breath between", () => {
    expect(mercNotes(UP_A_FIFTH, false)).toEqual([
      { midi: 55, at: 0, seconds: MERC_NOTE_SECONDS },
    ])
    expect(mercNotes(UP_A_FIFTH, true)).toEqual([
      { midi: 55, at: 0, seconds: MERC_NOTE_SECONDS },
      {
        midi: 62,
        at: MERC_NOTE_SECONDS + MERC_GAP_SECONDS,
        seconds: MERC_NOTE_SECONDS,
      },
    ])
    // The singer always sings both.
    expect(leapPhrase(UP_A_FIFTH).notes.map((note) => note.midi)).toEqual([
      55, 62,
    ])
  })

  it('has no outcome before the target is decided', () => {
    expect(leapOutcome(engine(), UP_A_FIFTH, QUIET)).toBeNull()
    expect(leapOutcome(engine(landed(0, 2, 1.9)), UP_A_FIFTH, QUIET)).toBeNull()
  })

  it("times a landing from the voice landing Merc's note", () => {
    const outcome = leapOutcome(
      engine(landed(0, 2.0, 1.8), landed(1, 3.1, 2.6)),
      UP_A_FIFTH,
      { voiced: true, heardAgain: true },
    )
    expect(outcome).toMatchObject({
      landed: true,
      cents: -6,
      matched: true,
      voiced: true,
      short: null,
      heardAgain: true,
    })
    expect(outcome?.seconds).toBeCloseTo(0.6)
  })

  it("times a voice that went straight to the target from the turn's start", () => {
    const outcome = leapOutcome(
      engine(missed(0, null), landed(1, 2.4, 2.0)),
      UP_A_FIFTH,
      QUIET,
    )
    expect(outcome).toMatchObject({ landed: true, matched: false })
    expect(outcome?.seconds).toBeCloseTo(0.8)
  })

  it('says a miss fell short of the target or went past it, whichever way the leap goes', () => {
    const miss = (round: LeapRound, cents: number | null) =>
      leapOutcome(engine(landed(0, 2, 1.8), missed(1, cents)), round, QUIET)
        ?.short
    expect(miss(UP_A_FIFTH, -80)).toBe(true)
    expect(miss(UP_A_FIFTH, 70)).toBe(false)
    expect(miss(DOWN_A_FOURTH, 70)).toBe(true)
    expect(miss(DOWN_A_FOURTH, -80)).toBe(false)
    expect(miss(UP_A_FIFTH, null)).toBeNull()
  })

  it('counts a voice heard anywhere in the turn for a miss', () => {
    const silent = engine(missed(0, null, false), missed(1, null, false))
    expect(leapOutcome(silent, UP_A_FIFTH, QUIET)?.voiced).toBe(false)
    expect(
      leapOutcome(silent, UP_A_FIFTH, { voiced: true, heardAgain: false })
        ?.voiced,
    ).toBe(true)
    expect(
      leapOutcome(
        engine(missed(0, null, false), missed(1, -40, true)),
        UP_A_FIFTH,
        QUIET,
      ),
    ).toMatchObject({ landed: false, voiced: true, cents: null, seconds: null })
  })
})
