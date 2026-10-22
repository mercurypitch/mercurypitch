// ============================================================
// Take reading — one sung note against Merc's, and the count of a run
// ============================================================
//
// Pure, so every line a viewer can be shown is tested on synthetic frames
// (take.test.ts). A take is the raw frames of one sung reply; its voiced
// frames come from Voice Mirror's own `preprocess` (confidence floor and
// median filter), its distance is folded into Merc's octave with Voice
// Mirror's `foldCents`, and its band uses Voice Mirror's edges, so a take
// this page calls "in the band" is one Voice Mirror would call a hit.
//
// The first 0.3 s after voicing starts is the attack and is dropped. A take
// with less than 0.6 s of voice left is not steady, and says so: it never
// gives a low reading (REQ-GVC-031). The octave line ("You sang it an
// octave lower: same note.") appears only within 50 cents, where the
// nearest note is still Merc's, so a different note is never called the
// same one. The lines describe the sound and nothing else (REQ-GVC-045).
//
// A run counts each note by its last steady take: a later steady take
// replaces an earlier one, a take that was not steady replaces nothing, and
// a note with no steady take is left out, never counted as a miss
// (REQ-GVC-041). Loaded with the listener, after Start: it reaches Voice
// Mirror's scorer, which a page's first paint must not.
//
// A siren (Lesson 7) is read for where it sat, never how far it went
// (`readSiren`): the attack comes off the raw frames, Voice Mirror's own
// range reader finds the notes it dwelt on, and the page lights their middle
// half, the window the Vocal Range Test picks its match notes from
// (`middleHalf`), or the one centre note under three semitones. Neither end
// of the siren and no span is ever named (Lesson 7 WEB-SPEC, Toys 4).

import type { F0Frame } from '@/lib/mirror/metrics'
import { computeRange, foldCents, median, middleHalf, preprocess, } from '@/lib/mirror/metrics'
import { estimateFrameHop } from '@/lib/pitch-measurements'
import type { Band } from './band-words'
import { bandOf, gapWords, inBand } from './band-words'
import { sharpOf, signName, wordName } from './notes'

/** Seconds of the attack, dropped from every take. */
export const ATTACK_SEC = 0.3
/** Seconds of voice a take needs after the attack to be read. */
export const STEADY_SEC = 0.6
/** Tries a note allows: more would add singing, not learning (FACTS 16). */
export const MAX_TRIES = 3
/** Within this many cents an octave match is still Merc's note, and is named as one. */
const OCTAVE_LINE_CENTS = 50

export interface TakeReading {
  /** Enough steady voice to read. */
  readonly steady: boolean
  /** The distance from Merc's note, folded into his octave, signed: −600 to +600. */
  readonly d: number | null
  /** Whole octaves between the voice and Merc's note: −1 is an octave lower. */
  readonly octaves: number
  readonly band: Band | null
  /** Inside Merc's band, ±35 cents. */
  readonly landed: boolean
  /** The reading, as the page says it. */
  readonly line: string
  /** "You sang it an octave lower: same note.", only within 50 cents of Merc's note. */
  readonly octaveLine: string | null
}

export const NOT_STEADY_LINE =
  "We didn't hear a steady note that time. Try again at about speaking volume."

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six']

/** "About a semitone below", "About two semitones above": a distance past the band, in semitones. */
export function semitonesAway(d: number): string {
  const way = d > 0 ? 'above' : 'below'
  const size = Math.abs(d)
  if (size <= 150) return `About a semitone ${way}`
  const n = Math.min(6, Math.round(size / 100))
  return `About ${NUMBER_WORDS[n]} semitones ${way}`
}

/** The reading's line for a folded distance `d`. */
export function readingLine(d: number): string {
  const band = bandOf(d)
  if (band === 'middle') return `Right in the middle: ${gapWords(d)}.`
  if (band === 'band') return `In the band: ${gapWords(d)}.`
  if (band === 'close')
    return `Close: ${gapWords(d)}. Listen again, then aim a touch ${d > 0 ? 'lower' : 'higher'}.`
  return `${semitonesAway(d)}, nearer a different note. Listen again, then slide ${d > 0 ? 'down' : 'up'} to the band.`
}

/** "You sang it an octave lower: same note.", or null where it would not be true. */
export function octaveLine(d: number, octaves: number): string | null {
  if (octaves === 0 || Math.abs(d) > OCTAVE_LINE_CENTS) return null
  const n = Math.abs(octaves)
  const size = n === 1 ? 'an octave' : `${NUMBER_WORDS[Math.min(n, 6)]} octaves`
  return `You sang it ${size} ${octaves < 0 ? 'lower' : 'higher'}: same note.`
}

const notSteady: TakeReading = {
  steady: false,
  d: null,
  octaves: 0,
  band: null,
  landed: false,
  line: NOT_STEADY_LINE,
  octaveLine: null,
}

