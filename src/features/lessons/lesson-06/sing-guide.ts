// ============================================================
// Lesson 6 sing guide — the two versions, their rows, path and readout
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 6 and 10). Merc sings the tune's first two
// lines from do = D3 for the lower voice, D4 for the higher, then again
// three semitones higher (FACTS 56, 70), at 0.6 s a crotchet and 1.2 s a
// minim, 9.6 s a version (FACTS 58). Move do shifts both together, up to
// four semitones either way, so they stay three apart (FACTS 57). The guide
// has ten rows from do up to la, the six the tune sings named do to la and
// the four between them faint, with no letters: the readout names the two
// starts instead, spelled as the tune line spells them, "do is D3, then
// F3", spoken "do is D 3, then F 3". Merc's path holds each note and glides
// into the next, with a breath mark after "star", the end of the first
// line, 4.8 s in (FACTS 58a). Move do's reach and the count-in, do of the
// version last played, once and softly, for its one second (FACTS 70), are
// the kit's (kit/move-do.ts).

import { clampMove } from '@/features/lessons/kit/move-do'
import { hz, nameHtml } from '@/features/lessons/kit/notes'
import type { GuidePoint, GuideRow } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import type { NoteEvent } from './examples'
import { lineNotes, SING_BEAT_SEC, timed } from './examples'
import { lineNames, SOLFEGE, TWINKLE } from './melody'

export type VersionNo = 1 | 2

/** The first version's do: D3 for the lower voice, D4 for the higher. */
export const FIRST_DO: Readonly<Record<Voice, number>> = {
  lower: 50,
  higher: 62,
}
/** The second version sits this many semitones above the first. */
export const SECOND_UP = 3
/** A version's length: twelve crotchets and two minims at 0.6 s a crotchet. */
export const VERSION_SEC = 9.6
/** The breath mark, seconds in: after "star", the first line's minim. */
export const BREATH_SEC = 4.8

/** A held note glides into the next over its last 0.05 s, as Lesson 4's path does. */
const GLIDE_SEC = 0.05

/** Do of a version, for the chosen voice and Move do. */
export function versionDo(
  voice: Voice,
  version: VersionNo,
  shift: number,
): number {
  return FIRST_DO[voice] + clampMove(shift) + (version === 2 ? SECOND_UP : 0)
}

/** A version's fourteen notes from `doMidi`, 9.6 s. */
export const versionNotes = (doMidi: number): NoteEvent[] =>
  timed(
    TWINKLE.flatMap((line) => lineNotes(line, doMidi)),
    SING_BEAT_SEC,
  )

/** The semitones above do of the six rows the tune sings: do, re, mi, fa, so, la. */
const NAMED = [0, 2, 4, 5, 7, 9]

/** The guide's ten rows, do up to la: six named in do-re-mi, the four between them faint. */
export function guideRows(doMidi: number): GuideRow[] {
  return Array.from({ length: 10 }, (_, k) => {
    const i = NAMED.indexOf(k)
    return i === -1
      ? { midi: doMidi + k, label: '', faint: true }
      : { midi: doMidi + k, label: `<span class="sol">${SOLFEGE[i]}</span>` }
  })
}

/** Merc's path: each note held, gliding into the next, one phrase with no rest. */
export function guidePath(doMidi: number): GuidePoint[] {
  const notes = versionNotes(doMidi)
  return notes.flatMap((e, i) => {
    const end = e.at + e.dur
    return [
      { t: e.at, midi: e.midi },
      { t: i === notes.length - 1 ? end : end - GLIDE_SEC, midi: e.midi },
    ]
  })
}

/** Do's spelling, as the tune line spells its start: B♭2, D♭3. */
const doName = (doMidi: number) => lineNames(TWINKLE[0], doMidi)[0]

/** The readout, as markup: "do is D3, then F3", every sign spoken. */
export const readoutHtml = (voice: Voice, shift: number): string =>
  `do is ${nameHtml(doName(versionDo(voice, 1, shift)))}, then ${nameHtml(doName(versionDo(voice, 2, shift)))}`

/** The ring's label: do's name and frequency, "Do: D3 · 147 Hz". */
export const ringLabel = (doMidi: number): string =>
  `Do: ${nameHtml(doName(doMidi))} · ${Math.round(hz(doMidi))} Hz`

/** The guide's accessible name, in words. */
export const GUIDE_LABEL =
  "Ten rows from do up to la, pitch as height, six of them named do, re, mi, fa, so and la: Merc's path climbs from do to so and la, falls back to so, then steps down to do, with a breath mark after “star”."
