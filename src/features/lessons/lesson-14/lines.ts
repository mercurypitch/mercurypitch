// ============================================================
// Lesson 14 lines — what the song line and its toys say, in words
// ============================================================
//
// Every line the page writes at run time, from LESSON.md and the WEB-SPEC
// (Toys 1, 2 and 4), in one place so each is tested (lines.test.ts) and
// passed through the guided-voice claims check. The figures' accessible
// names and every live region use words only: a note is named in Lesson 4's
// spelling with its sign spoken ("F sharp 3"), never the sign itself.

import { wordName } from '@/features/lessons/kit/notes'
import type { VerseNote } from '@/features/lessons/kit/twinkle'
import { BEAT_SEC, lineBeats, VERSE } from '@/features/lessons/kit/twinkle'
import type { TakeId } from './song'
import { SOLFEGE, spelledDegree } from './song'

/** A word as the page quotes it. */
export const quoted = (w: string): string => `“${w}”`

/** A note in spoken words: "so, A3". */
const said = (doMidi: number, degree: number): string =>
  `${SOLFEGE[degree]}, ${wordName(spelledDegree(doMidi, degree))}`

/** A line's words as the caption gives them: "Twinkle, twinkle, little star,". */
export function lineWords(line: readonly VerseNote[]): string {
  let out = ''
  for (const n of line) {
    const word = n.printed
    if (out === '' || out.endsWith('-')) out = out.replace(/-$/, '') + word
    else out += ` ${word}`
  }
  return out.charAt(0).toUpperCase() + out.slice(1)
}

/** Phrase `k`'s caption, its words (0 to 5). */
export const phraseCaption = (k: number): string => lineWords(VERSE[k])

/** The long note each phrase ends on, as the status names it. */
export const longNote = (k: number): string =>
  VERSE[k][VERSE[k].length - 1].syllable.toLowerCase()

/** Step 1's status as a phrase reaches its long note. */
export const phraseEndLine = (k: number): string =>
  `Phrase ${k + 1} ends on its long note: ${quoted(longNote(k))}.`

/**
 * A phrase's notes in spoken words, a repeated note said once with
 * "twice", the long note last and "held": "Phrase 1, seven notes: do, D3,
 * twice; so, A3, twice; la, B3, twice; then so, A3, held".
 */
export function phraseSummary(k: number, doMidi: number): string {
  const line = VERSE[k]
  const parts: string[] = []
  let i = 0
  while (i < line.length - 1) {
    let j = i
    while (j + 1 < line.length - 1 && line[j + 1].degree === line[i].degree) j++
    const n = j - i + 1
    parts.push(`${said(doMidi, line[i].degree)}${n === 2 ? ', twice' : ''}`)
    i = j + 1
  }
  const last = line[line.length - 1]
  return `Phrase ${k + 1}, seven notes: ${parts.join('; ')}; then ${said(doMidi, last.degree)}, held`
}

/** The whole song's summary, Step 1 and the closing card's still. */
export const SONG_SUMMARY =
  'The whole song: six phrases of seven notes, each ending on its long note, with a breath mark after each of the first five'

/** The closing card's still, as an image with a text alternative (WEB-SPEC, Toys 1, Still). */
export const STILL_ALT =
  'The whole song as a line: six phrases, a breath mark after each of the first five, and the swell on each “star” drawn in light.'

/** Step 3's summary: so's band twice, the swell's window and the push's. */
export const swellSummary = (doMidi: number): string =>
  `So, ${wordName(spelledDegree(doMidi, 4))}, twice: the swell, then Lesson 5's push, each with its loudness under it`

/** What the chart says while a take of Merc's plays and after it (WEB-SPEC, Toys 1, Compact). */
export const TAKE_SAID: Readonly<Record<TakeId, string>> = {
  1: 'Take 1: phrase 1 on “ooh”, with a breath between “little” and “star”',
  2: 'Take 2: the same seven notes, with the breath after “star”. “Star” grows louder, then softer, its light growing and fading, and its line stays in its band.',
}

/** Step 2's status as each breath lights. */
export const BREATH_LINE: Readonly<Record<TakeId, string>> = {
  1: 'Take 1 breathes between “little” and “star”: its time comes from “little”.',
  2: 'Take 2 breathes after “star”: its time comes from “star”.',
}

/** Step 4's status as each phrase's last note ends (FACTS 44). */
export const CADENCE_LINE: Readonly<Record<1 | 2, string>> = {
  1: 'Phrase 2 ends V to I, on do: a perfect cadence.',
  2: 'Phrase 3 ends on V, on re: an imperfect cadence.',
}

/** The moment on take 2 the scrub bar names: its seconds and the syllable there. */
export function scrubText(t: number, total = 6): string {
  const s = `${t.toFixed(1)} seconds of ${String(total)}`
  const note = lineBeats(VERSE[0]).findIndex(
    (b) => t >= b.from * BEAT_SEC && t < b.to * BEAT_SEC,
  )
  // take 2 breathes from 5.7 s, taking its time from "star"
  if (t >= 5.7 || note < 0) return `${s}: the breath`
  const word = quoted(VERSE[0][note].printed.replace(/[,.!]$/, ''))
  return Math.abs(t - 5.1) < 0.05
    ? `${s}: ${word}, at its loudest`
    : `${s}: ${word}`
}

/** The live chart's summary: where do is, in Lesson 4's spelling (WEB-SPEC, Toys 4). */
export const liveSummary = (doMidi: number): string =>
  `Do is ${wordName(spelledDegree(doMidi, 0))}`

/** The live chart's summary after a take, its range in spoken names. */
export function takeSummary(take: number, low: string, high: string): string {
  const range =
    low === high ? `at about ${low}` : `from about ${low} to ${high}`
  return `Your take ${String(take)}, drawn as a line over Merc's bands, ${range}. Gaps in the line are where we heard no voice.`
}

/** The seek bar's words: the second and the syllable under it, "2.4 seconds of 6.2: “lit-”". */
export function seekText(
  t: number,
  total: number,
  syllable: string | null,
): string {
  const s = `${t.toFixed(1)} seconds of ${total.toFixed(1)}`
  return syllable === null ? s : `${s}: ${quoted(syllable)}`
}
