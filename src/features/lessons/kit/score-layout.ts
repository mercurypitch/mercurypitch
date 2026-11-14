// ============================================================
// Score layout — a song on two staffs: where its systems, staffs and bars fall
// ============================================================
//
// Pure: the scene the score drawing takes (kit/score-draw.ts), and where it
// puts each system, staff and bar in the figure's own pixels (Lesson 28
// WEB-SPEC, Look and Toys 2). Season 2's grand staff with a song written on
// it: each part on a staff of its own in its own clef, the treble above
// the bass, the key's signs after each clef, 4/4 on the first system only,
// and the bars wrapped into systems by width: as many to a system as its
// room holds with no note closer to the next than its value allows, shared
// out evenly, so eight bars on a phone are two systems of four. A system's
// staffs share one time axis, every beat as wide as the next, so the notes
// the parts sound together stand one above the other, and each staff of a
// system is a row the rhythm engraving writes (kit/rhythm-engrave.ts). The
// staff's space is the largest from 5 to 10 px that fits every system in
// the figure's height, and the systems sit centred in it. The marks' words
// keep a size of their own, never under 8.5 px a unit, and a scene keeps
// a row for a kind of mark only where it can carry one.

import type { Spelled } from './notes'
import type { RhythmRow, RowLayout } from './rhythm-layout'
import { SIDE } from './rhythm-layout'
import type { Bar, NoteValue } from './rhythm-model'
import { FOUR_FOUR } from './rhythm-model'
import type { KeySig } from './staff-key'
import type { Clef } from './staff-places'

/** One note of a part: its pitch and its written value, a quarter 1, a half 2 and a whole 4. */
export interface ScoreNote {
  readonly note: Spelled
  readonly value: NoteValue
}

/** Who a staff's notes belong to, which sets the colour they light in. */
export type ScoreTone = 'tavi' | 'merc' | 'learner' | 'other'

/** One staff's part: its clef, its bars of 4/4, each its notes in order, and whose it is. */
export interface ScoreStaff {
  readonly clef: Clef
  readonly bars: readonly (readonly ScoreNote[])[]
  readonly tone: ScoreTone
  /** Its name, for the tap that plays it alone: "Tavi's part". */
  readonly label: string
}

/** A tag in its box over a bar: a phrase's cadence. Bars count from 0, the scene's first. */
export interface ScoreTag {
  readonly bar: number
  readonly text: string
}

/** A numeral in ink under the bottom staff, at its bar's first note. */
export interface ScoreNumeral {
  readonly bar: number
  readonly text: string
}

/** A word under one staff's note, as "A-" and "men" under the Amen's two notes. Notes count from 0 across the staff. */
export interface ScoreWord {
  readonly staff: number
  readonly note: number
  readonly text: string
}

/** A note by its staff and its place in that staff's notes. */
export interface ScoreNoteRef {
  readonly staff: number
  readonly note: number
}

/** What is written over and under the staffs (Lesson 28 WEB-SPEC, Look). */
export interface ScoreMarks {
  readonly tags?: readonly ScoreTag[]
  readonly numerals?: readonly ScoreNumeral[]
  readonly words?: readonly ScoreWord[]
  /** The bars a breath follows: a comma over each staff at the bar's end. */
  readonly breaths?: readonly number[]
  /** Do on each staff, in order: the house sits under the first note on it. */
  readonly home?: readonly (Spelled | null)[]
  /** Notes ringed, as bar 8's in Merc's part after the cold open's reveal. */
  readonly rings?: readonly ScoreNoteRef[]
}

export interface ScoreScene {
  readonly key: KeySig
  /** The staffs, top to bottom; every one has the same number of bars. */
  readonly staffs: readonly ScoreStaff[]
  /** The first bar's number, 1 by default: Step 2's staffs start at bar 7. */
  readonly first?: number
  readonly marks?: ScoreMarks
}

/** One system: its bars, from `from` up to but not including `to`, and a row for each staff. */
export interface SystemLayout {
  readonly from: number
  readonly to: number
  /** Each staff's row, its beats counted from the system's first bar. */
  readonly rows: readonly RowLayout[]
  /** The top staff's top line and the bottom staff's bottom line. */
  readonly top: number
  readonly bottom: number
  /** The tags' box: its top and its height. */
  readonly tagTop: number
  readonly tagH: number
  /** The bar numbers' baseline, over the top staff. */
  readonly numberY: number
  /** The numerals' baseline, under the bottom staff. */
  readonly numeralY: number
  /** It writes the 4/4: the first system only. */
  readonly metre: boolean
}

