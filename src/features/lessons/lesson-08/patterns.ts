// ============================================================
// Lesson 8 patterns — the drums, the tune on the beat, and every run's bars
// ============================================================
//
// Pure (WEB-SPEC, Tests 1 and 2). The grid's three lanes, Kick, Clap and
// Hi-hat, at the app's drum voices and FACTS 75's levels; Rock, Ableton's
// basic rock beat with a clap for the snare, and March, at their own tempos
// (FACTS 24, 25, 75); the take's groove (FACTS 76). The tune is Lesson 6's
// "Twinkle", imported, never copied (FACTS 31), one syllable a beat and
// "star" and "are" held for two (FACTS 32), and the cold open sings its
// two lines over the plain click with claps on 1 and 3, or on 2 and 4:
// the two versions differ in their claps alone (FACTS 30, 72).

import type { Bar, Hit } from '@/features/lessons/kit/beat-clock'
import type { PatternChoice } from '@/features/lessons/kit/beat-machine'
import type { Lane, MachineHit, Pattern, } from '@/features/lessons/kit/beat-patterns'
import { clickBar, patternBar } from '@/features/lessons/kit/beat-patterns'
import type { StripRow } from '@/features/lessons/kit/beat-strip'
import type { MelodyNote } from '@/features/lessons/lesson-06/melody'
import { C4, lineMidis, TWINKLE } from '@/features/lessons/lesson-06/melody'

/** Every run on the page but the steps' own tempos: 90 BPM (FACTS 72, 76, 77). */
export const BPM = 90
/** One beat at 90 BPM, seconds. */
export const BEAT_SEC = 60 / BPM

/** The grid's lanes (FACTS 75). */
export const LANES: readonly Lane[] = [
  {
    id: 'kick',
    name: 'Kick',
    one: 'kick',
    many: 'kick',
    voice: 'kick',
    level: 0.8,
    accent: 1,
    perBeat: 1,
  },
  {
    id: 'clap',
    name: 'Clap',
    one: 'clap',
    many: 'claps',
    voice: 'clap',
    level: 0.7,
    perBeat: 1,
    backbeat: true,
  },
  {
    id: 'hat',
    name: 'Hi-hat',
    one: 'hi-hat',
    many: 'hi-hat',
    voice: 'hh-closed',
    level: 0.5,
    perBeat: 2,
  },
]

/** Rock: a kick on 1 and 3, claps on 2 and 4, the hi-hat on every eighth (FACTS 24). */
export const ROCK: Pattern = {
  beats: 4,
  cells: { kick: [1, 0, 1, 0], clap: [0, 1, 0, 1], hat: [1, 1, 1, 1] },
}

/** March: BOOM-whack-whack-whack, a kick on 1, accented, claps on 2, 3 and 4, no hi-hat (FACTS 25). */
export const MARCH: Pattern = {
  beats: 4,
  cells: { kick: [2, 0, 0, 0], clap: [0, 1, 1, 1], hat: [0, 0, 0, 0] },
}

/** The take's groove: a kick on 1 and 3 and the hi-hat on every eighth, no clap (FACTS 76). */
export const GROOVE: Pattern = {
  beats: 4,
  cells: { kick: [1, 0, 1, 0], clap: [0, 0, 0, 0], hat: [1, 1, 1, 1] },
}

/** The machine's two patterns, at their own tempos (FACTS 75). */
export const PATTERNS: Readonly<Record<'rock' | 'march', PatternChoice>> = {
  rock: { name: 'Rock', pattern: ROCK, bpm: 90 },
  march: { name: 'March', pattern: MARCH, bpm: 120 },
}

/** Merc's level on each beat of a bar in the cold open: loudest on 1, softest on 2 and 4 (FACTS 30c). */
export const MERC_LEVELS: readonly number[] = [0.2, 0.14, 0.17, 0.14]
/** A clap's level, the cold open's and a tap's (FACTS 72, 76). */
export const CLAP_LEVEL = 0.7

/** One sung syllable: its note, its beat from the line's first, and how many beats it holds. */
export interface Syllable {
  readonly midi: number
  readonly beat: number
  readonly beats: number
  readonly text: string
}

/** A line's syllables from do, a beat each and the last held for two (FACTS 32). */
export function lineSyllables(
  line: readonly MelodyNote[],
  doMidi: number,
  from = 0,
): Syllable[] {
  const midis = lineMidis(line, doMidi)
  let beat = from
  return line.map((note, i) => {
    const s = { midi: midis[i], beat, beats: note.beats, text: note.syllable }
    beat += note.beats
    return s
  })
}

/** Both lines from C4: fourteen syllables over sixteen beats. */
export const TUNE: readonly Syllable[] = [
  ...lineSyllables(TWINKLE[0], C4, 0),
  ...lineSyllables(TWINKLE[1], C4, 8),
]

/** A syllable as it shows in a cell: the first of each line capitalised, "Twin" and "How". */
const shown = (s: Syllable, i: number): string =>
  i === 0 ? s.text[0].toUpperCase() + s.text.slice(1) : s.text

/** A line as a strip row: one cell a syllable, the held ones across two beats. */
export function stripRow(syllables: readonly Syllable[]): StripRow {
  return {
    cells: syllables.map((s, i) => ({
      text: shown(s, i),
      span: s.beats === 2 ? 2 : 1,
    })),
  }
}

/** The hero's strip: the two lines, a row each. */
export const HERO_ROWS: readonly StripRow[] = [
  stripRow(TUNE.slice(0, 7)),
  stripRow(TUNE.slice(7)),
]

/** The cold open's two versions: claps on 1 and 3, or on 2 and 4 (0-based beats of each bar). */
export const CLAPS = { 13: [0, 2], 24: [1, 3] } as const
export type Version = keyof typeof CLAPS

