// ============================================================
// Tune line parts — a second line beside the tune, the key's lanes, the house and a held chord
// ============================================================
//
// What a shape may dress Lesson 6's tune line with beyond its own states
// (Lesson 26 WEB-SPEC, What the kit and the app still need, item 7): a key's
// rows lit as lanes; Lesson 4's house on do; the tune's own label and
// colour; a part, a second line of beads beside one of the tune's lines,
// one note against each of its notes, with its own label, drawn whole, as
// it sounds or one bead at a time, a bracket between the two at a note and
// a name inside a bead off the lanes; beads drawn hollow, a passing note's;
// and a chord held under the band, named on a bar at its foot, its lanes
// glowing. All of it is optional: a shape without it is Lesson 6's.
//
// A part whose notes change between two shapes (Step 2's switch) slides
// the beads that moved, and only those, to their new rows over SLIDE_SEC;
// under reduced motion they land at once. Words belong to the page: a
// part's label, its brackets' and its beads' names are drawn as given.

import type { TuneLayout } from './tune-line-layout'

/** A second line of beads beside one of the tune's lines: one note against each of its notes. */
export interface TunePart {
  /** The tune's line it sits beside, by index into the tune. */
  readonly line: number
  /** Each note's semitones above the tune's start, one against each of the line's notes. */
  readonly at: readonly number[]
  /** Its label, drawn by its first bead: "copy", "part", or a singer's name. */
  readonly label: string
  /** Its colour: chrome by default, or Merc's blue and Tavi's orange. */
  readonly color?: string
  /** How many of its beads show, from the first: a line that draws as it sounds. All by default. */
  readonly shown?: number
  /** Only this bead shows, with no line: the third in a pair walking up a scale. */
  readonly only?: number
  /** A name inside a bead (a note off the lanes, "C♯"), or null for none. */
  readonly names?: readonly (string | null)[]
  /** A bracket between the tune's note and this part's at a note, its label ("4", "a tenth"), or null for none. */
  readonly brackets?: readonly (string | null)[]
  /** Its beads drawn hollow, by note: passing notes. */
  readonly hollow?: readonly number[]
}

/** A chord held under a band: its name, on a bar at the band's foot, and its notes' pitch classes, whose lanes glow. */
export interface TuneChord {
  readonly name: string
  readonly pcs: readonly number[]
}

/** What a shape dresses the tune line with beyond Lesson 6's states. */
export interface TuneDress {
  /** The key's rows, by pitch class, drawn a step brighter: its lanes. */
  readonly lanes?: readonly number[]
  /** Lesson 4's house, at the left of this row (MIDI) in every band that holds it. */
  readonly house?: number
  /** The tune's own label, drawn by its first bead. */
  readonly label?: string
  /** The tune's colour: chrome by default, Merc's blue in a duet. */
  readonly color?: string
  /** The tune's beads drawn hollow, by global note index: passing notes. */
  readonly hollow?: readonly number[]
  /** Only this one of the shown line's beads, by global note index, with no line. */
  readonly only?: number
  /** A chord held under the band. */
  readonly chord?: TuneChord
  readonly parts?: readonly TunePart[]
}

/** A bead's light, as the painter takes it (tune-line-draw.ts). */
export interface PartLight {
  readonly amount: number
  readonly color: string
}

/** A part as a frame draws it. */
export interface PartScene {
  /** The band it is drawn on: its line's place among the shown lines. */
  readonly band: number
  /** Each note's pitch, fractional while a bead slides. */
  readonly pitches: readonly number[]
  readonly label: string
  readonly color: string
  /** The beads that show, in order. */
  readonly beads: readonly number[]
  /** Whether the beads that show are joined by a line. */
  readonly joined: boolean
  readonly names: readonly (string | null)[]
  readonly brackets: readonly (string | null)[]
  readonly hollow: ReadonlySet<number>
  readonly light: (i: number) => PartLight | null
}

/** The dress as a frame draws it. */
export interface DressScene {
  readonly lanes: ReadonlySet<number>
  readonly house: number | null
  readonly label: string | null
  readonly color: string
  readonly hollow: ReadonlySet<number>
  readonly only: number | null
  readonly chord: TuneChord | null
  readonly parts: readonly PartScene[]
}

/**
 * What the dress's painter reads of a frame. The line's own scene
 * (tune-line-draw.ts `TuneScene`) holds it all, so the line hands its
 * scene to the painter as it is.
 */
export interface DressFrame {
  /** Each shown line's pitches, note by note. */
  readonly lines: readonly (readonly number[])[]
  /** The global index of each shown line's first note. */
  readonly first: readonly number[]
  /** Each band's pitch window, low and high. */
  readonly windows: readonly (readonly [number, number])[]
  /** A bead of the tune's light while its note sounds, by global index. */
  readonly light: (g: number, overlay: boolean) => PartLight | null
  readonly dress: DressScene | null
}

/**
 * Paints what a shape's dress adds, around the line's own painting
 * (tune-line-parts-draw.ts `DRESS`). A line is given it only where a
 * shape of its own is dressed, so a page that dresses nothing loads none
 * of it; without it a dress draws nothing.
 */
export interface DressPainter {
  /** Under the beads: the key's lanes, a held chord's bar and the house. */
  readonly under: (
    ctx: CanvasRenderingContext2D,
    T: TuneLayout,
    s: DressFrame,
  ) => void
  /** The tune's own beads, dressed: in its colour, hollow, or one alone. */
  readonly beads: (
    ctx: CanvasRenderingContext2D,
    T: TuneLayout,
    s: DressFrame,
  ) => void
  /** Over the beads: the part, its brackets and the lines' labels. */
  readonly over: (
    ctx: CanvasRenderingContext2D,
    T: TuneLayout,
    s: DressFrame,
  ) => void
}

/** Seconds a part's moved beads take to slide to their new rows. */
export const SLIDE_SEC = 0.3

/** A pitch class, 0 to 11, of a MIDI note (any octave, negative too). */
export const pcOf = (midi: number): number =>
  ((Math.round(midi) % 12) + 12) % 12

/** The beads of a part that show: only one, the first `shown`, or all. */
export function shownBeads(p: TunePart): number[] {
  if (p.only !== undefined)
    return p.only >= 0 && p.only < p.at.length ? [p.only] : []
  const n = Math.max(0, Math.min(p.at.length, p.shown ?? p.at.length))
  return Array.from({ length: n }, (_, i) => i)
}

/** A slide in flight: each bead's pitch it left, and when it set out. */
export interface PartSlide {
  readonly from: readonly number[]
  readonly t0: number
}

/** Smooth in and out over 0 to 1. */
const ease = (x: number): number => x * x * (3 - 2 * x)

/**
 * Each bead's pitch `t` seconds into a slide from `from` to `to`; a bead
 * that does not move, or a slide over, sits on its row.
 */
export function slidePitches(
  from: readonly number[],
  to: readonly number[],
  t: number,
): number[] {
  const k = ease(Math.max(0, Math.min(1, t / SLIDE_SEC)))
  return to.map((p, i) => {
    const a = from[i] ?? p
    return a === p ? p : a + (p - a) * k
  })
}

/** Whether a part keeps its line and length between two shapes, so its moved beads slide rather than jump. */
export const samePart = (a: TunePart | undefined, b: TunePart): a is TunePart =>
  a !== undefined &&
  a.line === b.line &&
  a.at.length === b.at.length &&
  a.label === b.label

/** Room at the left of a dressed line for the house on do, px (tune-line-layout.ts `gutter`). */
export const HOUSE_GUTTER = 24
