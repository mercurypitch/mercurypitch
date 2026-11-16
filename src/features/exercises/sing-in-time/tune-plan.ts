// ============================================================
// Sing It in Time: the tunes a run sings, planned by the level
// ============================================================
//
// A tune is two bars of 4/4 in a major key, written on the staff the
// singer's voice reads and sung in their range. A run is three tunes, each
// with its own key. The level (1 to 10) sets how they move: quarters by
// step at a slow tempo first, then halves and thirds (Lesson 18's two bars,
// "quarters and halves, steps and do-mi-so" at 60 BPM, is level 5, where a
// new singer starts), then eighth pairs and wider leaps, a little faster at
// each level (SEASON-2 § 5.2 item 11).
//
// What every tune keeps, whatever its level: no rest, so the line is sung
// through; no note twice in a row, since a note's timing is read from the
// voice arriving on it (take-judge.ts); a leap of a fourth or more turns
// back by a step; the last note is do, reached by a step from re or ti and
// held for two beats; and an eighth comes in a beamed pair on its beat.
//
// A line that moves only by step from do back to do has an odd number of
// notes, so where a level moves by step alone its rhythms are the ones with
// an odd count: seven quarters and the held do, before halves come in.
//
// The notes are written where the staff reads them best, around its middle
// line, and Merc sings them an octave away where the singer's range needs
// it: a tenor reads the treble staff and sings an octave under it, as tenor
// parts are written. The run hears pitch by pitch class, so either octave
// is right (take-judge.ts).
//
// Pure, and random only through the `random` it is given.

import { getComfortableMidiRange, octaveShiftIntoRange, } from '@/lib/vocal-range'
import type { VocalRangePreset } from '@/stores/settings-store'
import type { Clef, KeySig, Letter, Spelled } from '../note-reading/staff-kit'
import { diatonicOf, keyAlter, midiOf, placeOf, spelledAt, syllableOf, } from '../note-reading/staff-kit'

/** Beats in a bar, and bars in a tune: two bars of 4/4. */
export const BAR_BEATS = 4
export const TUNE_BARS = 2
export const TUNE_BEATS = BAR_BEATS * TUNE_BARS
/** Tunes in a run. */
export const TUNES_PER_RUN = 3

/** The note values a level writes: quarters, halves, and eighths in pairs. */
export type NoteValue = 'quarter' | 'half' | 'eighths'

export interface InTimeLevel {
  readonly bpm: number
  readonly values: readonly NoteValue[]
  /** The widest move between two notes, in letters: 1 a step, 2 a third, 4 a fifth. */
  readonly leap: number
  /** The lowest and highest notes, in letters from do: -1 is ti below it, 4 is so. */
  readonly lowest: number
  readonly highest: number
  /** The notes a tune may start on, in letters from do. */
  readonly starts: readonly number[]
  /** The most sharps or flats its keys carry. */
  readonly signs: number
}

const Q: readonly NoteValue[] = ['quarter']
const QH: readonly NoteValue[] = ['quarter', 'half']
const QHE: readonly NoteValue[] = ['quarter', 'half', 'eighths']
/** Do, mi and so: where a tune may start once thirds are in play. */
const TRIAD = [0, 2, 4] as const

