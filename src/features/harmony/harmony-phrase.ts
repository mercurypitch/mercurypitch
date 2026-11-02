// ============================================================
// A line as Merc sings it and the engine hears it, and its outcome
// ============================================================
//
// Merc's call is his line, his notes back to back; at Learning the
// harmony follows it after a breath, so the singer hears both first. The
// harmony is a phrase to the sequence engine (src/lib/sequence): taking
// turns, it is heard in free time, as Echo hears a phrase; together, each
// note is heard in its time on Merc's clock, its notes timed as his are.
// lineOutcome reads a line's outcome off the engine once every note of it
// is decided.

import type { Phrase, PhraseNote, SequenceState, } from '@/lib/sequence/sequence-engine'
import type { HarmonyLine } from './harmony-line'
import type { LineOutcome } from './harmony-machine'
import type { HarmonyLevel } from './harmony-rules'
import { LINE_BREATH_SECONDS, MERC_GAP_SECONDS } from './harmony-rules'

/** Notes sung back to back at the level's pace, from `from` s. */
function sungNotes(
  notes: readonly number[],
  level: HarmonyLevel,
  from = 0,
): PhraseNote[] {
  const step = level.noteSeconds + MERC_GAP_SECONDS
  return notes.map((midi, i) => ({
    midi,
    at: from + i * step,
    seconds: level.noteSeconds,
  }))
}

/** Where a sung run of `count` notes ends, s from its start. */
export function sungSeconds(count: number, level: HarmonyLevel): number {
  return count * level.noteSeconds + (count - 1) * MERC_GAP_SECONDS
}

/** Merc's line, as he sings it in his call and with the singer. */
export function mercLine(line: HarmonyLine, level: HarmonyLevel): PhraseNote[] {
  return sungNotes(line.merc, level)
}

/** The harmony, sung back to back as Merc sings his line. */
export function harmonyLine(
  line: HarmonyLine,
  level: HarmonyLevel,
  from = 0,
): PhraseNote[] {
  return sungNotes(line.harmony, level, from)
}

/**
 * Merc's call: his line, and at Learning the harmony after a breath.
 * Returns the notes and how many of them are his.
 */
export function mercCall(
  line: HarmonyLine,
  level: HarmonyLevel,
): { readonly notes: PhraseNote[]; readonly his: number } {
  const his = mercLine(line, level)
  if (!level.mercSingsBoth) return { notes: his, his: his.length }
  const after = sungSeconds(his.length, level) + LINE_BREATH_SECONDS
  return {
    notes: [...his, ...harmonyLine(line, level, after)],
    his: his.length,
  }
}

/** The harmony as the engine hears it: timed as Merc sings his line. */
export function harmonyPhrase(line: HarmonyLine, level: HarmonyLevel): Phrase {
  return { notes: harmonyLine(line, level) }
}

/** What the turn knew besides the engine. */
export interface TurnHeard {
  /** Any voice in the turn, before the engine listened included. */
  readonly voiced: boolean
  /** Merc was heard again in the turn. */
  readonly heardAgain: boolean
}

/**
 * The line's outcome from the engine, once every note of the harmony is
 * decided; null before. A miss falls short when the voice's steady note
 * nearest it sat toward Merc's line: under a harmony above him, over one
 * below him.
 */
export function lineOutcome(
  engine: SequenceState,
  line: HarmonyLine,
  heard: TurnHeard,
): LineOutcome | null {
  if (engine.outcomes.length < line.harmony.length) return null
  const notes = engine.outcomes.map((outcome) => outcome.landed)
  const missIndex = notes.indexOf(false)
  const firstMiss = missIndex < 0 ? null : missIndex
  const missed = firstMiss === null ? null : engine.outcomes[firstMiss]
  const closest =
    missed === null || missed === undefined || missed.landed
      ? null
      : missed.closest
  return {
    line,
    notes,
    inHarmony: firstMiss === null,
    firstMiss,
    short:
      closest === null
        ? null
        : line.below
          ? closest.cents > 0
          : closest.cents < 0,
    voiced: heard.voiced || engine.outcomes.some((o) => o.landed || o.voiced),
    heardAgain: heard.heardAgain,
  }
}

/** After a miss, how long Merc sings each note of the pair, s. */
export const PAIR_NOTE_SECONDS = 0.9
/** The breath between his note and the third from it, s. */
export const PAIR_GAP_SECONDS = 0.15

/** After a miss: Merc's note, then the harmony's third from it. */
export function missedPair(line: HarmonyLine, index: number): PhraseNote[] {
  return [
    { midi: line.merc[index], at: 0, seconds: PAIR_NOTE_SECONDS },
    {
      midi: line.harmony[index],
      at: PAIR_NOTE_SECONDS + PAIR_GAP_SECONDS,
      seconds: PAIR_NOTE_SECONDS,
    },
  ]
}

/** Notes moved later by `seconds`, to follow what was sung before them. */
export function after(
  notes: readonly PhraseNote[],
  seconds: number,
): PhraseNote[] {
  return notes.map((note) => ({ ...note, at: note.at + seconds }))
}
