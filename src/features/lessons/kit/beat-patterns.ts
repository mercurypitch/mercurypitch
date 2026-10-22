// ============================================================
// Beat patterns — a drum pattern's lanes and cells, as bars and as words
// ============================================================
//
// The beat machine's model (Lesson 8 WEB-SPEC, Toys 1), pure so that every
// rule is unit-tested: a pattern is one bar, a row of cells for each lane
// (a sound), one cell a beat. A cell is off, on, or on and accented (a
// march's BOOM). A lane whose cell holds two hits a beat (the hi-hat's
// eighths) toggles both together. A pattern becomes a bar of hits for the
// beat clock, with or without the metronome's click under it, and a few
// words for a screen reader: the figure's summary, each cell's name and
// the live line after a change. Generic over its lanes, so a later rhythm
// lesson can draw its own patterns.

import type { DrumVoiceId } from '@/lib/drum-voices'
import type { Bar, Hit } from './beat-clock'

/** A lane of the grid: its sound, its level and its words. */
export interface Lane {
  readonly id: string
  /** Its label and the start of a cell's name: "Clap" makes "Clap on beat 2". */
  readonly name: string
  /** The words for one hit and for several, in a summary: "clap", "claps". */
  readonly one: string
  readonly many: string
  /** The app's drum voice it plays (src/lib/drum-voices.ts). */
  readonly voice: DrumVoiceId
  readonly level: number
  /** The level of an accented hit, where the lane has one. */
  readonly accent?: number
  /** Hits in a cell: 2 for a lane of eighths, toggled together. */
  readonly perBeat: 1 | 2
  /** Its hits on 2 and 4 of a bar of four are the backbeat, drawn in gold. */
  readonly backbeat?: boolean
}

/** A cell: off, on, or on and accented. */
export type Cell = 0 | 1 | 2

/** One bar of a pattern: its beats and each lane's cells, one a beat. */
export interface Pattern {
  readonly beats: number
  readonly cells: Readonly<Record<string, readonly Cell[]>>
}

/** The metronome's two clicks: the high one on beat 1, the plain one on the rest (FACTS 74). */
export const CLICK = {
  high: { hz: 1500, gain: 0.09 },
  plain: { hz: 1000, gain: 0.06 },
} as const

/** What a hit is: a click, or a lane's drum at its level. */
export type MachineHit =
  | { readonly kind: 'click'; readonly high: boolean }
  | {
      readonly kind: 'drum'
      readonly lane: string
      readonly voice: DrumVoiceId
      readonly level: number
      /** The cell it belongs to, from 0. */
      readonly cell: number
    }

/** How the click sounds under a bar: not at all, plain on every beat, or high on beat 1. */
export type ClickMode = 'none' | 'plain' | 'bars'

/** A bar of `beats` clicks. */
export function clickBar(beats: number, mode: ClickMode): Bar<MachineHit> {
  const hits: Hit<MachineHit>[] =
    mode === 'none'
      ? []
      : Array.from({ length: beats }, (_, beat) => ({
          beat,
          data: { kind: 'click', high: mode === 'bars' && beat === 0 },
        }))
  return { beats, hits }
}

/** A pattern as a bar of hits, the click under it as `mode` says; `scale` sets every drum's level (the sung line's half). */
export function patternBar(
  pattern: Pattern,
  lanes: readonly Lane[],
  mode: ClickMode = 'none',
  scale = 1,
): Bar<MachineHit> {
  const hits: Hit<MachineHit>[] = [...clickBar(pattern.beats, mode).hits]
  for (const lane of lanes) {
    const cells = pattern.cells[lane.id] ?? []
    cells.slice(0, pattern.beats).forEach((c, cell) => {
      if (c === 0) return
      const level = (c === 2 ? (lane.accent ?? lane.level) : lane.level) * scale
      for (let s = 0; s < lane.perBeat; s++)
        hits.push({
          beat: cell + s / lane.perBeat,
          data: { kind: 'drum', lane: lane.id, voice: lane.voice, level, cell },
        })
    })
  }
  hits.sort((a, b) => a.beat - b.beat)
  return { beats: pattern.beats, hits }
}

