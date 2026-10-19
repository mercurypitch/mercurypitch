// ============================================================
// The range ladder: rungs, pins and Merc's height on it (pure)
// ============================================================
//
// S7b beat 4 draws the range as a climb: a ladder of rungs, one a whole
// tone, that light as the voice dwells on them, and two pins, the lowest
// note and the highest, that lock when the range is measured. Merc climbs
// beside it at the height of the voice, and his `reach` squashes him low on
// it and stretches him tall high up (reachCents).
//
// The ladder starts two octaves tall, centred on the note the singer held
// on the first beat (A3 with none), and grows to keep the voice on it with
// a tone to spare. It never shrinks while it is up, so a rung the singer
// lit stays where they saw it light.

import { REACH_CENTS } from '@/lib/merc/constants'
import { midiToNoteNameOctave } from '@/lib/note-utils'

/** Semitones a rung stands for: a whole tone. */
export const RUNG_SEMITONES = 2
/** The ladder's least height: two octaves. */
export const LADDER_MIN_SPAN = 24
/** Its centre with no held note to go by: A3. */
export const LADDER_HOME = 57
/** Kept past the voice at either end, semitones. */
export const LADDER_MARGIN = 2

/** The ladder's span, MIDI: its lowest rung and its highest. */
export interface LadderSpan {
  readonly base: number
  readonly top: number
}

/** Everything the ladder draws, published by the range's controller. */
export interface LadderView {
  readonly span: LadderSpan
  /** The semitones the voice dwelt on (computeRange's qualifying ones). */
  readonly lit: readonly number[]
  /** The lowest and highest of them, null before any. */
  readonly low: number | null
  readonly high: number | null
  /**
   * The voice's last pitch, fractional MIDI: Merc's height. Before any
   * voice, the note held on the first beat; null with neither (Merc at the
   * foot).
   */
  readonly voice: number | null
  /** Measured: every rung between the pins lights, and the pins lock. */
  readonly locked: boolean
}

/** The ladder before any slide, around the held note. */
export function ladderAround(anchor: number | null): LadderSpan {
  const base = Math.round(anchor ?? LADDER_HOME) - LADDER_MIN_SPAN / 2
  return { base, top: base + LADDER_MIN_SPAN }
}

/** The empty ladder: nothing lit, no pins, Merc at the held note. */
export function emptyLadder(anchor: number | null): LadderView {
  return {
    span: ladderAround(anchor),
    lit: [],
    low: null,
    high: null,
    voice: anchor,
    locked: false,
  }
}

/**
 * The span grown to keep `low` and `high` on it, LADDER_MARGIN past each, in
 * whole rungs from its base. It only grows.
 */
export function growLadder(
  span: LadderSpan,
  low: number | null,
  high: number | null,
): LadderSpan {
  let base = span.base
  let top = span.top
  if (low !== null && low - LADDER_MARGIN < base) {
    // Down in whole rungs, so every rung keeps its note.
    const rungs = Math.ceil((base - (low - LADDER_MARGIN)) / RUNG_SEMITONES)
    base -= rungs * RUNG_SEMITONES
  }
  if (high !== null && high + LADDER_MARGIN > top) {
    const rungs = Math.ceil((high + LADDER_MARGIN - top) / RUNG_SEMITONES)
    top += rungs * RUNG_SEMITONES
  }
  return base === span.base && top === span.top ? span : { base, top }
}

/** Every rung, bottom to top, as the MIDI note it stands at. */
export function rungsOf(span: LadderSpan): number[] {
  const rungs: number[] = []
  for (let midi = span.base; midi <= span.top; midi += RUNG_SEMITONES) {
    rungs.push(midi)
  }
  return rungs
}

/** How far up the ladder a pitch is: 0 at its lowest rung, 1 at its top. */
export function heightOf(midi: number, span: LadderSpan): number {
  const tall = Math.max(1, span.top - span.base)
  return Math.min(1, Math.max(0, (midi - span.base) / tall))
}

/**
 * A pitch's height as Merc's `reach` reads it: cents from the ladder's
 * middle, -REACH_CENTS at its lowest rung and +REACH_CENTS at its top.
 */
export function reachCents(midi: number, span: LadderSpan): number {
  return (heightOf(midi, span) * 2 - 1) * REACH_CENTS
}

/**
 * Whether a rung is lit. A rung stands for its own semitone and the one
 * above it. Before the range locks, a rung lights when the voice dwelt on
 * either; once it locks, every rung between the pins lights.
 */
export function rungLit(rung: number, view: LadderView): boolean {
  if (view.locked && view.low !== null && view.high !== null) {
    return rung + 1 >= view.low && rung <= view.high
  }
  return view.lit.includes(rung) || view.lit.includes(rung + 1)
}

type Rgb = readonly [number, number, number]

const TEAL: Rgb = [45, 212, 191]
const BLUE: Rgb = [88, 166, 255]
const VIOLET: Rgb = [188, 140, 255]

/**
 * A lit rung's colour at its height: teal at the foot, through the house
 * blue, to violet at the top, as the first note's name and the pins.
 */
export function rungColour(height: number): string {
  const at = Math.min(1, Math.max(0, height))
  const low = at < 0.5
  const from = low ? TEAL : BLUE
  const to = low ? BLUE : VIOLET
  const k = low ? at * 2 : at * 2 - 1
  const mix = (i: number): number => Math.round(from[i] + (to[i] - from[i]) * k)
  return `rgb(${mix(0)}, ${mix(1)}, ${mix(2)})`
}

/** A pin's label: the note's name, "E2". */
export function pinName(midi: number): string {
  return midiToNoteNameOctave(midi)
}
