// ============================================================
// Rhythm model — bars of written notes and rests, and what they sound
// ============================================================
//
// Pure (Lesson 17 WEB-SPEC, Toys 1, "The model"): a figure is one bar or
// more of written symbols, each a note or a rest of 4, 2, 1, 0.5 or 0.25
// beats with the quarter note on the beat, a dot adding half its value,
// and on a note a tie to the next note, across a bar line if need be. A
// bar adds up to its beats, four in 4/4; a figure may stop short on the
// next bar's first note, as the rest examples do.
//
// Lesson 19 writes past 4/4 (its WEB-SPEC, Toys 1; What the kit and the
// app still need, item 3). A metre is a time signature's two numbers, and
// the model's beat stays the quarter note: a bar of 3/4 or of 6/8 is three
// quarters long, one of 2/4 two. A metre's own beat is the quarter in
// 2/4, 3/4 and 4/4, and in compound metre, 6/8, the dotted quarter, three
// eighths, so 6/8 beams its eighths in threes and 3/4 in twos, each beat's
// notes under one beam (FACTS 15), and counts "1 and a 2 and a" where 3/4
// counts "1 and 2 and 3 and" (FACTS 22, 24). A triplet note is two thirds
// of its value, three eighths in the time of two, marked with a 3, as
// the Ear Lab writes one (`tuplet: 3`), so its beam takes the 3 and no
// bracket (FACTS 41); its count is "trip" and "let" after the beat's
// number (FACTS 40). From the model come:
//
// - the symbols in place, in the shape of the Ear Lab's notation
//   (`RhythmSymbol`, src/lib/ear/rhythm-notation.ts), so its beaming
//   applies to them unchanged (`beamGroups`), and a figure read from its
//   note starts is the Ear Lab's own reading (`readRhythm`), as the
//   checkpoint's bars are (FACTS 37). The Ear Lab reads each value from
//   the gap to the next start and writes no tie, so the model carries what
//   it lacks: a written rest where a note could have filled the gap (FACTS
//   44), a dot chosen by the learner, and the tie;
// - the sounds the beat clock books, a tied run as one sound (FACTS 28),
//   each held for its length less a short gap (FACTS 63);
// - the stopwatch strip's cells and readings (WEB-SPEC, Toys 6);
// - the counts, "1", "and", "e" and "a", the ones not said in brackets
//   (FACTS 20 to 22), by the metre.
//
// Halve and Join make bars of their own, a grid: a whole note, half notes
// on beats 1 and 3, or a beat of one quarter, two eighths or four
// sixteenths. Note · Rest makes a beat silent and keeps its notes for the
// way back, and a grid bar is written with its rests placed as 4/4 places
// them (FACTS 26a). Beats count from 0 in here: beat 0 is the page's beat 1.

import type { BeamGroup, RhythmSymbol } from '@/lib/ear/rhythm-notation'
import { beamGroups, readRhythm, WRITTEN_BAR } from '@/lib/ear/rhythm-notation'

/** A written value in beats, the quarter note on the beat: whole, half, quarter, eighth and sixteenth. */
export type NoteValue = 4 | 2 | 1 | 0.5 | 0.25

/** One written symbol: a note or a rest of a value, dotted or not; a note may be tied to the next. */
export interface Written {
  readonly kind: 'note' | 'rest'
  readonly value: NoteValue
  /** A dot after it, which adds half its value. */
  readonly dotted?: boolean
  /** On a note, a tie to the next note, so the two sound as one. */
  readonly tie?: boolean
  /** One of a triplet: two thirds of its value, three in the time of two. */
  readonly triplet?: boolean
}

/** A bar's symbols, in order. */
export type Bar = readonly Written[]

/** The beats in a bar of 4/4, the Ear Lab's written bar. */
export const BAR_BEATS = WRITTEN_BAR

const EPSILON = 1e-6

/** A time signature: its top number, and its bottom one, the note it counts. */
export interface Metre {
  readonly top: number
  readonly bottom: 4 | 8
}

export const FOUR_FOUR: Metre = { top: 4, bottom: 4 }
export const THREE_FOUR: Metre = { top: 3, bottom: 4 }
export const TWO_FOUR: Metre = { top: 2, bottom: 4 }
export const SIX_EIGHT: Metre = { top: 6, bottom: 8 }