/**
 * The metronome arm's angle, degrees, `t` seconds after its first beat at
 * `bpm`: −24° × cos(π t / s), s one beat (the stats site's metronomeAngle),
 * so it reaches a side on every beat, left and right in turn, and crosses
 * the middle halfway between.
 */
export function metronomeAngle(t: number, bpm: number): number {
  return angleAtBeats((t * bpm) / 60)
}

/** The arm's angle `beats` beats after its first, counted on the run's own beats, so a change of tempo bends no swing. */
export function angleAtBeats(beats: number): number {
  const a = -24 * Math.cos(Math.PI * beats)
  // a tidy zero at the middle, never −0 or 1e-15
  return Math.abs(a) < 1e-9 ? 0 : a
}

/** The pattern with one cell toggled: off goes on, on or accented goes off. */
export function toggleCell(
  pattern: Pattern,
  lane: string,
  cell: number,
): Pattern {
  const row = [...(pattern.cells[lane] ?? [])]
  while (row.length < pattern.beats) row.push(0)
  row[cell] = row[cell] === 0 ? 1 : 0
  return { ...pattern, cells: { ...pattern.cells, [lane]: row } }
}

/** The pattern at `beats` a bar: cells kept from the first, new ones off. */
export function resizePattern(pattern: Pattern, beats: number): Pattern {
  const cells: Record<string, Cell[]> = {}
  for (const [id, row] of Object.entries(pattern.cells))
    cells[id] = Array.from({ length: beats }, (_, i) => row[i] ?? 0)
  return { beats, cells }
}

/** A pattern with every cell off. */
export function emptyPattern(lanes: readonly Lane[], beats: number): Pattern {
  const cells: Record<string, Cell[]> = {}
  for (const lane of lanes) cells[lane.id] = Array<Cell>(beats).fill(0)
  return { beats, cells }
}

/** Whether beat `i` (from 0) of a bar is a backbeat: 2 or 4 of a bar of four. */
export const isBackbeat = (beats: number, i: number): boolean =>
  beats === 4 && i % 2 === 1

/** Beat numbers as words: "1", "1 and 3", "1, 2 and 4". */
export function listBeats(nums: readonly number[]): string {
  if (nums.length <= 1) return nums.join('')
  return `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}

/** The beats, from 1, whose cell passes `test`. */
const beatsWhere = (row: readonly Cell[], test: (c: Cell) => boolean) =>
  row.flatMap((c, i) => (test(c) ? [i + 1] : []))

/** One lane in words: "kick on 1 and 3", "claps on 2 and 4", "hi-hat on every half beat", "no claps". */
export function describeLane(lane: Lane, pattern: Pattern): string {
  const row = (pattern.cells[lane.id] ?? []).slice(0, pattern.beats)
  const on = beatsWhere(row, (c) => c > 0)
  if (on.length === 0) return `no ${lane.many}`
  if (lane.perBeat === 2)
    return on.length === pattern.beats
      ? `${lane.one} on every half beat`
      : `${lane.one} on ${listBeats(on)}, both halves`
  const accented = beatsWhere(row, (c) => c === 2)
  const word = on.length === 1 ? lane.one : lane.many
  if (accented.length === on.length)
    return `accented ${word} on ${listBeats(on)}`
  const base = `${word} on ${listBeats(on)}`
  return accented.length === 0
    ? base
    : `${base}, accented on ${listBeats(accented)}`
}

/** The first letter in capitals, for a line that starts with a lane's words. */
export const capital = (s: string): string =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1)

/** The grid's summary: "Drum pattern, one bar: kick on 1 and 3, claps on 2 and 4, hi-hat on every half beat". */
export function describePattern(
  pattern: Pattern,
  lanes: readonly Lane[],
): string {
  const bar =
    pattern.beats === 4 ? 'one bar' : `one bar of ${pattern.beats} beats`
  return `Drum pattern, ${bar}: ${lanes.map((l) => describeLane(l, pattern)).join(', ')}`
}

/** A cell's name, its lane and beat: "Clap on beat 2", "Hi-hat on beat 2, both halves", "Kick on beat 1, accented". */
export function cellName(lane: Lane, cell: number, value: Cell): string {
  const base = `${lane.name} on beat ${cell + 1}`
  if (lane.perBeat === 2) return `${base}, both halves`
  return value === 2 ? `${base}, accented` : base
}