/** Reads one take: the raw frames of a sung reply against Merc's note (MIDI). */
export function readTake(
  frames: readonly F0Frame[],
  target: number,
): TakeReading {
  const voiced = preprocess(frames)
  if (voiced.length === 0) return notSteady
  const onset = voiced[0].t
  const kept = voiced.filter((v) => v.t >= onset + ATTACK_SEC)
  if (kept.length * estimateFrameHop(voiced) < STEADY_SEC) return notSteady
  const diffs = kept.map((v) => v.cents - target * 100)
  const d = median(diffs.map(foldCents))
  const octaves = Math.round(median(diffs) / 1200)
  return {
    steady: true,
    d,
    octaves: octaves === 0 ? 0 : octaves,
    band: bandOf(d),
    landed: inBand(d),
    line: readingLine(d),
    octaveLine: octaveLine(d, octaves),
  }
}

/** Whether a note that has had `tries` takes may have another (Again), or only Next. */
export const canTryAgain = (tries: number): boolean => tries < MAX_TRIES

/** What a run of notes adds up to: the notes heard, and how many of them landed. */
export interface RunCount {
  readonly heard: number
  readonly landed: number
  /** The notes in the run. */
  readonly of: number
}

/** Counts a run, each note by its last steady take (`takes[n]` is note n's takes, in order). */
export function countRun(takes: readonly (readonly TakeReading[])[]): RunCount {
  let heard = 0
  let landed = 0
  for (const note of takes) {
    const last = [...note].reverse().find((t) => t.steady)
    if (last === undefined) continue
    heard++
    if (last.landed) landed++
  }
  return { heard, landed, of: takes.length }
}

export const NONE_HEARD_LINE = "We didn't hear a steady note this time."
export const TRICKY_LINE = "If that felt tricky, good: that's learning."

/** The count as the page says it, or null when no note was heard (then `NONE_HEARD_LINE`). */
export function countLine(c: RunCount): string | null {
  if (c.heard === 0) return null
  if (c.heard === c.of)
    return `This time, ${c.landed} of your ${c.of} notes landed in the band.`
  return `This time, ${c.landed} of the ${c.heard} ${c.heard === 1 ? 'note' : 'notes'} we heard landed in the band.`
}

/** The playbook's rule 15 line follows a count only when fewer than all the heard notes landed. */
export const trickyAfter = (c: RunCount): boolean =>
  c.heard > 0 && c.landed < c.heard

/** Seconds of voice a siren needs after the attack to be read. */
export const SIREN_STEADY_SEC = 1
/** Under this many semitones held, a siren's band is its one centre note. */
export const SIREN_CENTRE_UNDER = 3

/** What a siren's reading lit: its middle half, its one centre note, or nothing. */
export type SirenKind = 'none' | 'unsteady' | 'half' | 'centre'

export interface SirenReading {
  readonly kind: SirenKind
  /** Any voice at all: a take with none asks no feeling question. */
  readonly heard: boolean
  /** The lit band, MIDI, low to high (one note for the centre); null when nothing was lit. */
  readonly band: { readonly low: number; readonly high: number } | null
  /** The reading, as the page shows it, its notes in signs: "about G3 to C♯4". */
  readonly line: string
  /** The same line in words, for a screen reader: "about G3 to C sharp 4". */
  readonly spoken: string
}

export const SIREN_NONE_LINE =
  "We didn't hear you start that time. Hum “ng” as the ring turns."
export const SIREN_UNSTEADY_LINE = "We didn't hear a steady siren that time."

type Namer = (midi: number) => string
const inSigns: Namer = (m) => signName(sharpOf(m))
const inWords: Namer = (m) => wordName(sharpOf(m))

/** The reading line for a band, in signs or in words. */
export function sirenLine(
  band: { readonly low: number; readonly high: number },
  name: Namer = inSigns,
): string {
  if (band.low === band.high)
    return `The lit band is the middle of your siren: about ${name(band.low)}.`
  return `The lit band is the middle half of your siren: about ${name(band.low)} to ${name(band.high)}.`
}

/** The band of a siren that held `lowMidi` to `highMidi`: the centre under three semitones, else the middle half. */
export function sirenBand(
  lowMidi: number,
  highMidi: number,
): { low: number; high: number } {
  if (highMidi - lowMidi < SIREN_CENTRE_UNDER) {
    const centre = Math.round((lowMidi + highMidi) / 2)
    return { low: centre, high: centre }
  }
  return middleHalf(lowMidi, highMidi)
}

const sirenOf = (kind: 'none' | 'unsteady', line: string): SirenReading => ({
  kind,
  heard: kind !== 'none',
  band: null,
  line,
  spoken: line,
})

/** Reads one siren: the take's raw frames, from the moment it opened. */
export function readSiren(frames: readonly F0Frame[]): SirenReading {
  const voiced = preprocess(frames)
  if (voiced.length === 0) return sirenOf('none', SIREN_NONE_LINE)
  // the attack comes off the raw frames, which the range reader preprocesses itself
  const onset = voiced[0].t
  const trimmed = frames.filter((f) => f.t >= onset + ATTACK_SEC)
  const kept = preprocess(trimmed)
  if (kept.length * estimateFrameHop(kept) < SIREN_STEADY_SEC)
    return sirenOf('unsteady', SIREN_UNSTEADY_LINE)
  const range = computeRange([[...trimmed]])
  if (range === null) return sirenOf('unsteady', SIREN_UNSTEADY_LINE)
  const band = sirenBand(range.lowMidi, range.highMidi)
  return {
    kind: band.low === band.high ? 'centre' : 'half',
    heard: true,
    band,
    line: sirenLine(band),
    spoken: sirenLine(band, inWords),
  }
}
