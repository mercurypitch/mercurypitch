// ============================================================
// A leap as the sequence engine hears it, and its outcome read back
// ============================================================
//
// Each leap is a two-note phrase to the engine (src/lib/sequence): Merc's
// note, then the target, in free time. Merc sings the first alone, or both
// at Learning and after a miss (mercNotes). The leap lands when the target
// does; a voice that went straight to the target lands it too, the note it
// skipped missed. leapOutcome reads a round's outcome off the engine once
// the target is decided.

import type { Phrase, PhraseNote, SequenceState, } from '@/lib/sequence/sequence-engine'
import type { RoundOutcome } from './leap-machine'
import type { LeapRound } from './leap-round'
import { MERC_GAP_SECONDS, MERC_NOTE_SECONDS } from './leap-rules'

/** Merc's notes for a round: his own, and the target after it if asked. */
export function mercNotes(round: LeapRound, both: boolean): PhraseNote[] {
  const first = { midi: round.from, at: 0, seconds: MERC_NOTE_SECONDS }
  if (!both) return [first]
  return [
    first,
    {
      midi: round.to,
      at: MERC_NOTE_SECONDS + MERC_GAP_SECONDS,
      seconds: MERC_NOTE_SECONDS,
    },
  ]
}

/** The two notes the singer sings, as the engine hears them. */
export function leapPhrase(round: LeapRound): Phrase {
  return { notes: mercNotes(round, true) }
}

/** What the turn knew besides the engine. */
export interface TurnHeard {
  /** Any voice in the turn, before the engine listened included. */
  readonly voiced: boolean
  /** Merc was heard again in the turn. */
  readonly heardAgain: boolean
}

/**
 * The leap's outcome from the engine, once its target has landed or
 * missed; null before. The time is from the voice landing Merc's note, or
 * from the turn's start when it went straight to the target. A miss falls
 * short when the voice's steady note nearest the target sat under it on a
 * leap up, or over it on a leap down.
 */
export function leapOutcome(
  engine: SequenceState,
  round: LeapRound,
  heard: TurnHeard,
): RoundOutcome | null {
  const target = engine.outcomes[1]
  if (target === undefined) return null
  const first = engine.outcomes[0]
  const matched = first?.landed === true
  if (target.landed) {
    const from =
      first !== undefined && first.landed
        ? first.landedAt
        : engine.responseStart
    return {
      round,
      landed: true,
      cents: target.cents,
      seconds: Math.max(0, target.onset - from),
      matched,
      voiced: true,
      short: null,
      heardAgain: heard.heardAgain,
    }
  }
  const closest = target.closest
  return {
    round,
    landed: false,
    cents: null,
    seconds: null,
    matched,
    voiced: heard.voiced || target.voiced,
    short:
      closest === null
        ? null
        : round.kind.up
          ? closest.cents < 0
          : closest.cents > 0,
    heardAgain: heard.heardAgain,
  }
}