/** Each level, 1 to 10. */
export const IN_TIME_LEVELS: readonly InTimeLevel[] = [
  {
    bpm: 50,
    values: Q,
    leap: 1,
    lowest: -1,
    highest: 4,
    starts: [0],
    signs: 1,
  },
  {
    bpm: 56,
    values: Q,
    leap: 1,
    lowest: -1,
    highest: 4,
    starts: [0],
    signs: 1,
  },
  {
    bpm: 60,
    values: Q,
    leap: 1,
    lowest: -1,
    highest: 5,
    starts: [0],
    signs: 1,
  },
  {
    bpm: 60,
    values: QH,
    leap: 1,
    lowest: -2,
    highest: 5,
    starts: [0],
    signs: 1,
  },
  {
    bpm: 60,
    values: QH,
    leap: 2,
    lowest: -3,
    highest: 5,
    starts: TRIAD,
    signs: 1,
  },
  {
    bpm: 66,
    values: QH,
    leap: 2,
    lowest: -3,
    highest: 5,
    starts: TRIAD,
    signs: 2,
  },
  {
    bpm: 72,
    values: QHE,
    leap: 3,
    lowest: -3,
    highest: 7,
    starts: TRIAD,
    signs: 2,
  },
  {
    bpm: 80,
    values: QHE,
    leap: 4,
    lowest: -3,
    highest: 7,
    starts: TRIAD,
    signs: 3,
  },
  {
    bpm: 88,
    values: QHE,
    leap: 5,
    lowest: -4,
    highest: 8,
    starts: TRIAD,
    signs: 3,
  },
  {
    bpm: 96,
    values: QHE,
    leap: 7,
    lowest: -4,
    highest: 8,
    starts: TRIAD,
    signs: 3,
  },
]

/** The level's settings: 1 to 10, rounded and held inside. */
export function levelFor(level: number): InTimeLevel {
  const i = Math.min(10, Math.max(1, Math.round(level))) - 1
  return IN_TIME_LEVELS[i]
}

/** A level's widest move, in words. */
const LEAP_WORDS: Readonly<Record<number, string>> = {
  1: 'steps',
  2: 'steps and thirds',
  3: 'leaps up to a fourth',
  4: 'leaps up to a fifth',
  5: 'leaps up to a sixth',
  7: 'leaps up to an octave',
}

/** What a level writes, for the brief: "quarters and halves, steps and thirds". */
export function levelWords(lv: InTimeLevel): string {
  const values =
    lv.values.length === 1
      ? 'quarters'
      : lv.values.length === 2
        ? 'quarters and halves'
        : 'quarters, halves and eighths'
  return `${values}, ${LEAP_WORDS[lv.leap] ?? 'wide leaps'}`
}

/** A key a tune is in: its name, its do's letter and sign, and its signature. */
export interface TuneKey {
  readonly name: string
  readonly letter: Letter
  readonly alter: number
  readonly sig: KeySig
}

/** The major keys a run uses, by how many signs they carry. */
export const KEYS: readonly TuneKey[] = [
  { name: 'C', letter: 'C', alter: 0, sig: { sign: 'sharp', count: 0 } },
  { name: 'G', letter: 'G', alter: 0, sig: { sign: 'sharp', count: 1 } },
  { name: 'F', letter: 'F', alter: 0, sig: { sign: 'flat', count: 1 } },
  { name: 'D', letter: 'D', alter: 0, sig: { sign: 'sharp', count: 2 } },
  { name: 'B♭', letter: 'B', alter: -1, sig: { sign: 'flat', count: 2 } },
  { name: 'A', letter: 'A', alter: 0, sig: { sign: 'sharp', count: 3 } },
  { name: 'E♭', letter: 'E', alter: -1, sig: { sign: 'flat', count: 3 } },
]

/** The keys a level reads: no more signs than it allows. */
export const keysFor = (lv: InTimeLevel): TuneKey[] =>
  KEYS.filter((k) => k.sig.count <= lv.signs)

/** One written note of a tune. */
export interface TuneNote {
  /** Its first beat, counted from bar 1's first beat. */
  readonly beat: number
  /** Its length in beats: 1, 2, or 0.5 for an eighth. */
  readonly beats: number
  /** Letters from do: 0 do, 2 mi, -3 so below. */
  readonly degree: number
  /** As written, in the key. */
  readonly written: Spelled
  /** Its place on the staff, in letters above the bottom line. */
  readonly place: number
  /** The note Merc sings it on, in the singer's range (MIDI). */
  readonly midi: number
  /** Its syllable in the key: do, re, mi. */
  readonly syllable: string
}