/** Whether a metre is compound, each beat a dotted note split in three, as 6/8 is (FACTS 14). */
export const isCompound = (m: Metre): boolean =>
  m.bottom === 8 && m.top > 3 && m.top % 3 === 0

/** A bar's length in the model's beats, quarter notes: 4 in 4/4, 3 in 3/4 and in 6/8, 2 in 2/4. */
export const barQuarters = (m: Metre): number => (m.top * 4) / m.bottom

/** The metre's own beat, in quarter notes: a dotted quarter in compound metre, the bottom number's note otherwise (FACTS 13). */
export const beatQuarters = (m: Metre): number =>
  isCompound(m) ? 1.5 : 4 / m.bottom

/** How a metre is written: "6/8". */
export const metreText = (m: Metre): string => `${m.top}/${m.bottom}`

/** A symbol's length in beats, its dot and its triplet included. */
export const lengthOf = (w: Written): number =>
  (w.dotted === true ? w.value * 1.5 : w.value) *
  (w.triplet === true ? 2 / 3 : 1)

/** The beats a bar's symbols add up to. */
export const barLength = (bar: Bar): number =>
  bar.reduce((sum, w) => sum + lengthOf(w), 0)

/** Whether every bar fills its beats; with `endsShort`, the last may stop short, as a figure that ends on the next bar's first note does. */
export function fillsBars(
  bars: readonly Bar[],
  endsShort = false,
  beatsPerBar = BAR_BEATS,
): boolean {
  return bars.every((bar, i) => {
    const beats = barLength(bar)
    if (Math.abs(beats - beatsPerBar) < EPSILON) return true
    return (
      endsShort && i === bars.length - 1 && beats > 0 && beats < beatsPerBar
    )
  })
}

/** A written symbol in its place: the Ear Lab's symbol, with its bar and its tie. */
export interface PlacedSymbol extends RhythmSymbol {
  /** Its bar, from 0. */
  readonly bar: number
  /** A note tied to the next note. */
  readonly tie: boolean
}

const flagsOf = (value: number): number =>
  value === 0.5 ? 1 : value === 0.25 ? 2 : 0

/**
 * The figure's symbols in place, in beats from its start, a bar every
 * `beatsPerBar` beats, or each bar from its own first beat in `starts`
 * when given, so a short rhythm's groups can sit a pause apart. A note that
 * starts a sound carries its place among those notes as `onset`, as the
 * Ear Lab numbers its notes; a rest's, and a tied-to note's, is null,
 * since neither starts one.
 */
export function placeBars(
  bars: readonly Bar[],
  beatsPerBar = BAR_BEATS,
  starts?: readonly number[],
): PlacedSymbol[] {
  const placed: PlacedSymbol[] = []
  let onset = 0
  let tied = false
  bars.forEach((bar, b) => {
    let at = starts?.[b] ?? b * beatsPerBar
    for (const w of bar) {
      const note = w.kind === 'note'
      placed.push({
        kind: w.kind,
        beat: at,
        beats: lengthOf(w),
        value: w.value,
        dotted: w.dotted === true,
        tuplet: w.triplet === true ? 3 : null,
        flags: flagsOf(w.value),
        onset: note && !tied ? onset++ : null,
        bar: b,
        tie: note && w.tie === true,
      })
      tied = note && w.tie === true
      at += lengthOf(w)
    }
  })
  return placed
}

/** A figure read by the Ear Lab's notation from its note starts over `beats`, as the checkpoint's bars are (FACTS 37). */
export function fromStarts(
  starts: readonly number[],
  beats: number,
): PlacedSymbol[] {
  return readRhythm(starts, beats).map((s) => ({
    ...s,
    bar: Math.floor((s.beat + EPSILON) / WRITTEN_BAR),
    tie: false,
  }))
}

/**
 * The beams, by the metre's beat (FACTS 15): the Ear Lab's beaming, which
 * joins the flagged notes inside one quarter, read in the metre's own
 * beats, so 6/8's eighths join in threes and 3/4's in twos; 4/4's and
 * 2/4's are the Ear Lab's unchanged. A triplet's three eighths fill one
 * quarter, so they join under one beam that takes the 3 (FACTS 41).
 */
