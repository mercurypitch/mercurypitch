// ============================================================
// Lesson 28 song — the song in two parts, its sections, and every play's notes
// ============================================================
//
// The page's one song (FACTS 29 to 38), in G major and 4/4 at 72 beats a
// minute: a beat 0.833 s, a bar 3.333 s. A is eight bars in halves and
// wholes, Tavi's part over Merc's, a tenth apart mostly; the way it kept
// going is ten bars, bar 8 with E3 under G4, V to vi, then bars 1 and 2
// again; the plagal tag is two whole notes on G in both parts over the
// soft tone's IV, C3 C4 E4, then I, B3 D4; the bridge, B, is eight bars in
// quarters, never sung; and the song is A A B A, 32 bars. A section is a
// part a staff (kit/score-layout.ts), and a play is one run of notes
// (kit/run.ts), both parts note against note in Merc's "ooh" at 0.2, so
// notes that share an onset start in one timer task, the tag's chords in
// the same run in the soft tone at the note level (WEB-SPEC, Audio).

import type { Spelled } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { ScoreMarks, ScoreNote, ScoreScene, ScoreStaff, } from '@/features/lessons/kit/score-layout'
import { MERC_GAIN, NOTE_GAIN } from '@/features/lessons/kit/sound'
import type { KeySig } from '@/features/lessons/kit/staff-key'
import { midiOf } from '@/features/lessons/kit/staff-places'

/** The tempo, beats a minute, and its beat and bar, seconds (FACTS 38). */
export const BPM = 72
export const BEAT_SEC = 60 / BPM
export const BAR_SEC = 4 * BEAT_SEC
/** G major's one sharp. */
export const KEY: KeySig = { sign: 'sharp', count: 1 }
/** Do on each staff: G4 in Tavi's part, G3 in Merc's. */
export const DO_TAVI: Spelled = { letter: 'G', alter: 0, octave: 4 }
export const DO_MERC: Spelled = { letter: 'G', alter: 0, octave: 3 }

/** A spelled note from its name: "F#4". */
export function spell(name: string): Spelled {
  const m = /^([A-G])(#?)(\d)$/.exec(name)
  if (m === null) throw new Error(`not a note: ${name}`)
  return {
    letter: m[1] as Spelled['letter'],
    alter: m[2] === '#' ? 1 : 0,
    octave: Number(m[3]),
  }
}

/** Bars from "B4 A4 | A4w | G4q": a half note, a whole with w, a quarter with q. */
export function bars(text: string): ScoreNote[][] {
  return text.split('|').map((bar) =>
    bar
      .trim()
      .split(/\s+/)
      .map((t): ScoreNote => {
        const value = t.endsWith('w') ? 4 : t.endsWith('q') ? 1 : 2
        return { note: spell(t.replace(/[wq]$/, '')), value }
      }),
  )
}

/** A stretch of the song: each part's bars, Tavi's over Merc's. */
export interface Section {
  readonly tavi: readonly (readonly ScoreNote[])[]
  readonly merc: readonly (readonly ScoreNote[])[]
}

/** A, eight bars (FACTS 29). */
export const A: Section = {
  tavi: bars('B4 A4 | G4 B4 | C5 B4 | A4w | B4 C5 | D5 B4 | A4 F#4 | G4w'),
  merc: bars('G3 F#3 | E3 G3 | A3 G3 | D3w | G3 A3 | B3 G3 | D3 D3 | G3w'),
}

/** The way it kept going, ten bars: bar 8's E3 under G4, then bars 1 and 2 again (FACTS 33). */
export const GOING: Section = {
  tavi: [...A.tavi, ...A.tavi.slice(0, 2)],
  merc: [...A.merc.slice(0, 7), ...bars('E3w'), ...A.merc.slice(0, 2)],
}

/** The bridge, B, eight bars in quarters (FACTS 36). */
export const B: Section = {
  tavi: bars(
    'G4q A4q B4q C5q | D5q C5q B4q A4q | B4q C5q D5q B4q | C5 A4 | G4q A4q B4q G4q | A4q B4q C5q A4q | C5 B4 | A4w',
  ),
  merc: bars(
    'E3q F#3q G3q A3q | B3q A3q G3q F#3q | G3q A3q B3q G3q | A3 F#3 | E3q F#3q G3q E3q | F#3q G3q A3q F#3q | A3 G3 | D3w',
  ),
}

/** The plagal tag: both parts hold G for two whole notes (FACTS 35). */
export const TAG: Section = {
  tavi: bars('G4w | G4w'),
  merc: bars('G3w | G3w'),
}

/** The tag's chords in the soft tone, a whole note each: IV, C3 C4 E4, then I, B3 D4 (FACTS 35). */
export const TAG_CHORDS: readonly (readonly number[])[] = [
  [48, 60, 64],
  [59, 62],
]

/** The song, A A B A, 32 bars (FACTS 36). */
export const SONG: Section = join(A, A, B, A)

/** Sections one after another. */
export function join(...parts: readonly Section[]): Section {
  return {
    tavi: parts.flatMap((p) => p.tavi),
    merc: parts.flatMap((p) => p.merc),
  }
}

/** Bars `from` to `to` of a section, counted from 1, both ends in. */
export const barsOf = (s: Section, from: number, to: number): Section => ({
  tavi: s.tavi.slice(from - 1, to),
  merc: s.merc.slice(from - 1, to),
})

/** A section's length, seconds. */
export const secondsOf = (s: Section): number => s.tavi.length * BAR_SEC

/** The bar, counted from 1, a note starting `t` seconds into a play sounds in. */
export const barAt = (t: number): number => Math.floor(t / BAR_SEC + 1e-6) + 1

/** Each part's staff: Tavi's treble over Merc's bass. */
export function staffsOf(s: Section): [ScoreStaff, ScoreStaff] {
  return [
    { clef: 'treble', bars: s.tavi, tone: 'tavi', label: "Tavi's part" },
    { clef: 'bass', bars: s.merc, tone: 'merc', label: "Merc's part" },
  ]
}

/** A section on the score, its first bar numbered `first`, with its marks. */
export const sceneOf = (
  s: Section,
  first = 1,
  marks?: ScoreMarks,
): ScoreScene => ({ key: KEY, staffs: staffsOf(s), first, marks })

/** A part's bars as a run's notes from `t0`, in Merc's "ooh" at 0.2. */
export function partNotes(
  part: readonly (readonly ScoreNote[])[],
  t0 = 0,
): RunNote[] {
  let t = t0
  return part.flatMap((bar) =>
    bar.map((n): RunNote => {
      const dur = n.value * BEAT_SEC
      const note: RunNote = {
        t,
        midi: midiOf(n.note),
        dur,
        kind: 'merc',
        gain: MERC_GAIN,
      }
      t += dur
      return note
    }),
  )
}

/** Both parts as one run's notes, note against note, in time order. */
export function bothNotes(s: Section, t0 = 0): RunNote[] {
  return [...partNotes(s.tavi, t0), ...partNotes(s.merc, t0)].sort(
    (a, b) => a.t - b.t,
  )
}

/** The tag's chords as notes in the soft tone at the note level, from `t0`. */
export function chordNotes(t0: number): RunNote[] {
  return TAG_CHORDS.flatMap((chord, i) =>
    chord.map(
      (midi): RunNote => ({
        t: t0 + i * BAR_SEC,
        midi,
        dur: BAR_SEC,
        kind: 'soft',
        gain: NOTE_GAIN,
      }),
    ),
  )
}
