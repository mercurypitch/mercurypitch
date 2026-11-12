// ============================================================
// Lesson 18 tunes — every tune the page writes, its brackets and its marks
// ============================================================
//
// The page's tunes, each two bars of 4/4 in quarter and half notes in G,
// do on G3 in the bass staff's top space and on G4 on the treble staff's
// second line (FACTS 11 to 13): the cold open's, Merc's, in the bass for
// everyone (FACTS 8, 34); Step 2's tunes A and B with their brackets
// (FACTS 39); Step 3's tune C, which Step 4's breath mark reuses; and Sing
// it's tunes 1 and 2, each with its breath mark at the bar line (FACTS
// 48, 50). No step plays a sung tune. Step 4's short figures and the four
// words' are quarter notes, or one half note, with no time signature, no
// bar line and no beat grid (FACTS 41, 77), each with its marks and how
// each sound is shaped: p at 0.3 of the voice's level and f at 1.0, a
// hairpin's glide, staccato's 0.15 s, a slur's notes joined, and a breath's
// 0.4 s taken from the note before it (WEB-SPEC, Audio; FACTS 75).

import type { Letter, Spelled } from '@/features/lessons/kit/notes'
import type { Bracket, SheetMark } from '@/features/lessons/kit/read-marks'
import type { SoundShape } from '@/features/lessons/kit/rhythm-bar'
import type { RhythmRow, RhythmScene, } from '@/features/lessons/kit/rhythm-layout'
import type { Bar, Written } from '@/features/lessons/kit/rhythm-model'
import type { Clef } from '@/features/lessons/kit/staff-places'

/** Every play on the page, 60 BPM (FACTS 17). */
export const BPM = 60
/** p and f, a fraction of the voice's own level (WEB-SPEC, Audio). */
export const P_LEVEL = 0.3
export const F_LEVEL = 1
/** A staccato note's sounding length, s. */
export const STACCATO_SEC = 0.15
/** The note before a breath sounds this long, s; the breath takes the rest of its beat. */
export const BREATH_NOTE_SEC = 0.6

const Q: Written = { kind: 'note', value: 1 }
const H: Written = { kind: 'note', value: 2 }

const nat = (letter: Letter, octave: number): Spelled => ({
  letter,
  alter: 0,
  octave,
})

/** Do, G, in each clef's octave: G3 in the bass staff's top space, G4 on the treble staff's second line. */
export const DO: Readonly<Record<Clef, Spelled>> = {
  bass: nat('G', 3),
  treble: nat('G', 4),
}

/** Do, re, mi, fa and so in G in `clef`'s octave: G, A, B, C, D (FACTS 11). */
export function scaleOf(clef: Clef): Spelled[] {
  const o = DO[clef].octave
  return [
    nat('G', o),
    nat('A', o),
    nat('B', o),
    nat('C', o + 1),
    nat('D', o + 1),
  ]
}

/** Each degree's syllable, do 0 to so 4. */
export const SYLLABLES = ['do', 're', 'mi', 'fa', 'so'] as const

export type TuneId = 'cold' | 'a' | 'b' | 'c' | 'sing-1' | 'sing-2'

/** A tune: its two bars, each sound's degree (do 0 to so 4), its brackets and its breath mark. */
export interface Tune {
  readonly id: TuneId
  readonly bars: readonly Bar[]
  readonly degrees: readonly number[]
  /** Its patterns' brackets, by sound, with their labels (FACTS 39). */
  readonly brackets: readonly Bracket[]
  /** The beat of the bar line a breath mark sits over, with the sound before it shortened, or none. */
  readonly breath?: number
}

/** The cold open's tune, Merc's: do re mi re, do mi so (half), G3 A3 B3 A3, G3 B3 D4 (FACTS 34). */
export const COLD: Tune = {
  id: 'cold',
  bars: [
    [Q, Q, Q, Q],
    [Q, Q, H],
  ],
  degrees: [0, 1, 2, 1, 0, 2, 4],
  brackets: [
    { first: 0, last: 3, label: 'a run of steps' },
    { first: 4, last: 6, label: 'do-mi-so' },
  ],
}

/** Step 2's tune A: do re mi fa, so (half) so (half). */
export const TUNE_A: Tune = {
  id: 'a',
  bars: [
    [Q, Q, Q, Q],
    [H, H],
  ],
  degrees: [0, 1, 2, 3, 4, 4],
  brackets: [
    { first: 0, last: 3, label: 'a run of steps' },
    { first: 4, last: 5, label: 'a repeated note' },
  ],
}

