// ============================================================
// Lesson 18 reads — what each play draws, beat by beat
// ============================================================
//
// The timing of every play on the reading staff, pure, so each is tested
// beat by beat (WEB-SPEC, Toys 1 and 2; FACTS 35, 38, 41, 76):
//
// - The note-by-note read: in the hero, do for 1.0 s and 0.4 s of quiet
//   first; then the count-in, four clicks, beat 1 higher; then the two
//   bars over the click, each note named on one beat, its syllable written
//   over it, and sung on the next, so do, re, mi and re sound one, two,
//   three and four beats after their places, on beats 2, 4, 6 and 8, and
//   the bars end before do, mi and so.
// - Merc's way and the tunes: a bracket fades in as the cursor reaches its
//   pattern's first note.
// - Step 4's short figures: each mark written as its sound starts, a
//   hairpin drawn as far as its glide has gone and a slur as far as its
//   notes have sounded, and the sounding note's level, loudness as
//   brightness.
//
// Beats count from bar 1's first beat (or a short figure's first note), at
// 60 BPM a second each.

import type { Bar as ClockBar, Hit } from '@/features/lessons/kit/beat-clock'
import type { Spelled } from '@/features/lessons/kit/notes'
import type { Bracket, SheetMark } from '@/features/lessons/kit/read-marks'
import type { MarkId, Short, Tune } from './tunes'
import { beatsOf, BPM, BREATH_NOTE_SEC, breathSound, COLD, SYLLABLES, } from './tunes'

/** The count-in: one bar of the click, four beats. */
export const COUNT_IN = 4
/** The hero's do, 1.0 s, and the quiet after it, 0.4 s, in beats at 60 BPM. */
export const DO_BEATS = 1
export const QUIET_BEATS = 0.4
/** The notes the note-by-note read reaches before the bars end: do, re, mi and re. */
export const NAMED = 4

/** What the note-by-note read does on its beats. */
export type ByNameHit =
  | { readonly k: 'do' }
  | { readonly k: 'click'; readonly high: boolean }
  | { readonly k: 'name'; readonly i: number }
  | { readonly k: 'sing'; readonly i: number }

const clicks = (): Hit<ByNameHit>[] =>
  [0, 1, 2, 3].map((beat) => ({
    beat,
    data: { k: 'click', high: beat === 0 },
  }))

/**
 * The note-by-note read on the beat clock: the count-in, with do and its
 * quiet before it in the hero, then the two bars, note `i` named on beat
 * 2i and sung on beat 2i + 1.
 */
export function byNameBars(withDo: boolean): ClockBar<ByNameHit>[] {
  const first: ClockBar<ByNameHit> = {
    beats: COUNT_IN,
    hits: [
      ...(withDo
        ? [{ beat: -(DO_BEATS + QUIET_BEATS), data: { k: 'do' } as const }]
        : []),
      ...clicks(),
    ],
  }
  const bar = (n: number): ClockBar<ByNameHit> => ({
    beats: 4,
    hits: [
      ...clicks(),
      ...[0, 1].flatMap((j): Hit<ByNameHit>[] => {
        const i = n * 2 + j
        return [
          { beat: j * 2, data: { k: 'name', i } },
          { beat: j * 2 + 1, data: { k: 'sing', i } },
        ]
      }),
    ],
  })
  return [first, bar(0), bar(1)]
}

/** The seconds from the press the hero's do waits for, so it sounds 0.1 s after it. */
export const DO_LEAD = DO_BEATS + QUIET_BEATS + 0.1

/** Sing it's take opens this many beats before bar 1's first beat: 0.5 s after the last click starts (FACTS 82). */
export const OPEN_BEATS = 0.5

/** A note's words when tapped: "B3, mi, a quarter note". */
export function noteWords(n: Spelled, degree: number, beats: number): string {
  return `${n.letter}${n.octave}, ${SYLLABLES[degree]}, ${beats === 2 ? 'a half note' : 'a quarter note'}`
}

/** The tap pad's readout from the fourth tap: "Your taps: 60 BPM". */
export const tapTempoLine = (bpm: number): string => `Your taps: ${bpm} BPM`

/** The name written over note `i` as Merc names it: its syllable. */
export const nameOf = (i: number): string => SYLLABLES[COLD.degrees[i]]

/** The tag under a note sung `i + 1` beats late: "1 beat late" to "4 beats late". */
export const lateTag = (i: number): string =>
  `${i + 1} ${i === 0 ? 'beat' : 'beats'} late`

/** What a polite region says once each read has been heard (WEB-SPEC, Toys 1 and 2). */
export const READ_LINES = {
  heroByName:
    'Merc named each note on one beat and sang it on the next: G, A, B and A, each further behind the beat. The bars ended before G, B and D.',
  heroWay:
    'Merc read a run of steps, G, A, B, A, then do-mi-so, G, B, D, on the beat.',
  byName:
    'Read note by note: four notes sounded, each further behind the beat. Do, mi and so never came.',
  way: "Read Merc's way: a run of steps, then do-mi-so, on the beat.",
} as const

