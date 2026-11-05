// ============================================================
// Rhythm words — what a written bar is called, beat by beat, and how long it lasts
// ============================================================
//
// The rhythm bar speaks in words only (Lesson 17 WEB-SPEC, Toys 1,
// "Keyboard and screen readers"): the figure is a group named for what it
// shows, "One bar of 4/4: two quarter notes and a half note, on one line";
// each pad is named by its beat and what it holds, "Beat 2: two eighth
// notes", "Beat 3: a quarter rest"; and once a play ends, the figure's
// polite region says its lengths once, "Four quarter notes at 60 beats per
// minute: 1 second each." The strip under the figure is hidden from a
// screen reader, so these are how it hears every length (Toys 6). Pure.

import type { Bar, PlacedSymbol, Written } from './rhythm-model'
import { BAR_BEATS, placeBars, stripCells } from './rhythm-model'

const NAMES: Readonly<Record<number, string>> = {
  4: 'whole',
  2: 'half',
  1: 'quarter',
  0.5: 'eighth',
  0.25: 'sixteenth',
}

const COUNT = [
  'no',
  'a',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
]

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

/** A symbol's name without its count: "dotted half note", "quarter rest". */
function nameOf(w: { kind: string; value: number; dotted?: boolean }): string {
  const value = NAMES[w.value] ?? 'short'
  return `${w.dotted === true ? 'dotted ' : ''}${value} ${w.kind}`
}

/** "a half note", "two eighth notes": a run of equal symbols, counted. */
function counted(n: number, name: string): string {
  const words = COUNT[n] ?? String(n)
  const article = n === 1 && /^[aeiou]/.test(name) ? 'an' : words
  return `${article} ${name}${n > 1 ? 's' : ''}`
}

/** Joins a list in words: "a, b and c". */
export function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Symbols in words, a run of equal ones counted: "two quarter notes and a half note". */
export function symbolWords(symbols: readonly Written[]): string {
  const parts: string[] = []
  let i = 0
  while (i < symbols.length) {
    const name = nameOf(symbols[i])
    let n = 1
    while (i + n < symbols.length && nameOf(symbols[i + n]) === name) n++
    parts.push(counted(n, name))
    i += n
  }
  return andList(parts)
}

const BARS_WORDS = ['no bars', 'One bar', 'Two bars', 'Three bars']

/** Where the figure is written: "on one line", "on the bass staff". */
export function staffWords(staff: 'line' | 'bass' | 'treble'): string {
  return staff === 'line' ? 'on one line' : `on the ${staff} staff`
}

/**
 * The figure's name: "One bar of 4/4: four quarter notes, on one line";
 * two bars say each, "Two bars of 4/4: a half note and two quarter notes,
 * then two quarter notes and a half note, on the bass staff", and a tie
 * is said after them.
 */
export function figureWords(
  bars: readonly Bar[],
  staff: 'line' | 'bass' | 'treble',
): string {
  const what = bars.map((b) => symbolWords(b)).join(', then ')
  const count = BARS_WORDS[bars.length] ?? `${bars.length} bars`
  const across = bars.some(
    (b, i) => i < bars.length - 1 && b.at(-1)?.tie === true,
  )
  const tie = across
    ? ', tied across the bar line'
    : bars.some((b) => b.some((w) => w.tie === true))
      ? ', with a tie'
      : ''
  return `${count} of 4/4: ${what}${tie}, ${staffWords(staff)}`
}

/** What a beat holds, in words: its own notes, or the note it is part of. */
export function beatWords(
  placed: readonly PlacedSymbol[],
  beat: number,
): string {
  const inBeat = placed.filter(
    (p) => p.beat >= beat - 1e-6 && p.beat < beat + 1 - 1e-6,
  )
  if (inBeat.length > 0)
    return symbolWords(
      inBeat.map((p) => ({
        kind: p.kind,
        value: p.value as Written['value'],
        dotted: p.dotted,
        tie: p.tie,
      })),
    )
  const over = placed.find((p) => p.beat < beat && beat < p.beat + p.beats)
  return over === undefined
    ? 'nothing'
    : `the ${nameOf(over)}, ${over.kind === 'rest' ? 'still silent' : 'held'}`
}

/** A pad's name: "Beat 2: two eighth notes". */
export const padWords = (
  placed: readonly PlacedSymbol[],
  beat: number,
): string => `Beat ${(beat % BAR_BEATS) + 1}: ${beatWords(placed, beat)}`

/** Seconds as a screen reader hears them: "1 second", "0.5 seconds", "0.67 seconds". */
export function secondsWords(beats: number, bpm: number): string {
  const s = Number(((beats * 60) / bpm).toFixed(2))
  return `${s} second${s === 1 ? '' : 's'}`
}

/**
 * A play's lengths, said once as it ends: what played, at what tempo, and
 * each sound's or rest's length, a run of equal ones said once: "Four
 * quarter notes at 60 beats per minute: 1 second each."; "Two quarter
 * notes and a half note at 60 beats per minute: 1 second each, then 2
 * seconds."; a rest's, "rest, 1 second".
 */
export function lengthsWords(bars: readonly Bar[], bpm: number): string {
  const cells = stripCells(placeBars(bars))
  const runs: { words: string; n: number }[] = []
  for (const c of cells) {
    const w = `${c.kind === 'rest' ? 'rest, ' : ''}${secondsWords(c.beats, bpm)}`
    const last = runs.at(-1)
    if (last !== undefined && last.words === w) last.n++
    else runs.push({ words: w, n: 1 })
  }
  const lengths = runs
    .map((r) => (r.n > 1 ? `${r.words} each` : r.words))
    .join(', then ')
  const what = bars.map((b) => symbolWords(b)).join(', then ')
  return `${capital(what)} at ${bpm} beats per minute: ${lengths}.`
}