export interface ScoreLayout {
  readonly w: number
  readonly h: number
  readonly space: number
  /** The marks' unit, px: the space, never under MARK_LEAST. */
  readonly mark: number
  /** How far in from the figure's left each system is drawn, px, for the brace before its staffs. */
  readonly inset: number
  readonly systems: readonly SystemLayout[]
}

/** A staff's note in time: its bar, its beat from the scene's start, its length in beats and its place in the staff's notes. */
export interface TimedNote extends ScoreNote {
  readonly bar: number
  readonly beat: number
  readonly beats: number
  readonly index: number
}

/** The beats in a bar: every score is in 4/4. */
export const BAR = 4

/** The smallest a mark's unit gets, px: its words stay readable on a phone's smallest staff. */
export const MARK_LEAST = 8.5

/** The marks' unit at staff space `s`: the space, never under MARK_LEAST. */
export const markUnit = (s: number): number => Math.max(s, MARK_LEAST)

/** Which rows of marks a scene keeps room for, from the marks it can carry: a tag row over the staffs, a word row under them, a numeral row under the bottom one. A row is kept for marks that may still come (an empty list), so a tag that fades in moves nothing. */
export interface MarkRows {
  readonly tags: boolean
  readonly words: boolean
  readonly numerals: boolean
}

export const markRows = (scene: ScoreScene): MarkRows => ({
  tags: scene.marks?.tags !== undefined,
  words: scene.marks?.words !== undefined,
  numerals: scene.marks?.numerals !== undefined,
})

/** A system's parts, px, at space `s`: over the top staff, a staff, between two staffs, under the bottom one, and between two systems. Stems and breaths take spaces; the marks' rows take the marks' unit. */
export interface SystemParts {
  readonly above: number
  readonly staff: number
  readonly between: number
  readonly below: number
  readonly gap: number
}

export function systemParts(rows: MarkRows, s: number): SystemParts {
  const m = markUnit(s)
  return {
    // the stems and the breaths over the top line, the bar numbers, then the tags
    above: 1.4 * s + 1.8 * m + (rows.tags ? 2.8 * m : 0),
    staff: 4 * s,
    // a top staff's stems under it, the next one's breaths over it, and the words
    between: 3.4 * s + (rows.words ? 1.9 * m : 0),
    // the bottom staff's stems, and the numerals
    below: 1.6 * s + (rows.numerals ? 2.3 * m : 0.4 * s),
    gap: 1.4 * m,
  }
}

/** A system's height, px, for `staffs` staffs. */
export const systemHeight = (staffs: number, p: SystemParts): number =>
  p.above + staffs * p.staff + Math.max(0, staffs - 1) * p.between + p.below

/** Spaces at a system's left: the brace's, then from the staff's start the clef's, each key sign's, the 4/4's, and the room before the first note's beat. */
const LEFT = { brace: 1.4, clef: 3.6, sign: 1.23, metre: 2.7, lead: 0.8 }

/** The fewest spaces each note value needs to its next: a whole, a half, a quarter, an eighth, a sixteenth. */
const NOTE_ROOM: Readonly<Record<NoteValue, number>> = {
  4: 3.2,
  2: 2.9,
  1: 2.4,
  0.5: 1.6,
  0.25: 1.4,
}

/** The staff's space, px: the largest that fits, down to the smallest. */
const SPACE = { most: 10, least: 5, step: 0.25 }

/** Each note of a staff in time, from the scene's first beat. */
export function timedNotes(staff: ScoreStaff): TimedNote[] {
  const out: TimedNote[] = []
  staff.bars.forEach((bar, b) => {
    let beat = b * BAR
    for (const n of bar) {
      out.push({ ...n, bar: b, beat, beats: n.value, index: out.length })
      beat += n.value
    }
  })
  return out
}

/** The bars a scene has: its first staff's. */
export const barsOf = (scene: ScoreScene): number =>
  scene.staffs[0]?.bars.length ?? 0

/** Spaces a beat needs, from the shortest value any staff writes. */
function beatRoom(scene: ScoreScene): number {
  let most = NOTE_ROOM[4] / 4
  for (const staff of scene.staffs)
    for (const bar of staff.bars)
      for (const n of bar) most = Math.max(most, NOTE_ROOM[n.value] / n.value)
  return most
}

/** Spaces from a staff's start to its first beat: the clef, the key's signs and the 4/4 where written. */
export function leftSpaces(key: KeySig, metre: boolean): number {
  return (
    LEFT.clef +
    key.count * LEFT.sign +
    (metre ? LEFT.metre : 0) +
    (metre ? 0 : LEFT.lead)
  )
}

/** Where each key sign's left edge falls, in spaces from the staff's start. */
export const signSpaces = (i: number): number => LEFT.clef + i * LEFT.sign