/** Step 2's tune B: so (half) mi do, re re do (half), do-mi-so going down. */
export const TUNE_B: Tune = {
  id: 'b',
  bars: [
    [H, Q, Q],
    [Q, Q, H],
  ],
  degrees: [4, 2, 0, 1, 1, 0],
  brackets: [
    { first: 0, last: 2, label: 'do-mi-so' },
    { first: 3, last: 4, label: 'a repeated note' },
  ],
}

/** Step 3's tune C: do re mi do, re (half) do (half). */
export const TUNE_C: Tune = {
  id: 'c',
  bars: [
    [Q, Q, Q, Q],
    [H, H],
  ],
  degrees: [0, 1, 2, 0, 1, 0],
  brackets: [],
}

/** Step 4's breath mark: tune C with a breath over its bar line (FACTS 41). */
export const TUNE_C_BREATH: Tune = { ...TUNE_C, breath: 4 }

/** Sing it's first tune: do re mi so, so mi do (half), with its breath mark (FACTS 48). */
export const SING_1: Tune = {
  id: 'sing-1',
  bars: [
    [Q, Q, Q, Q],
    [Q, Q, H],
  ],
  degrees: [0, 1, 2, 4, 4, 2, 0],
  brackets: [],
  breath: 4,
}

/** Sing it's second tune: do do mi mi, so (half) do (half), with its breath mark (FACTS 50). */
export const SING_2: Tune = {
  id: 'sing-2',
  bars: [
    [Q, Q, Q, Q],
    [H, H],
  ],
  degrees: [0, 0, 2, 2, 4, 0],
  brackets: [],
  breath: 4,
}

/** A tune's notes in a clef's octave: the hero writes the cold open's in the bass for everyone, the steps in the learner's clef. */
export const notesOf = (tune: Tune, clef: Clef): Spelled[] =>
  tune.degrees.map((d) => scaleOf(clef)[d])

/** Each sound's first beat from bar 1's first, and its beats. */
export function beatsOf(
  tune: Pick<Tune, 'bars'>,
): { beat: number; beats: number }[] {
  const out: { beat: number; beats: number }[] = []
  let at = 0
  for (const bar of tune.bars)
    for (const w of bar) {
      out.push({ beat: at, beats: w.value })
      at += w.value
    }
  return out
}

/** The sound a breath mark shortens: the one ending on its beat. */
export function breathSound(tune: Tune): number | null {
  if (tune.breath === undefined) return null
  const i = beatsOf(tune).findIndex((b) => b.beat + b.beats === tune.breath)
  return i === -1 ? null : i
}

/** How a tune's sounds are shaped: the sound before its breath mark sounds 0.6 s. */
export function tuneShape(
  tune: Tune,
): (sound: number) => SoundShape | undefined {
  const before = breathSound(tune)
  return (sound) =>
    sound === before ? { seconds: BREATH_NOTE_SEC } : undefined
}

/** A tune's breath mark, written at its bar line, or none. */
export const breathMarks = (tune: Tune): SheetMark[] =>
  tune.breath === undefined ? [] : [{ kind: 'breath', beat: tune.breath }]

/** The letters of a bracket's notes, for its button's name: "a run of steps: G, A, B, C". */
export function bracketName(tune: Tune, b: Bracket, clef: Clef): string {
  const notes = notesOf(tune, clef).slice(b.first, b.last + 1)
  return `${b.label}: ${notes.map((n) => n.letter).join(', ')}`
}

/** The figure's name for a tune: "Bass staff, two bars of 4/4: G, A, B, A, then G, B and a long D". */
export function tuneLabel(tune: Tune, clef: Clef): string {
  const staff = clef === 'bass' ? 'Bass' : 'Treble'
  const notes = notesOf(tune, clef)
  const sounds = beatsOf(tune)
  const said = notes.map((n, i) =>
    sounds[i].beats === 2 ? `a long ${n.letter}` : n.letter,
  )
  const bar1 = tune.bars[0].length
  const list = (xs: readonly string[]): string =>
    xs.length < 2
      ? xs.join('')
      : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
  const first = said.slice(0, bar1)
  const second = said.slice(bar1)
  return `${staff} staff, two bars of 4/4: ${first.join(', ')}, then ${list(second)}`
}

