// ============================================================
// Harmony's rules — each level's lines, its help and its timing
// ============================================================
//
// A run is HARMONY_LINES lines. In each, Merc sings a short line and the
// singer sings it a third above, the key's own third (a third below for
// some lines at Professional). The levels are the ones the owner approved
// with the room's mock-ups (2 Nov 2026, docs/plans/ear-rooms.md, Room 4):
//
//   Learning      three notes by step; Merc sings his line, then the
//                 harmony, before the singer's turn; 50 cents either way
//   Singer        four notes by step; Merc sings his line only, and the
//                 harmony's lamps show where to go; 35 cents
//   Professional  five notes with a leap, a third above and some below;
//                 the harmony's lamps stay unlit until sung; 25 cents
//
// Sung two ways (owner, 1 Nov 2026). Taking turns, on the speaker: Merc
// sings his line, then the singer sings the harmony on their own, heard by
// the sequence engine as Echo hears a phrase, in free time. Together, in
// headphones: Merc sings his line again while the singer sings, each
// harmony note heard in its time against his (timed mode), and nothing
// gated after his voice, since the headphones keep it out of the mic.

import type { SequencePreset } from '@/lib/sequence/sequence-engine'
import type { ExerciseLevel } from '@/stores/exercise-level'
import type { HarmonyWayId } from '@/stores/harmony-store'

/** Lines in a run. */
export const HARMONY_LINES = 6

/** How the singer sings: after Merc, or with him. */
export type HarmonyWay = HarmonyWayId

/** The breath between two of Merc's notes, s. */
export const MERC_GAP_SECONDS = 0.06
/** A call is scheduled this far ahead of now, s. */
export const SOUND_LEAD_SECONDS = 0.1
/** Merc's voice's tail through the speaker, past the end of his last note, s. */
export const VOICE_TAIL_SECONDS = 0.18
/** At Learning, the breath between his line and the harmony he sings, s. */
export const LINE_BREATH_SECONDS = 0.45
/** Together: the breath between his call and the line sung with him, s. */
export const TOGETHER_BREATH_SECONDS = 0.8
/** A line sung in harmony is cheered this long before the next, ms. */
export const BETWEEN_LINES_MS = 1900
/** After Merc sings a missed pair, this long before the next line, ms. */
export const AFTER_ANSWER_MS = 700

export interface HarmonyLevel extends SequencePreset {
  /** Notes in each line. */
  readonly notes: 3 | 4 | 5
  /** Each line has one leap (a third or a fourth) among its steps. */
  readonly withLeap: boolean
  /** Lines of a run sung a third below Merc's (the rest a third above). */
  readonly linesBelow: number
  /** Merc sings his note this long, s, in his call and with the singer. */
  readonly noteSeconds: number
  /** At Learning Merc sings the harmony too, after his line. */
  readonly mercSingsBoth: boolean
  /** The harmony's lamps show where to go before they are sung. */
  readonly showsHarmony: boolean
  /** "Hear Merc again": at any time in the singer's turn, once a line, never. */
  readonly hearAgain: 'anyTime' | 'oncePerLine' | 'never'
  /**
   * Together: each harmony note listens from `earlyMs` before Merc sings
   * his under it to `lateMs` after it ends, long enough for headphones
   * that run late (Bluetooth adds a fifth of a second or so).
   */
  readonly together: {
    readonly earlyMs: number
    readonly lateMs: number
  }
}

/** Echo's silence rule: this long without the voice, once started, ends it. */
const END_SILENCE_MS = 1400

/** Each level's lines and how strictly it hears the harmony. */
export const HARMONY_LEVELS: Readonly<Record<ExerciseLevel, HarmonyLevel>> = {
  learning: {
    notes: 3,
    withLeap: false,
    linesBelow: 0,
    noteSeconds: 1,
    mercSingsBoth: true,
    showsHarmony: true,
    hearAgain: 'anyTime',
    tolCents: 50,
    landMs: 300,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 4000, endSilenceMs: END_SILENCE_MS },
    together: { earlyMs: 150, lateMs: 450 },
  },
  singer: {
    notes: 4,
    withLeap: false,
    linesBelow: 0,
    noteSeconds: 0.85,
    mercSingsBoth: false,
    showsHarmony: true,
    hearAgain: 'oncePerLine',
    tolCents: 35,
    landMs: 250,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 3000, endSilenceMs: END_SILENCE_MS },
    together: { earlyMs: 150, lateMs: 400 },
  },
  professional: {
    notes: 5,
    withLeap: true,
    linesBelow: 2,
    noteSeconds: 0.7,
    mercSingsBoth: false,
    showsHarmony: false,
    hearAgain: 'never',
    tolCents: 25,
    landMs: 200,
    octaveFold: false,
    timing: { mode: 'free', deadlineMs: 2500, endSilenceMs: END_SILENCE_MS },
    together: { earlyMs: 120, lateMs: 350 },
  },
}

/**
 * The level's rules for a line sung together: its notes heard on Merc's
 * clock, each in its window, instead of in free time.
 */
export function togetherRules(level: HarmonyLevel): HarmonyLevel {
  return {
    ...level,
    timing: {
      mode: 'timed',
      earlyMs: level.together.earlyMs,
      lateMs: level.together.lateMs,
    },
  }
}

/** The task as the lamp under the chip names it. */
export function taskName(below: boolean): string {
  return below ? 'A third below' : 'A third above'
}