/** How the bars split into systems at `space`: each system's first bar, then the end. */
function breaks(w: number, scene: ScoreScene, space: number): number[] {
  const n = barsOf(scene)
  const inset = LEFT.brace * space
  const room = w - inset - 2 * SIDE - leftSpaces(scene.key, true) * space
  const bar = BAR * beatRoom(scene) * space
  const fit = Math.max(1, Math.floor(room / bar))
  const systems = Math.max(1, Math.ceil(n / fit))
  const per = Math.ceil(n / systems)
  const out: number[] = []
  for (let b = 0; b < n; b += per) out.push(b)
  out.push(n)
  return out
}

/** The height the scene takes at `space`, px. */
function heightAt(w: number, scene: ScoreScene, space: number): number {
  const systems = breaks(w, scene, space).length - 1
  const p = systemParts(markRows(scene), space)
  return (
    systems * systemHeight(scene.staffs.length, p) +
    Math.max(0, systems - 1) * p.gap
  )
}

/** The largest space from 10 down to 5 px at which the scene fits `h`. */
export function spaceFor(w: number, h: number, scene: ScoreScene): number {
  for (let s = SPACE.most; s > SPACE.least; s -= SPACE.step)
    if (heightAt(w, scene, s) <= h) return s
  return SPACE.least
}

/** A staff's row in a system: its bars' notes as the rhythm engraving takes them. */
export function rowOf(
  staff: ScoreStaff,
  from: number,
  to: number,
  bpm: number,
  continues: boolean,
): RhythmRow {
  const bars = staff.bars.slice(from, to)
  return {
    bars: bars.map(
      (bar): Bar => bar.map((n) => ({ kind: 'note', value: n.value })),
    ),
    bpm,
    notes: bars.flatMap((bar) => bar.map((n) => n.note)),
    continues,
  }
}

/** One staff's row in a system's pixels, its middle line at `y`. */
function staffRow(
  x0: number,
  x1: number,
  beats: number,
  y: number,
  space: number,
): RowLayout {
  const bottom = y + 2 * space
  return {
    x0,
    x1,
    beats,
    metre: FOUR_FOUR,
    bar: BAR,
    beat: 1,
    padEvery: 1,
    y,
    space,
    top: y - 2 * space,
    bottom,
    numberY: bottom,
    countY: bottom,
    stripTop: bottom,
    stripH: 0,
    read2Y: bottom,
    arcY: bottom,
    arcH: 0,
  }
}

/** Lays the scene out in a figure `w` by `h`. */
export function layoutScore(
  w: number,
  h: number,
  scene: ScoreScene,
): ScoreLayout {
  const space = spaceFor(w, h, scene)
  const cuts = breaks(w, scene, space)
  const inset = LEFT.brace * space
  const p = systemParts(markRows(scene), space)
  const m = markUnit(space)
  const sysH = systemHeight(scene.staffs.length, p)
  const count = cuts.length - 1
  const total = count * sysH + Math.max(0, count - 1) * p.gap
  const offset = Math.max(0, (h - total) / 2)
  const x1 = w - inset - SIDE
  const systems = cuts.slice(0, -1).map((from, i): SystemLayout => {
    const to = cuts[i + 1]
    const metre = i === 0
    const y0 = offset + i * (sysH + p.gap)
    const top = y0 + p.above
    const x0 = SIDE + leftSpaces(scene.key, metre) * space
    const rows = scene.staffs.map((_s, k) =>
      staffRow(
        x0,
        x1,
        (to - from) * BAR,
        top + 2 * space + k * (p.staff + p.between),
        space,
      ),
    )
    const bottom = (rows[rows.length - 1]?.y ?? top) + 2 * space
    return {
      from,
      to,
      rows,
      top,
      bottom,
      tagTop: y0 + 0.2 * m,
      tagH: 2.2 * m,
      numberY: top - 1.4 * space - 0.3 * m,
      numeralY: bottom + 1.6 * space + 1.75 * m,
      metre,
    }
  })
  return { w, h, space, mark: m, inset, systems }
}

/** The system a bar is written in. */
export const systemOfBar = (L: ScoreLayout, bar: number): number =>
  Math.max(
    0,
    L.systems.findIndex((s) => bar >= s.from && bar < s.to),
  )

/** The system a beat from the scene's start falls in: the last one's end stays in it. */
export function systemOfBeat(L: ScoreLayout, beat: number): number {
  const bar = Math.floor(beat / BAR)
  const last = L.systems.length - 1
  if (last < 0) return 0
  if (bar >= (L.systems[last]?.to ?? 0)) return last
  return systemOfBar(L, bar)
}
