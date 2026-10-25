// ============================================================
// Lesson 10 sing guide — Merc's notes, the guide's rows and path, the readout
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 9). Merc sings do-mi-so, then do-me-so,
// from do = E3 for the lower voice and E4 for the higher (FACTS 63, 80),
// each note 1.2 s and the top note 1.8 s, with 1.6 s between the two
// chords: 10.0 s in all (FACTS 65). Move do shifts do a semitone at a
// time, up to four either way (the kit's `clampMove`), so the notes run
// from C3 to E♭4, or C4 to E♭5, inside every preset of the chosen voice
// (FACTS 64). Merc's notes are the kit's run notes (kit/run.ts), with no
// tone or level of their own, so the run's default sings them in Merc's
// "ooh".
//
// The guide has eight rows from do up to so: do, me, mi and so named, the
// four the chords skip faint, and syllables only, so no spelling goes
// wrong wherever Move do puts do (FACTS 64). Merc's path holds each note
// and glides into the next, as Lessons 4 and 6 draw theirs; the second
// chord's first point is marked `gap`, so nothing is drawn across the
// silence, and the breath mark sits at its start, 4.2 s in (FACTS 66). The
// readout names do in Lesson 4's names for the key, "do is E3", from "do
// is C3" to "do is A♭3", every sign spoken (FACTS 64).

import { majorScale } from '@/features/lessons/kit/major-scale'
import { clampMove } from '@/features/lessons/kit/move-do'
import { MAJOR_SOLFEGE, MINOR_SOLFEGE, } from '@/features/lessons/kit/names-modes'
import { nameHtml } from '@/features/lessons/kit/notes'
import type { RunNote } from '@/features/lessons/kit/run'
import type { GuidePoint, GuideRow } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { FIFTH, THIRD_OF } from './chords'

/** Do before Move do: E3 for the lower voice, E4 for the higher (FACTS 63). */
export const SING_DO: Readonly<Record<Voice, number>> = {
  lower: 52,
  higher: 64,
}

/** A note of Merc's, and the top note of each chord, seconds (FACTS 65). */
export const SING_NOTE = { each: 1.2, top: 1.8 } as const
/** The silence between the two chords, seconds (FACTS 65). */
export const GAP_SEC = 1.6
/** One chord sung: do, the third, then so held. */
const CHORD_SEC = 2 * SING_NOTE.each + SING_NOTE.top
/** The breath mark, seconds in: the start of the gap (FACTS 66). */
export const BREATH_SEC = CHORD_SEC
/** Both chords and the gap between them: 10.0 s (FACTS 65). */
export const SING_SEC = 2 * CHORD_SEC + GAP_SEC

/** A held note glides into the next over its last 0.05 s, as Lessons 4 and 6 draw their paths. */
const GLIDE_SEC = 0.05

/** The two chords Merc sings, as semitones above do: do-mi-so, then do-me-so (FACTS 65). */
const CHORDS: readonly (readonly number[])[] = [
  [0, THIRD_OF.major, FIFTH],
  [0, THIRD_OF.minor, FIFTH],
]

/** The rows the chords sing, by semitones above do (FACTS 64): degrees 1, 3 and 5, the third in either scale. */
const NAMED: ReadonlyMap<number, string> = new Map([
  [0, MAJOR_SOLFEGE[0]],
  [THIRD_OF.minor, MINOR_SOLFEGE[2]],
  [THIRD_OF.major, MAJOR_SOLFEGE[2]],
  [FIFTH, MAJOR_SOLFEGE[4]],
])

/** Do for the chosen voice and Move do, which is kept within its reach. */
export const singDo = (voice: Voice, shift: number): number =>
  SING_DO[voice] + clampMove(shift)

/** Chord `k`'s three notes from `doMidi`: do and the third, then so held. */
function chordNotes(doMidi: number, k: number): RunNote[] {
  const from = k * (CHORD_SEC + GAP_SEC)
  const chord = CHORDS[k]
  return chord.map((d, i) => ({
    t: from + i * SING_NOTE.each,
    midi: doMidi + d,
    dur: i === chord.length - 1 ? SING_NOTE.top : SING_NOTE.each,
  }))
}

/** Merc's six notes from `doMidi`, 10.0 s: E3, G♯3, B3, then E3, G3, B3 at do = E3 (FACTS 80). */
export const singNotes = (doMidi: number): RunNote[] =>
  CHORDS.flatMap((_, k) => chordNotes(doMidi, k))

/** The guide's eight rows, do up to so: do, me, mi and so named in syllables, the others faint. */
export function guideRows(doMidi: number): GuideRow[] {
  return Array.from({ length: FIFTH + 1 }, (_, k) => {
    const name = NAMED.get(k)
    return name === undefined
      ? { midi: doMidi + k, label: '', faint: true }
      : { midi: doMidi + k, label: `<span class="sol">${name}</span>` }
  })
}

/** Merc's path: each note held, gliding into the next, silent between the chords. */
export function guidePath(doMidi: number): GuidePoint[] {
  return CHORDS.flatMap((_, k) =>
    chordNotes(doMidi, k).flatMap((n, i, chord): GuidePoint[] => {
      const end = n.t + n.dur
      return [
        // the second chord starts a new phrase: nothing drawn across the gap
        k > 0 && i === 0
          ? { t: n.t, midi: n.midi, gap: true }
          : { t: n.t, midi: n.midi },
        { t: i === chord.length - 1 ? end : end - GLIDE_SEC, midi: n.midi },
      ]
    }),
  )
}

/** The readout, as markup: "do is E3", in Lesson 4's names, every sign spoken. */
export const readoutHtml = (voice: Voice, shift: number): string =>
  `do is ${nameHtml(majorScale(singDo(voice, shift))[0])}`