export interface Tune {
  readonly key: TuneKey
  readonly clef: Clef
  readonly bpm: number
  readonly notes: readonly TuneNote[]
  /** Merc's do before the count-in, in the singer's range (MIDI). */
  readonly doMidi: number
}

/** Bars by the values they hold, in beats. An eighth pair starts on its beat. */
const BARS_Q: readonly (readonly number[])[] = [[1, 1, 1, 1]]
const BARS_H: readonly (readonly number[])[] = [
  [2, 1, 1],
  [1, 1, 2],
  [1, 2, 1],
]
const BARS_E: readonly (readonly number[])[] = [
  [0.5, 0.5, 1, 1, 1],
  [1, 0.5, 0.5, 1, 1],
  [1, 1, 0.5, 0.5, 1],
  [0.5, 0.5, 0.5, 0.5, 1, 1],
  [2, 0.5, 0.5, 1],
]
/** A last bar: it ends on a held do, the long last note of every first line. */
const LAST_Q: readonly (readonly number[])[] = [[1, 1, 2]]
const LAST_H: readonly (readonly number[])[] = [
  [1, 1, 2],
  [2, 2],
]
const LAST_E: readonly (readonly number[])[] = [
  [0.5, 0.5, 1, 2],
  [1, 0.5, 0.5, 2],
]

const pick = <T>(list: readonly T[], random: () => number): T =>
  list[Math.min(list.length - 1, Math.floor(random() * list.length))]

/**
 * The tune's rhythm, its notes' lengths in beats over two bars. Its first
 * bar carries the level's newest value, so every tune practises it: an
 * eighth pair once eighths are in play. A level that moves by step alone
 * takes only the rhythms with an odd count of notes, the ones a line by
 * step can come home to do on.
 */
export function planRhythm(lv: InTimeLevel, random: () => number): number[] {
  const halves = lv.values.includes('half')
  const eighths = lv.values.includes('eighths')
  const first = eighths ? BARS_E : halves ? [...BARS_Q, ...BARS_H] : BARS_Q
  const last = eighths ? [...LAST_H, ...LAST_E] : halves ? LAST_H : LAST_Q
  const rhythms = first
    .flatMap((a) => last.map((b) => [...a, ...b]))
    .filter((r) => lv.leap > 1 || r.length % 2 === 1)
  return [...pick(rhythms, random)]
}

/** How much a move of so many letters is wanted: steps most, then thirds. */
const WEIGHT = [0, 6, 3, 1.6, 1.2, 1, 1, 0.8]
/** A tune spans no more than a tenth, so every voice sings it in its range. */
const SPAN_MAX = 9

/** Whether a move from `prev` to `d` keeps to the level: a new note, near enough, inside the span. */
function allowed(
  d: number,
  prev: number,
  degrees: readonly number[],
  lv: InTimeLevel,
): boolean {
  const move = d - prev
  if (move === 0 || Math.abs(move) > lv.leap) return false
  const lo = Math.min(...degrees, d)
  const hi = Math.max(...degrees, d)
  return hi - lo <= SPAN_MAX
}

/** Whether `move` turns back by a step after a leap of a fourth or more (`leapt`), as it must. */
const turnsBack = (move: number, leapt: number | null): boolean =>
  leapt === null ||
  Math.abs(leapt) < 3 ||
  (Math.abs(move) === 1 && Math.sign(move) !== Math.sign(leapt))

/** The notes the `i`th of `n` may take as the tune nears its end: re or ti, then do. */
function nearTheEnd(
  options: number[],
  i: number,
  n: number,
  lv: InTimeLevel,
): number[] {
  if (i === n - 1) return options.filter((d) => d === 0)
  if (i === n - 2) return options.filter((d) => Math.abs(d) === 1)
  if (i === n - 3)
    return options.filter(
      (d) => Math.abs(d - 1) <= lv.leap || Math.abs(d + 1) <= lv.leap,
    )
  return options
}