/** What the cold open's beat clock plays and shows: a click, a clap, a syllable or a Merc's hop. */
export type ColdHit =
  | { readonly kind: 'click' }
  | { readonly kind: 'clap' }
  | { readonly kind: 'hop' }
  | {
      readonly kind: 'sing'
      readonly syllable: Syllable
      readonly index: number
    }

/**
 * The cold open's four bars: the plain click on every beat, the claps, a
 * hop `hopBeats` before each clap so it lands on the clap, and each
 * syllable at its beat's level. The versions differ in their claps alone.
 */
export function coldOpenBars(
  version: Version,
  hopBeats: number,
): Bar<ColdHit>[] {
  return Array.from({ length: 4 }, (_, bar) => {
    const hits: Hit<ColdHit>[] = []
    for (let beat = 0; beat < 4; beat++)
      hits.push({ beat, data: { kind: 'click' } })
    for (const beat of CLAPS[version]) {
      hits.push({ beat, data: { kind: 'clap' } })
      hits.push({ beat: beat - hopBeats, data: { kind: 'hop' } })
    }
    TUNE.forEach((syllable, index) => {
      const at = syllable.beat - bar * 4
      if (at >= 0 && at < 4)
        hits.push({ beat: at, data: { kind: 'sing', syllable, index } })
    })
    hits.sort((a, b) => a.beat - b.beat)
    return { beats: 4, hits }
  })
}

/** Merc's level for a syllable at `beat` of its bar (FACTS 30c). */
export const mercLevel = (beat: number): number => MERC_LEVELS[beat % 4]

/** The take's bars: one counted in on the click, two of the groove with it, four of the groove alone (FACTS 43, 76). */
export function takeBars(): Bar<MachineHit>[] {
  return [
    clickBar(4, 'bars'),
    patternBar(GROOVE, LANES, 'bars'),
    patternBar(GROOVE, LANES, 'bars'),
    patternBar(GROOVE, LANES),
    patternBar(GROOVE, LANES),
    patternBar(GROOVE, LANES),
    patternBar(GROOVE, LANES),
  ]
}

/** Play the groove: four bars of it, no click (FACTS 76). */
export const grooveBars = (): Bar<MachineHit>[] =>
  Array.from({ length: 4 }, () => patternBar(GROOVE, LANES))

/** The four words' backbeat: a kick on 1 and 3 and a clap on 2 and 4, no hi-hat (FACTS 73). */
export const BACKBEAT: Pattern = {
  beats: 4,
  cells: { kick: [1, 0, 1, 0], clap: [0, 1, 0, 1], hat: [0, 0, 0, 0] },
}

/** A word's sound: its bars, and how long each beat lasts by its index from the first, seconds. */
export interface WordSound {
  readonly bars: readonly Bar<MachineHit>[]
  readonly beatSec: (beat: number) => number
}

/**
 * The four words' sounds (FACTS 73): Beat, four clicks at 90 BPM; Tempo,
 * four at 60, 0.6 s of silence, then four at 120, so its fourth beat lasts
 * 1.6 s; Bar, two bars of four, beats 1 and 5 on the high click; Backbeat,
 * one bar of the kick on 1 and 3 and the clap on 2 and 4.
 */
export const WORD_SOUNDS: Readonly<Record<string, WordSound>> = {
  beat: { bars: [clickBar(4, 'plain')], beatSec: () => BEAT_SEC },
  tempo: {
    bars: [clickBar(8, 'plain')],
    beatSec: (b) => (b < 3 ? 1 : b === 3 ? 1.6 : 0.5),
  },
  bar: {
    bars: [clickBar(4, 'bars'), clickBar(4, 'bars')],
    beatSec: () => BEAT_SEC,
  },
  backbeat: { bars: [patternBar(BACKBEAT, LANES)], beatSec: () => BEAT_SEC },
}

/** What the sung line's runs play: the click and the drums, the count-in's do, and Merc's syllables. */
export type LineHit =
  | MachineHit
  | { readonly kind: 'do'; readonly midi: number }
  | {
      readonly kind: 'sing'
      readonly syllable: Syllable
      readonly index: number
    }

/** The count-in's do: the soft tone, one beat, at half a tapped note's level (FACTS 79). */
export const COUNT_IN_DO_GAIN = 0.065
/** The groove under the sung line, at half the steps' level (FACTS 76). */
export const LINE_GROOVE_SCALE = 0.5

/**
 * The sung line's bars (FACTS 68, 76, 79): a bar counted in on the click,
 * beat 1 high, with do softly on its first beat, then two bars of Rock at
 * half its gain with no click; Merc's line sings the first line's seven
 * syllables over them, and the guide leaves them to the viewer.
 */
export function lineBars(doMidi: number, merc: boolean): Bar<LineHit>[] {
  const countIn: Bar<LineHit> = {
    beats: 4,
    hits: [
      ...clickBar(4, 'bars').hits,
      { beat: 0, data: { kind: 'do', midi: doMidi } },
    ],
  }
  const line = lineSyllables(TWINKLE[0], doMidi)
  const bar = (k: number): Bar<LineHit> => {
    const hits: Hit<LineHit>[] = [
      ...patternBar(ROCK, LANES, 'none', LINE_GROOVE_SCALE).hits,
    ]
    if (merc)
      line.forEach((syllable, index) => {
        if (Math.floor(syllable.beat / 4) === k)
          hits.push({
            beat: syllable.beat - k * 4,
            data: { kind: 'sing', syllable, index },
          })
      })
    hits.sort((a, b) => a.beat - b.beat)
    return { beats: 4, hits }
  }
  return [countIn, bar(0), bar(1)]
}