export function beamsOf(
  placed: readonly PlacedSymbol[],
  m: Metre = FOUR_FOUR,
): BeamGroup[] {
  const beat = beatQuarters(m)
  return beamGroups(placed.map((p) => ({ ...p, beat: p.beat / beat })))
}

/** A sound the figure makes: its start and length in beats, and the placed symbols it spans, one note or a tied run. */
export interface FigureSound {
  readonly at: number
  readonly beats: number
  readonly first: number
  readonly last: number
}

/** The notes as they sound, in order: each from its start for its written length, a tie joining notes into one sound. */
export function soundsOf(placed: readonly PlacedSymbol[]): FigureSound[] {
  const sounds: FigureSound[] = []
  placed.forEach((p, i) => {
    if (p.kind !== 'note') return
    const prev = sounds.at(-1)
    if (prev !== undefined && placed[i - 1].tie) {
      sounds[sounds.length - 1] = {
        ...prev,
        beats: prev.beats + p.beats,
        last: i,
      }
    } else sounds.push({ at: p.beat, beats: p.beats, first: i, last: i })
  })
  return sounds
}

/** The gap before a sound's end, s, so repeated notes on one pitch are heard apart (FACTS 63). */
export const GAP_S = 0.08

/** How long a sound is held, s: its length at the tempo less the gap, or less a quarter of its length when that is shorter. */
export function heldSeconds(beats: number, bpm: number): number {
  const length = (beats * 60) / bpm
  return length - Math.min(GAP_S, length / 4)
}

/** A length at a tempo as the stopwatch strip reads it: seconds to two decimals at most, trailing zeros dropped, "0.67 s". */
export function secondsText(beats: number, bpm: number): string {
  return `${Number(((beats * 60) / bpm).toFixed(2))} s`
}

/** One cell of the stopwatch strip: a sound, a tied run's across all its notes, or a rest. */
export interface StripCell {
  readonly kind: 'note' | 'rest'
  readonly at: number
  readonly beats: number
  /** The placed symbols it spans. */
  readonly first: number
  readonly last: number
}

/** The strip's cells, in order: one a sound and one a rest (WEB-SPEC, Toys 6). */
export function stripCells(placed: readonly PlacedSymbol[]): StripCell[] {
  const sounds = new Map(soundsOf(placed).map((s) => [s.first, s]))
  const cells: StripCell[] = []
  placed.forEach((p, i) => {
    const sound = sounds.get(i)
    if (p.kind === 'rest')
      cells.push({
        kind: 'rest',
        at: p.beat,
        beats: p.beats,
        first: i,
        last: i,
      })
    else if (sound !== undefined) cells.push({ kind: 'note', ...sound })
  })
  return cells
}

/** A run of two or more equal untied notes inside one beat, as cell indices, which reads once under its beat when its cells are too narrow. */
export interface StripRun {
  readonly from: number
  readonly to: number
  readonly count: number
  readonly beats: number
}

/** The strip's runs of equal untied notes, each inside one beat. */
export function stripRuns(cells: readonly StripCell[]): StripRun[] {
  const runs: StripRun[] = []
  let from = -1
  const close = (to: number): void => {
    if (from !== -1 && to > from)
      runs.push({ from, to, count: to - from + 1, beats: cells[from].beats })
    from = -1
  }
  cells.forEach((c, i) => {
    const short = c.kind === 'note' && c.first === c.last && c.beats < 1
    const joins =
      from !== -1 &&
      short &&
      c.beats === cells[from].beats &&
      Math.floor(c.at + EPSILON) === Math.floor(cells[from].at + EPSILON)
    if (joins) return
    close(i - 1)
    if (short) from = i
  })
  close(cells.length - 1)
  return runs
}

/** A run's one reading, "4 × 0.25 s". */
export const runText = (run: StripRun, bpm: number): string =>
  `${run.count} × ${secondsText(run.beats, bpm)}`

/** A count under the figure: where it falls, its word, and whether it is said or held in brackets. */
export interface FigureCount {
  readonly at: number
  readonly text: string
  readonly said: boolean
}