/** The steps' and Sing it's figure: two bars on the clef's staff, over the beat grid, with room for brackets and the syllables. */
export function tuneScene(
  tune: Tune,
  clef: Clef,
  o: { readonly counts?: boolean; readonly space?: number } = {},
): RhythmScene {
  const row: RhythmRow = {
    bars: tune.bars,
    bpm: BPM,
    notes: notesOf(tune, clef),
  }
  return {
    staff: clef,
    rows: [row],
    pads: true,
    strip: false,
    metreFirst: true,
    counts: o.counts === true,
    headroom: 1.6,
    // two rows of lag tags under the notes on a phone, clear of the pads' numbers
    footroom: 2.2,
    ...(o.space === undefined ? {} : { space: o.space }),
  }
}

/** The staff space a figure `w` px wide reads at: 10 px to a phone's 480, 13 to a tablet's 600, then 16 (FACTS 84). */
export const spaceFor = (w: number): number =>
  w > 600 ? 16 : w > 480 ? 13 : 10

// ---------------------------------------------------------------- Step 4's short figures

export type MarkId = 'dynamics' | 'hairpins' | 'staccato' | 'slur' | 'breath'

/** A short figure: quarter notes, or a half, with no time signature, no bar line and no beat grid. */
export interface Short {
  readonly id: Exclude<MarkId, 'breath'>
  readonly bars: readonly Bar[]
  readonly degrees: readonly number[]
  /** Each bar's first beat, so a figure's two groups sit a beat apart. */
  readonly starts?: readonly number[]
  /** Its beats across. */
  readonly beats: number
  /** Its marks, each written as its sound starts: by the sound it waits for. */
  readonly marks: readonly {
    readonly sound: number
    readonly mark: SheetMark
  }[]
  readonly shape: (sound: number) => SoundShape | undefined
}

/** A hairpin's swell then fade on so's half note: 0.3 to 1.0 over 1.0 s, then back over 1.0 s. */
export const SWELL = [
  { at: 0, level: P_LEVEL },
  { at: 1, level: F_LEVEL },
  { at: 2, level: P_LEVEL },
] as const

export const SHORTS: Readonly<Record<Short['id'], Short>> = {
  // mi, re, do quiet, a beat, then the same loud: 7.0 s (FACTS 41)
  dynamics: {
    id: 'dynamics',
    bars: [
      [Q, Q, Q],
      [Q, Q, Q],
    ],
    degrees: [2, 1, 0, 2, 1, 0],
    starts: [0, 4],
    beats: 7,
    marks: [
      { sound: 0, mark: { kind: 'p', at: 0 } },
      { sound: 3, mark: { kind: 'f', at: 3 } },
    ],
    shape: (s) => ({ level: s < 3 ? P_LEVEL : F_LEVEL }),
  },
  // so as a half note, swelling then fading: 2.0 s
  hairpins: {
    id: 'hairpins',
    bars: [[H]],
    degrees: [4],
    beats: 2,
    marks: [
      { sound: 0, mark: { kind: 'cresc', from: 0, to: 1, drawn: 0 } },
      { sound: 0, mark: { kind: 'dim', from: 1, to: 2, drawn: 0 } },
    ],
    shape: () => ({ levels: SWELL, seconds: 2 }),
  },
  // do, mi, so, each sounding 0.15 s of its beat: 3.0 s
  staccato: {
    id: 'staccato',
    bars: [[Q, Q, Q]],
    degrees: [0, 2, 4],
    beats: 3,
    marks: [0, 1, 2].map((i) => ({
      sound: i,
      mark: { kind: 'staccato', at: i } as const,
    })),
    shape: () => ({ seconds: STACCATO_SEC }),
  },
  // do, re, mi joined under a slur: 3.0 s
  slur: {
    id: 'slur',
    bars: [[Q, Q, Q]],
    degrees: [0, 1, 2],
    beats: 3,
    marks: [{ sound: 0, mark: { kind: 'slur', first: 0, last: 2, drawn: 0 } }],
    shape: (s) => (s < 2 ? { joined: true } : undefined),
  },
}

/** A short figure on the clef's staff: no 4/4, no bar line, no beat grid. */
export function shortScene(
  short: Short,
  clef: Clef,
  o: { readonly space?: number; readonly compact?: boolean } = {},
): RhythmScene {
  return {
    staff: clef,
    rows: [
      {
        bars: short.bars,
        bpm: BPM,
        notes: short.degrees.map((d) => scaleOf(clef)[d]),
        beats: short.beats,
        ...(short.starts === undefined ? {} : { starts: short.starts }),
      },
    ],
    bare: true,
    pads: false,
    strip: false,
    headroom: 1.6,
    footroom: 0.6,
    ...(o.compact === true ? { compact: true } : {}),
    ...(o.space === undefined ? {} : { space: o.space }),
  }
}
