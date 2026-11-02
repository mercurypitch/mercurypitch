// ============================================================
// Harmony's lines: Merc's line, and the harmony a third from it
// ============================================================
//
// Each line is Merc's: a few notes of a major key, by step at Learning and
// Singer, with one leap among its steps at Professional. The harmony is
// his line a third above in the same key, or a third below for a few lines
// at Professional: each note's third is the key's own, major or minor as
// the line goes, so G A B A in C major sits under B C D C (the room's
// mock-ups, 1 Nov 2026).
//
// A run is HARMONY_LINES lines, each placed so the harmony, the line the
// singer sings, sits in their window (lib's sung window: the voiceprint's
// range, else the voice type's, held to what a phone's speaker carries).
// Merc's line may sit outside it: he sings it. No line follows itself, and
// a key is not used twice running where another fits. Pure: the
// controller passes its random source in, a test a seeded one.

import type { NoteWindow } from '@/lib/sequence/sung-window'
import { SUNG_HIGH, SUNG_LOW } from '@/lib/sequence/sung-window'
import type { HarmonyLevel } from './harmony-rules'

/** Steps of the major scale from its tonic, semitones. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
/** Degrees from Merc's note to the harmony's: a third. */
const THIRD = 2
/** The lowest note Merc sings: G2, still in his voice. */
const MERC_LOW = 43

/** One line of a run: Merc's notes and the harmony's, a third apart. */
export interface HarmonyLine {
  /** 0 for the first line. */
  readonly index: number
  /** The key's tonic, MIDI. */
  readonly tonic: number
  /** Merc's line, MIDI, in order. */
  readonly merc: readonly number[]
  /** The harmony, MIDI: each note a third from his, in the key. */
  readonly harmony: readonly number[]
  /** The harmony sits a third below his line (Professional's few). */
  readonly below: boolean
}

/** A degree of the key from its tonic (0), up the scale or down it. */
export function degreeMidi(tonic: number, degree: number): number {
  const octave = Math.floor(degree / 7)
  return tonic + 12 * octave + MAJOR[degree - octave * 7]
}

/** A whole number below `count`. */
const pick = (count: number, random: () => number): number =>
  Math.min(count - 1, Math.floor(random() * count))

/** Each move of a line by step: up or down, at random. */
function stepMoves(count: number, random: () => number): number[] {
  return Array.from({ length: count }, () => (random() < 0.5 ? -1 : 1))
}

/**
 * A line's shape, degrees from its first note: `notes` long, by step, and
 * with one leap of a third or a fourth among the steps when `withLeap`.
 * A line never runs past an octave.
 */
export function lineShape(
  notes: number,
  withLeap: boolean,
  random: () => number,
): number[] {
  const moves = stepMoves(notes - 1, random)
  if (withLeap) {
    const at = pick(moves.length, random)
    moves[at] = moves[at] * (random() < 0.5 ? 2 : 3)
  }
  const shape = [0]
  for (const move of moves) shape.push(shape[shape.length - 1] + move)
  return shape
}

const sameShape = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((step, i) => step === b[i])

/** Where a line can sit: its key and the degree of its first note. */
interface Place {
  readonly tonic: number
  readonly start: number
}

/** Merc's notes and the harmony's, for a shape at a place. */
function notesAt(
  shape: readonly number[],
  place: Place,
  below: boolean,
): { merc: number[]; harmony: number[] } {
  const third = below ? -THIRD : THIRD
  return {
    merc: shape.map((d) => degreeMidi(place.tonic, place.start + d)),
    harmony: shape.map((d) => degreeMidi(place.tonic, place.start + d + third)),
  }
}

/**
 * Every place a shape fits: the harmony inside the window, Merc's line in
 * his voice. Keys from C3 to B3 (any key: the degrees carry the octave),
 * the first note anywhere from an octave under the tonic to two over it.
 */
function placesFor(
  shape: readonly number[],
  below: boolean,
  window: NoteWindow,
): Place[] {
  const places: Place[] = []
  for (let tonic = 48; tonic < 60; tonic++) {
    for (let start = -7; start <= 14; start++) {
      const { merc, harmony } = notesAt(shape, { tonic, start }, below)
      const inWindow = harmony.every((m) => m >= window.low && m <= window.high)
      const sings = merc.every((m) => m >= MERC_LOW && m <= SUNG_HIGH + 4)
      if (inWindow && sings) places.push({ tonic, start })
    }
  }
  return places
}

/**
 * A shape wider than the window: its harmony's middle on the window's
 * middle, in C, held to the band the speaker carries.
 */
function middlePlace(
  shape: readonly number[],
  below: boolean,
  window: NoteWindow,
): Place {
  const third = below ? -THIRD : THIRD
  const middle = (window.low + window.high) / 2
  const lowest = Math.min(...shape) + third
  const centre = Math.round((Math.min(...shape) + Math.max(...shape)) / 2)
  let start = -7
  while (start < 14 && degreeMidi(48, start + centre + third) < middle) start++
  while (start < 14 && degreeMidi(48, start + lowest) < SUNG_LOW) start++
  return { tonic: 48, start }
}

/** Which of a run's lines sit a third below: none before the third line. */
function linesBelow(
  count: number,
  below: number,
  random: () => number,
): Set<number> {
  const pool = Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 2)
  const chosen = new Set<number>()
  while (chosen.size < Math.min(below, pool.length)) {
    chosen.add(pool.splice(pick(pool.length, random), 1)[0])
  }
  return chosen
}

/** The run's lines, at `level`, with their harmonies in `window`. */
export function planLines(
  count: number,
  window: NoteWindow,
  level: HarmonyLevel,
  random: () => number,
): HarmonyLine[] {
  const lines: HarmonyLine[] = []
  const below = linesBelow(count, level.linesBelow, random)
  let lastShape: number[] = []
  for (let index = 0; index < count; index++) {
    let shape = lineShape(level.notes, level.withLeap, random)
    for (let tries = 0; tries < 8 && sameShape(shape, lastShape); tries++) {
      shape = lineShape(level.notes, level.withLeap, random)
    }
    lastShape = shape
    const isBelow = below.has(index)
    const places = placesFor(shape, isBelow, window)
    const previous = lines[index - 1]?.tonic
    const fresh = places.filter((place) => place.tonic !== previous)
    const choices = fresh.length > 0 ? fresh : places
    const place =
      choices.length > 0
        ? choices[pick(choices.length, random)]
        : middlePlace(shape, isBelow, window)
    lines.push({
      index,
      tonic: place.tonic,
      ...notesAt(shape, place, isBelow),
      below: isBelow,
    })
  }
  return lines
}