const PARTS = ['', 'e', 'and', 'a'] as const

/**
 * The word for a place in a bar: the beat's number on the metre's beat;
 * in simple metre "e", "and" and "a" on the sixteenth grid, and "trip"
 * and "let" on a triplet's thirds (FACTS 40); in compound metre "and"
 * and "a" on the beat's second and third eighths, "1 and a" (FACTS 22).
 */
function countWord(at: number, m: Metre): string {
  const bar = barQuarters(m)
  const unit = beatQuarters(m)
  const inBar = at - Math.floor((at + EPSILON) / bar) * bar
  const beat = Math.floor((inBar + EPSILON) / unit)
  const part = (inBar - beat * unit) / unit
  if (part < EPSILON) return String(beat + 1)
  if (isCompound(m)) return Math.round(part * 3) === 1 ? 'and' : 'a'
  const thirds = part * 3
  if (Math.abs(thirds - Math.round(thirds)) < 1e-4)
    return Math.round(thirds) === 1 ? 'trip' : 'let'
  return PARTS[Math.round(part * 4) % 4]
}

/**
 * The counts under the figure (FACTS 20 to 22): a note that starts a sound
 * says its word; any other symbol, a rest or a tied-to note, holds its word
 * in brackets, as does every one of the metre's beats a symbol holds over.
 * So a half note on beat 3 of 4/4 counts "3 (4)", and the checkpoint's bars
 * "1, 2, 3 (4), 1 and 2, 3 and 4"; a dotted half in 6/8 counts "1 (2)", and
 * one in 3/4 "1 (2) (3)" (Lesson 19 FACTS 28).
 */
export function countsOf(
  placed: readonly PlacedSymbol[],
  m: Metre = FOUR_FOUR,
): FigureCount[] {
  const counts: FigureCount[] = []
  const unit = beatQuarters(m)
  for (const p of placed) {
    const said = p.kind === 'note' && p.onset !== null
    const word = countWord(p.beat, m)
    counts.push({ at: p.beat, text: said ? word : `(${word})`, said })
    const end = p.beat + p.beats - EPSILON
    for (let k = Math.floor((p.beat + EPSILON) / unit) + 1; k * unit < end; k++)
      counts.push({
        at: k * unit,
        text: `(${countWord(k * unit, m)})`,
        said: false,
      })
  }
  return counts
}

/** A stretch of a grid bar: a whole note or a half note filling its beats, or one beat filled with notes of a value. */
export interface GridCell {
  /** Its first beat, 0 to 3. */
  readonly from: number
  readonly value: NoteValue
}

/** A bar Halve and Join can make, and the beats Note · Rest has made silent; a silent beat keeps its notes for the way back. */
export interface GridBar {
  readonly cells: readonly GridCell[]
  /** Beats 0 to 3, true where silent. */
  readonly silent: readonly boolean[]
}

/**
 * Why Halve or Join cannot go, for the page's hint (WEB-SPEC, Toys 1):
 * Halve on sixteenths; Join on a quarter whose pair beat holds anything
 * but a sounding quarter; Join on a half note when the other half holds
 * anything but a sounding half note; Join on a whole note; either on a
 * silent beat.
 */
export type GridRefusal = 'shortest' | 'pair' | 'halves' | 'whole' | 'silent'

/** What Halve or Join made, or why it could not. */
export type GridChange =
  | { readonly bar: GridBar }
  | { readonly refused: GridRefusal }

const spanOf = (c: GridCell): number => Math.max(c.value, 1)

const grid = (cells: readonly (readonly [number, NoteValue])[]): GridBar => ({
  cells: cells.map(([from, value]) => ({ from, value })),
  silent: [false, false, false, false],
})

/** Every beat's cell, its notes of one value. */
const everyBeat = (value: NoteValue): GridBar =>
  grid([0, 1, 2, 3].map((from) => [from, value] as const))

/** The bar Reset puts back: four quarter notes. */
export const FOUR_QUARTERS: GridBar = everyBeat(1)

/** Play the halvings' five bars (FACTS 66): a whole note, two halves, four quarters, eight eighths and sixteen sixteenths. */
export const HALVINGS: readonly GridBar[] = [
  grid([[0, 4]]),
  grid([
    [0, 2],
    [2, 2],
  ]),
  FOUR_QUARTERS,
  everyBeat(0.5),
  everyBeat(0.25),
]