/** One of `options`, weighted by how much its move from `prev` is wanted. */
function weighted(
  options: readonly number[],
  prev: number,
  random: () => number,
): number {
  const weights = options.map((d) => WEIGHT[Math.abs(d - prev)] ?? 0.5)
  let r = random() * weights.reduce((a, b) => a + b, 0)
  for (let k = 0; k < options.length; k++) {
    r -= weights[k]
    if (r <= 0) return options[k]
  }
  return options[options.length - 1]
}

function walkOnce(
  n: number,
  lv: InTimeLevel,
  random: () => number,
): number[] | null {
  const degrees = [pick(lv.starts, random)]
  for (let i = 1; i < n; i++) {
    const prev = degrees[i - 1]
    const leapt = i >= 2 ? prev - degrees[i - 2] : null
    const options: number[] = []
    for (let d = lv.lowest; d <= lv.highest; d++)
      if (allowed(d, prev, degrees, lv) && turnsBack(d - prev, leapt))
        options.push(d)
    const ending = nearTheEnd(options, i, n, lv)
    if (ending.length === 0) return null
    degrees.push(weighted(ending, prev, random))
  }
  return degrees
}

/** Whether a walk shows the level's newest move: a third once thirds are in play, a fourth or more beyond. */
function practisesLeap(degrees: readonly number[], lv: InTimeLevel): boolean {
  if (lv.leap < 2) return true
  const widest = Math.max(
    ...degrees.slice(1).map((d, i) => Math.abs(d - degrees[i])),
  )
  return widest >= Math.min(lv.leap, 3)
}

/**
 * The tune's notes as letters from do, `n` of them: a walk inside the
 * level's notes and moves that ends re-do or ti-do. A walk is tried again
 * until it shows the level's newest move; the fallback climbs from do and
 * comes back by step (do re mi fa mi re do), which every level can sing,
 * opening on do-mi where the count of notes is even (only where thirds are
 * in play: `planRhythm`).
 */
export function planDegrees(
  n: number,
  lv: InTimeLevel,
  random: () => number,
): number[] {
  for (let tries = 0; tries < 400; tries++) {
    const walk = walkOnce(n, lv, random)
    if (walk !== null && practisesLeap(walk, lv)) return walk
  }
  const peak = Math.floor(n / 2)
  const up =
    n % 2 === 1
      ? Array.from({ length: peak + 1 }, (_, i) => i)
      : [0, ...Array.from({ length: peak - 1 }, (_, i) => i + 2)]
  const down = Array.from({ length: peak }, (_, i) => peak - 1 - i)
  return [...up, ...down]
}

/** A note `degree` letters from do in `key`, do written at diatonic step `doStep`. */
function spell(key: TuneKey, doStep: number, degree: number): Spelled {
  const plain = spelledAt(doStep + degree)
  return { ...plain, alter: keyAlter(key.sig, plain.letter) }
}

/**
 * The octave do is written in: the one that puts the tune's notes nearest
 * the staff's middle line, with no more than two ledger lines either way.
 */
export function writtenDoStep(
  key: TuneKey,
  degrees: readonly number[],
  clef: Clef,
): number {
  let best = 0
  let bestCost = Infinity
  for (let octave = 1; octave <= 6; octave++) {
    const doStep = diatonicOf({ letter: key.letter, alter: key.alter, octave })
    const places = degrees.map((d) => placeOf(spell(key, doStep, d), clef))
    const outside =
      Math.max(0, -4 - Math.min(...places)) +
      Math.max(0, Math.max(...places) - 12)
    const mid = (Math.min(...places) + Math.max(...places)) / 2
    const cost = outside * 100 + Math.abs(mid - 4)
    if (cost < bestCost) {
      bestCost = cost
      best = doStep
    }
  }
  return best
}

export interface TuneOptions {
  readonly level: number
  readonly clef: Clef
  readonly voice: VocalRangePreset
  readonly random: () => number
  /** The key, in place of one drawn from the level's keys. */
  readonly key?: TuneKey
}

