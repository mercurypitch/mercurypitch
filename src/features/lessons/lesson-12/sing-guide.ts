// ============================================================
// Lesson 12 sing guide — Merc's notes and chords at a Move do, the guide's rows and path
// ============================================================
//
// Pure (WEB-SPEC, Toys 6; Tests 9). Merc sings the loop's roots, do, so,
// la, fa and do, from do = C4 for the lower voice and C5 for the higher,
// over the chords I, V, vi, IV and I (FACTS 59, 61, 73): sounds.ts's
// sing-along, which this file moves with Move do. Move do moves everything
// a semitone at a time, Merc's notes, the chords, the count-in on do and
// the readout together (FACTS 60, 73), four lower and three higher: a
// fourth step higher would put the lower voice's top do on E4, the bass
// preset's very top (FACTS 60; spec Decisions 8). That reach is plain data
// here. The kit's Move do goes four either way today; once it takes a
// reach for each side, the page hands it this one. The clamp is the kit's,
// so every function here takes a shift as it comes and never clamps it.
//
// The guide has eight rows from fa up to do, a semitone apart: fa, so, la
// and do named, in syllables only, so no spelling goes wrong wherever Move
// do puts do, and the four the line skips faint (Toys 6). Merc's path
// holds each root for its length, 1.6 s or the last do's 2.0 s, and falls
// silent for the 0.4 s after it, so every note after the first is marked
// `gap` and nothing is drawn across a silence: 10.0 s in all (FACTS 61).
// The breath mark sits in the gap after la, 5.6 s in (FACTS 62). The
// readout names do and the line in Lesson 4's names for the key, in words
// and in markup, from lines.ts (FACTS 60).

import type { GuidePoint, GuideRow } from '@/features/lessons/kit/slide-guide'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { readoutHtml, readoutWords } from './lines'
import { BAR_SEC, LOOP_DEGREES } from './music'
import type { SoundNote } from './sounds'
import { GUIDE, inKey, SING, singAlong } from './sounds'

/** Move do's reach each side, semitones: four lower, three higher (FACTS 60; spec Decisions 8). */
export const REACH = { lower: 4, higher: 3 } as const

/** The breath mark, seconds in: the gap after la, 2 x 2.0 + 1.6 = 5.6 s (FACTS 62). */
export const BREATH_SEC = 2 * BAR_SEC + SING.note

/** The line's degrees: do, so, la, fa, then do again (FACTS 26, 61). */
const LINE_DEGREES = [...LOOP_DEGREES, 0]

/** The four rows the line sings, by degree, in syllables (WEB-SPEC, Toys 6). */
const SYLLABLE: ReadonlyMap<number, string> = new Map([
  [0, 'do'],
  [3, 'fa'],
  [4, 'so'],
  [5, 'la'],
])

/** Play Merc's notes: the sing-along for a voice, every note and chord moved `shift` semitones (FACTS 73). */
export const singAlongAt = (voice: Voice, shift: number): SoundNote[] =>
  inKey(singAlong(voice), shift)

/** The chords under the guide's sweep, alone, moved `shift` semitones with do (FACTS 73). */
export const guideChordsAt = (shift: number): SoundNote[] => inKey(GUIDE, shift)

/** Merc's five notes, do so la fa do, for a voice at a shift: C4 G3 A3 F3 C4 for the lower at 0 (FACTS 59). */
export const sungNotes = (voice: Voice, shift: number): SoundNote[] =>
  singAlongAt(voice, shift).filter((n) => n.kind === 'merc')

/** Do for a voice at a shift: what the count-in plays and the readout names. */
export const singDo = (voice: Voice, shift: number): number =>
  sungNotes(voice, shift)[0].midi

/** The guide's eight rows, fa up to do: fa, so, la and do named in syllables, the four between faint. */
export function guideRows(voice: Voice, shift: number): GuideRow[] {
  const line = sungNotes(voice, shift)
  const named = new Map(
    line.map((n, i) => [n.midi, SYLLABLE.get(LINE_DEGREES[i]) ?? '']),
  )
  const lo = Math.min(...named.keys())
  const hi = Math.max(...named.keys())
  return Array.from({ length: hi - lo + 1 }, (_, k) => {
    const midi = lo + k
    const name = named.get(midi)
    return name === undefined
      ? { midi, label: '', faint: true }
      : { midi, label: `<span class="sol">${name}</span>` }
  })
}

/** Merc's path: each root held for its length, then silent, every note after a silence marked `gap`. */
export function guidePath(voice: Voice, shift: number): GuidePoint[] {
  return sungNotes(voice, shift).flatMap((n, i): GuidePoint[] => [
    i === 0 ? { t: n.t, midi: n.midi } : { t: n.t, midi: n.midi, gap: true },
    { t: n.t + n.dur, midi: n.midi },
  ])
}

/** The readout at a shift, as markup with every sign spoken and in words: "do is A♭3: A♭3, E♭3, F3, D♭3, A♭3". */
export function readoutAt(
  voice: Voice,
  shift: number,
): { readonly html: string; readonly words: string } {
  const doMidi = singDo(voice, shift)
  return { html: readoutHtml(doMidi), words: readoutWords(doMidi) }
}