/** The index of the cell that holds a beat. */
function cellAt(bar: GridBar, beat: number): number {
  return bar.cells.findIndex((c) => c.from <= beat && beat < c.from + spanOf(c))
}

const replaced = (
  bar: GridBar,
  at: number,
  count: number,
  cells: readonly GridCell[],
): GridBar => ({
  ...bar,
  cells: [...bar.cells.slice(0, at), ...cells, ...bar.cells.slice(at + count)],
})

/** Halve on a beat: every note in it split in two, so a quarter makes two eighths, and a half or a whole note splits into two of half its value. */
export function halve(bar: GridBar, beat: number): GridChange {
  if (bar.silent[beat]) return { refused: 'silent' }
  const i = cellAt(bar, beat)
  const c = bar.cells[i]
  if (c.value === 0.25) return { refused: 'shortest' }
  const value = (c.value / 2) as NoteValue
  const cells =
    c.value > 1
      ? [
          { from: c.from, value },
          { from: c.from + value, value },
        ]
      : [{ from: c.from, value }]
  return { bar: replaced(bar, i, 1, cells) }
}

/**
 * Join on a beat, undoing Halve: four sixteenths make two eighths and two
 * eighths a quarter; a quarter joins its pair beat's quarter, 1 with 2 and
 * 3 with 4, into a half note, and a half note the other half's into a
 * whole note.
 */
export function join(bar: GridBar, beat: number): GridChange {
  if (bar.silent[beat]) return { refused: 'silent' }
  const i = cellAt(bar, beat)
  const c = bar.cells[i]
  if (c.value === 4) return { refused: 'whole' }
  if (c.value < 1)
    return {
      bar: replaced(bar, i, 1, [
        { from: c.from, value: (c.value * 2) as NoteValue },
      ]),
    }
  const from = Math.floor(c.from / (c.value * 2)) * c.value * 2
  const other = from === c.from ? c.from + c.value : from
  const j = cellAt(bar, other)
  const o = bar.cells[j]
  if (o.from !== other || o.value !== c.value || bar.silent[other])
    return { refused: c.value === 1 ? 'pair' : 'halves' }
  return {
    bar: replaced(bar, Math.min(i, j), 2, [
      { from, value: (c.value * 2) as NoteValue },
    ]),
  }
}

/** Note · Rest on a beat: its note made silent, or sounding again; a beat inside a half or a whole note silences the whole note. */
export function toggleRest(bar: GridBar, beat: number): GridBar {
  const c = bar.cells[cellAt(bar, beat)]
  const silence = !bar.silent[c.from]
  return {
    ...bar,
    silent: bar.silent.map((s, b) =>
      b >= c.from && b < c.from + spanOf(c) ? silence : s,
    ),
  }
}

/** The rest a silent beat starts: a whole rest for a silent bar, a half rest from beat 1 or beat 3 when the beat after it is silent too, otherwise a quarter rest. */
function restFrom(bar: GridBar, beat: number): NoteValue {
  if (beat === 0 && bar.silent.every(Boolean)) return 4
  return beat % 2 === 0 && bar.silent[beat + 1] ? 2 : 1
}

/**
 * A grid bar as written: its sounding notes, and its silent beats as rests
 * placed as 4/4 places them (FACTS 26a). A silent beat is one quarter rest,
 * whatever it held; two silent beats make one half rest only from beat 1
 * or beat 3, so beats 2 and 3 never share one; a silent bar is one whole
 * rest.
 */
export function writeGrid(bar: GridBar): Bar {
  const out: Written[] = []
  let beat = 0
  while (beat < BAR_BEATS) {
    if (bar.silent[beat]) {
      const value = restFrom(bar, beat)
      out.push({ kind: 'rest', value })
      beat += value
    } else {
      const c = bar.cells[cellAt(bar, beat)]
      const notes = c.value < 1 ? 1 / c.value : 1
      for (let k = 0; k < notes; k++) out.push({ kind: 'note', value: c.value })
      beat += spanOf(c)
    }
  }
  return out
}