/** How many tunes are drawn, at most, for one that fits the singer's range. */
const FIT_TRIES = 40

/**
 * One tune: a rhythm, a walk on it, a key, the staff's octave and the
 * singer's. A tune moves into the singer's range by whole octaves; one
 * wider than an octave may not fit at its pitch, and is drawn again (the
 * last one drawn stands if none fits).
 */
export function planTune(o: TuneOptions): Tune {
  const lv = levelFor(o.level)
  const key = o.key ?? pick(keysFor(lv), o.random)
  const { min, max } = getComfortableMidiRange(o.voice)
  let tune = drawTune(o, lv, key)
  for (let tries = 1; tries < FIT_TRIES; tries++) {
    const midis = tune.notes.map((n) => n.midi)
    if (Math.min(...midis) >= min && Math.max(...midis) <= max) break
    tune = drawTune(o, lv, key)
  }
  return tune
}

function drawTune(o: TuneOptions, lv: InTimeLevel, key: TuneKey): Tune {
  const rhythm = planRhythm(lv, o.random)
  const degrees = planDegrees(rhythm.length, lv, o.random)
  const doStep = writtenDoStep(key, degrees, o.clef)
  const home = spell(key, doStep, 0)
  const written = degrees.map((d) => spell(key, doStep, d))
  const midis = written.map(midiOf)
  // Merc sings it where the singer can; the run hears it by pitch class.
  const shift = octaveShiftIntoRange(
    Math.min(midiOf(home), ...midis),
    Math.max(...midis),
    o.voice,
  )
  let beat = 0
  const notes = rhythm.map((beats, i): TuneNote => {
    const note: TuneNote = {
      beat,
      beats,
      degree: degrees[i],
      written: written[i],
      place: placeOf(written[i], o.clef),
      midi: midis[i] + shift,
      syllable: syllableOf(written[i], home),
    }
    beat += beats
    return note
  })
  return {
    key,
    clef: o.clef,
    bpm: lv.bpm,
    notes,
    doMidi: midiOf(home) + shift,
  }
}

/**
 * A run's tunes, each in a key of its own where the level offers more than
 * one, so no two tunes running share a do.
 */
export function planRun(o: Omit<TuneOptions, 'key'>): Tune[] {
  const lv = levelFor(o.level)
  const tunes: Tune[] = []
  for (let i = 0; i < TUNES_PER_RUN; i++) {
    const keys = keysFor(lv).filter((k) => k !== tunes[i - 1]?.key)
    tunes.push(planTune({ ...o, key: pick(keys, o.random) }))
  }
  return tunes
}

/** One beat of a tune's grid: what its box says, and whether a note starts in it. */
export interface GridBeat {
  /** Its count in its bar, 1 to 4. */
  readonly count: number
  /** Held from the note before, "(2)", or split in two eighths, "2 &". */
  readonly kind: 'start' | 'held' | 'split'
  /** The note that sounds at its start. */
  readonly note: number
}

/** The tune's eight beats, as the grid under the staff counts them. */
export function gridOf(tune: Tune): GridBeat[] {
  return Array.from({ length: TUNE_BEATS }, (_, b) => {
    const note = noteAt(tune, b)
    const n = tune.notes[note]
    const kind =
      n.beat < b - 1e-9 ? 'held' : n.beats < 1 - 1e-9 ? 'split' : 'start'
    return { count: (b % BAR_BEATS) + 1, kind, note }
  })
}

/** The note sounding at `beat` (from bar 1's first), the last one past the end. */
export function noteAt(tune: Tune, beat: number): number {
  for (let i = tune.notes.length - 1; i >= 0; i--)
    if (tune.notes[i].beat <= beat + 1e-9) return i
  return 0
}

/** Seconds in a beat at the tune's tempo. */
export const beatSeconds = (tune: Pick<Tune, 'bpm'>): number => 60 / tune.bpm