/** What a polite region says of each mark's example once it has been heard (WEB-SPEC, Toys 2). */
export const MARK_LINES: Readonly<Record<MarkId, string>> = {
  dynamics: 'p, then f: the same three notes, quiet then loud.',
  hairpins: 'Hairpins: so grows louder, then quieter again.',
  staccato: 'Staccato: do, mi and so, each short, with silence between.',
  slur: 'Slur: do, re and mi joined, with no gap between them.',
  breath:
    'Breath mark: the last do of bar 1 shortened, a breath, and bar 2 on its beat.',
}

/** What the tunes' plays say once heard. */
export const TUNE_LINES = {
  a: 'Tune A: a run of steps, do re mi fa, then a repeated note, so and so.',
  b: 'Tune B: do-mi-so going down, so mi do, then a repeated note, re and re.',
  countIn: 'Tune C, counted in: one bar of four clicks, then the two bars.',
} as const

/** Where the cursor sits `beats` into the bars: at tempo, or on each beat's start under reduced motion; null before bar 1. */
export function cursorAt(
  beats: number,
  total: number,
  jumps: boolean,
): number | null {
  if (beats < 0) return null
  const b = Math.min(total, beats)
  return jumps ? Math.floor(b + 1e-6) : b
}

/** The brackets a play has reached `beats` into its bars: each from its pattern's first note. */
export function bracketsAt(tune: Tune, beats: number): Bracket[] {
  const sounds = beatsOf(tune)
  return tune.brackets.filter((b) => sounds[b.first].beat <= beats + 1e-6)
}

/** Each short figure's sounds' first beats. */
export function shortBeats(short: Short): number[] {
  const out: number[] = []
  let end = 0
  short.bars.forEach((bar, k) => {
    let at = short.starts?.[k] ?? end
    for (const w of bar) {
      out.push(at)
      at += w.value
    }
    end = at
  })
  return out
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** A short figure's marks `beats` into it: each written as its sound starts, a hairpin or a slur drawn as far as it has gone. */
export function marksAt(short: Short, beats: number): SheetMark[] {
  const starts = shortBeats(short)
  const out: SheetMark[] = []
  for (const { sound, mark } of short.marks) {
    if (starts[sound] > beats + 1e-6) continue
    if (mark.kind === 'cresc' || mark.kind === 'dim') {
      const drawn = clamp01((beats - mark.from) / (mark.to - mark.from))
      if (beats + 1e-6 >= mark.from) out.push({ ...mark, drawn })
    } else if (mark.kind === 'slur') {
      const from = starts[mark.first]
      const to = starts[mark.last] + 1
      out.push({ ...mark, drawn: clamp01((beats - from) / (to - from)) })
    } else out.push(mark)
  }
  return out
}

/** Every mark of a short figure, drawn whole: after its play, or a figure written at once. */
export const marksDrawn = (short: Short): SheetMark[] =>
  marksAt(short, Number.POSITIVE_INFINITY)

/** The sounding note's level `beats` into a short figure, as its light: null where it sounds at the voice's own level. */
export function levelAt(short: Short, beats: number): number | null {
  const starts = shortBeats(short)
  let sound = -1
  starts.forEach((b, i) => {
    if (b <= beats + 1e-6) sound = i
  })
  if (sound === -1) return null
  const shape = short.shape(sound)
  if (shape?.levels !== undefined) {
    const t = ((beats - starts[sound]) * 60) / BPM
    const pts = shape.levels
    if (t <= pts[0].at) return pts[0].level
    for (let k = 1; k < pts.length; k++)
      if (t <= pts[k].at) {
        const a = pts[k - 1]
        const z = pts[k]
        return a.level + ((z.level - a.level) * (t - a.at)) / (z.at - a.at)
      }
    return pts[pts.length - 1].level
  }
  return shape?.level ?? null
}

/** When a tune's breath mark is written, beats into its bars: as the breath's silence starts, 0.6 s into the note before it. */
export function breathAt(tune: Tune): number | null {
  const i = breathSound(tune)
  if (i === null) return null
  return beatsOf(tune)[i].beat + (BREATH_NOTE_SEC * BPM) / 60
}

/** The play lengths, s, for the tests and the coach's list (FACTS 35, 38, 41, 76). */
export const PLAY_SECONDS = {
  heroByName: DO_BEATS + QUIET_BEATS + COUNT_IN + 8,
  byName: COUNT_IN + 8,
  way: COUNT_IN + 8,
  tune: 8,
  countIn: COUNT_IN + 8,
} as const
