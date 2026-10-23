// ============================================================
// Lesson 7 data — the chart's windows, the siren, "Twinkle", the push curve
// ============================================================
//
// Every number the page draws or sings, by construction from FACTS 81 to 87,
// for either voice: the lower (Merc, from E3) and the higher (Tavi, an
// octave up). Pure, so each is tested against FACTS and against the
// app's own presets (`VOCAL_RANGES`) and its middle-half rule
// (`middleHalf`), which the page itself never loads: both sit in modules a
// first paint must not reach.
//
// - The windows hold every preset of a voice's group: E2 to C5 (the bass,
//   baritone and tenor), F3 to C6 (the alto, mezzo-soprano and soprano);
//   Step 5's view, E2 to C6, holds all six and the two singers (FACTS 87).
// - The column is two octaves, A2 to A4 (or A3 to A5), its middle half D♯3
//   to D♯4 (or D♯4 to D♯5) lit: the Vocal Range Test's middle half of it.
// - Merc's siren: E3 up to C♯4 (or E4 to C♯5) in 2.8 s, a 0.4 s turn, and
//   2.8 s back, even in semitones, 6 s in all (FACTS 82).
// - "Twinkle"'s first two lines, 14 notes in 8 s from E3 (FACTS 83).
// - Step 3's slide, do from the column's bottom to 15 semitones up (FACTS 84).
// - Step 4's illustrative push curve, p = ((s − 8) / 16)² (FACTS 85).
// - Step 5's singers and the app's six bands (FACTS 86).

import { hz, nameHtml, sharpOf, signName } from '@/features/lessons/kit/notes'
import type { LinePoint, NoteSpan, RangeWindow, } from '@/features/lessons/kit/range-chart'
import type { ContourPoint } from '@/features/lessons/kit/sound'
import { contourOf } from '@/features/lessons/kit/sound'

/** The chart's voice: the lower group's notes, or the higher group's. */
export type ChartVoice = 'lower' | 'higher'

/** Semitones the higher voice sits above the lower: an octave. */
export const lift = (v: ChartVoice): number => (v === 'higher' ? 12 : 0)

// -------------------------------------------------------------- the chart

/** Each voice's window: the span of its group's presets (FACTS 87). */
export const WINDOWS: Readonly<Record<ChartVoice, RangeWindow>> = {
  lower: { lo: 40, hi: 72 },
  higher: { lo: 53, hi: 84 },
}

/** Step 5's view, for either voice: E2 to C6. */
export const TYPES_WINDOW: RangeWindow = { lo: 40, hi: 84 }

export interface Column extends NoteSpan {
  readonly lit: NoteSpan
}

/** The column, A2 to A4, its middle half D♯3 to D♯4 lit; an octave up for the higher voice. */
export function columnOf(v: ChartVoice): Column {
  const up = lift(v)
  return {
    lo: 45 + up,
    hi: 69 + up,
    lit: { lo: 51 + up, hi: 63 + up },
  }
}

// -------------------------------------------------------------- the siren

/** Merc's siren: seconds up, at the turn, and down; and its slow version's length. */
export const SIREN_UP = 2.8
export const SIREN_TURN = 0.4
export const SIREN_DOWN = 2.8
export const SIREN_SEC = SIREN_UP + SIREN_TURN + SIREN_DOWN
export const SIREN_SLOW_SEC = SIREN_SEC * 2

/** The siren's low and high notes in a voice: E3 and C♯4, or E4 and C♯5. */
export const sirenEnds = (v: ChartVoice): { low: number; high: number } => ({
  low: 52 + lift(v),
  high: 61 + lift(v),
})

/** The siren's note at `t` seconds of its 6, even in semitones. */
export function sirenAt(v: ChartVoice, t: number): number {
  const { low, high } = sirenEnds(v)
  if (t <= 0) return low
  if (t < SIREN_UP) return low + ((high - low) * t) / SIREN_UP
  if (t <= SIREN_UP + SIREN_TURN) return high
  if (t < SIREN_SEC)
    return high - ((high - low) * (t - SIREN_UP - SIREN_TURN)) / SIREN_DOWN
  return low
}

/** The siren's line from its start to `until` seconds, a point every 50 ms. */
export function sirenLine(v: ChartVoice, until = SIREN_SEC): LinePoint[] {
  const end = Math.min(Math.max(until, 0), SIREN_SEC)
  const points: LinePoint[] = []
  for (let t = 0; t < end; t += 0.05) points.push({ t, midi: sirenAt(v, t) })
  points.push({ t: end, midi: sirenAt(v, end) })
  return points
}

/** The siren as Merc sings it, at `speed` (1, or 0.5 for Slow): pitch in hertz over time. */
export function sirenContour(v: ChartVoice, speed = 1): ContourPoint[] {
  const { low, high } = sirenEnds(v)
  return contourOf(hz(low), [
    { glide: SIREN_UP / speed, to: hz(high) },
    { hold: SIREN_TURN / speed },
    { glide: SIREN_DOWN / speed, to: hz(low) },
  ])
}

/**
 * The siren from `from` seconds of its 6 to its end, at `speed`: Play after
 * Pause, or after the scrub bar, carries on from where the line stands.
 */
export function sirenContourFrom(
  v: ChartVoice,
  from: number,
  speed = 1,
): ContourPoint[] {
  const start = Math.min(Math.max(from, 0), SIREN_SEC)
  const { low, high } = sirenEnds(v)
  const corners = [
    { t: SIREN_UP, midi: high },
    { t: SIREN_UP + SIREN_TURN, midi: high },
    { t: SIREN_SEC, midi: low },
  ]
  const points: ContourPoint[] = [{ t: 0, hz: hz(sirenAt(v, start)), level: 1 }]
  for (const c of corners)
    if (c.t > start)
      points.push({ t: (c.t - start) / speed, hz: hz(c.midi), level: 1 })
  return points
}

/** Where the siren is, in words, for the scrub bar: "2.1 seconds of 6: going up, near C sharp 4". */
export function sirenWhere(v: ChartVoice, t: number): string {
  const near = spoken(Math.round(sirenAt(v, t)))
  const way =
    t <= 0
      ? 'the start'
      : t < SIREN_UP
        ? 'going up'
        : t <= SIREN_UP + SIREN_TURN
          ? 'turning round'
          : t < SIREN_SEC
            ? 'coming down'
            : 'the end'
  return `${t.toFixed(1)} seconds of 6: ${way}, near ${near}`
}

// -------------------------------------------------------------- "Twinkle"

/** A note of a tune: when it starts, its note, and how long it lasts, seconds. */
export interface TuneNote {
  readonly t: number
  readonly midi: number
  readonly dur: number
}

/** "Twinkle"'s first two lines as semitones above do: do do so so la la so, fa fa mi mi re re do. */
export const TWINKLE_STEPS: readonly number[] = [
  0, 0, 7, 7, 9, 9, 7, 5, 5, 4, 4, 2, 2, 0,
]
/** Each note's length: crotchets of 0.5 s, and a minim of 1.0 s ending each line (FACTS 83). */
export const TWINKLE_LENGTHS: readonly number[] = [
  0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1,
]
export const TWINKLE_SEC = TWINKLE_LENGTHS.reduce((a, b) => a + b, 0)

/** Where Merc sings it: from E3, or E4 for the higher voice. */
export const twinkleDo = (v: ChartVoice): number => 52 + lift(v)

/** "Twinkle" from `doMidi`, note by note. */
export function twinkle(doMidi: number): TuneNote[] {
  let t = 0
  return TWINKLE_STEPS.map((s, i) => {
    const note = { t, midi: doMidi + s, dur: TWINKLE_LENGTHS[i] }
    t += TWINKLE_LENGTHS[i]
    return note
  })
}

/** The tune's span, its lowest and highest notes above do: 0 and 9. */
export const TWINKLE_SPAN = { low: 0, high: 9 } as const

// -------------------------------------------------------------- Step 3's slide

/** Where do may go: the column's bottom to 15 semitones up, so the tune never leaves the column. */
export function slideBounds(v: ChartVoice): { min: number; max: number } {
  const c = columnOf(v)
  return { min: c.lo, max: c.lo + 15 }
}

export type SlidePlace = 'middle' | 'top' | 'bottom'

/** Where the tune from `doMidi` sits: wholly in the lit middle, or reaching into an end. */
export function slidePlace(v: ChartVoice, doMidi: number): SlidePlace {
  const { lit } = columnOf(v)
  if (doMidi + TWINKLE_SPAN.high > lit.hi) return 'top'
  if (doMidi + TWINKLE_SPAN.low < lit.lo) return 'bottom'
  return 'middle'
}

const PLACE_WORDS: Readonly<Record<SlidePlace, string>> = {
  middle: 'all of it in the lit middle',
  top: 'reaching into the dimmed top end',
  bottom: 'reaching into the dimmed bottom end',
}

/** The slide's readout: the move and the place, never a key: "Moved up 2 semitones: all of it in the lit middle". */
export function slideReadout(v: ChartVoice, doMidi: number): string {
  const move = doMidi - twinkleDo(v)
  const size = Math.abs(move)
  const moved =
    move === 0
      ? 'Where Merc sang it'
      : `Moved ${move > 0 ? 'up' : 'down'} ${size} ${size === 1 ? 'semitone' : 'semitones'}`
  return `${moved}: ${PLACE_WORDS[slidePlace(v, doMidi)]}`
}

// -------------------------------------------------------------- Step 4's push

/** The illustrative push a note at `s` semitones above the column's bottom needs, 0 to 1 (FACTS 85). */
export const pushOf = (s: number): number => ((s - 8) / 16) ** 2

/** How far the gauge fills for that push: 12 % of it, plus 88 % of p. */
export const pushFill = (s: number): number => 0.12 + 0.88 * pushOf(s)

/** The curve's words for a note `s` semitones above the column's bottom, by its distance from the lowest point. */
export function pushWords(s: number): string {
  const d = Math.abs(s - 8)
  if (d === 0) return "the least push, the curve's lowest point"
  if (d <= 2) return 'nearly the least push'
  if (d <= 7) return 'a little more push'
  if (d <= 12) return 'more push'
  return 'much more push'
}

/** The push note's readout, in signs and markup for the eye and in words for the slider. */
export function pushReadout(
  v: ChartVoice,
  midi: number,
): { text: string; html: string; spoken: string } {
  const c = columnOf(v)
  const words = pushWords(midi - c.lo)
  const end =
    midi === c.lo
      ? ', the bottom of the column'
      : midi === c.hi
        ? ', the top of the column'
        : ''
  return {
    text: `${signName(sharpOf(midi))}: ${words}`,
    html: `${nameHtml(sharpOf(midi))}: ${words}`,
    spoken: `${spoken(midi)}${end}: ${words}`,
  }
}

// -------------------------------------------------------------- Step 5

export type SingerId = 'a' | 'b'

export interface Singer extends NoteSpan {
  readonly name: string
  /** Where the voice is comfortable. */
  readonly lit: NoteSpan
  readonly probably: string
}

/** Two singers, one range, two comfortable middles (FACTS 86). */
export const SINGERS: Readonly<Record<SingerId, Singer>> = {
  a: {
    name: 'Singer A',
    lo: 57,
    hi: 84,
    lit: { lo: 64, hi: 76 },
    probably: 'probably a soprano',
  },
  b: {
    name: 'Singer B',
    lo: 57,
    hi: 84,
    lit: { lo: 60, hi: 72 },
    probably: 'probably a mezzo-soprano',
  },
}

export interface VoiceBand extends NoteSpan {
  readonly id: string
  readonly name: string
}

/** The app's six bands, low to high: the Vocal Range Test's (FACTS 40, 41). */
export const BANDS: readonly VoiceBand[] = [
  { id: 'bass', name: 'Bass', lo: 40, hi: 64 },
  { id: 'baritone', name: 'Baritone', lo: 43, hi: 67 },
  { id: 'tenor', name: 'Tenor', lo: 48, hi: 72 },
  { id: 'alto', name: 'Alto', lo: 53, hi: 77 },
  { id: 'mezzo-soprano', name: 'Mezzo-soprano', lo: 57, hi: 81 },
  { id: 'soprano', name: 'Soprano', lo: 60, hi: 84 },
]

/** A band's middle note, which its button plays. */
export const bandMiddle = (b: NoteSpan): number => Math.round((b.lo + b.hi) / 2)

/** A band's span as the eye reads it, "C3 to C5", and as a screen reader does. */
export const bandSpan = (b: NoteSpan): string =>
  `${signName(sharpOf(b.lo))} to ${signName(sharpOf(b.hi))}`

/** A band's button's name: "Tenor, C 3 to C 5: play its middle note, C 4". */
export const bandLabel = (b: VoiceBand): string =>
  `${b.name}, ${spoken(b.lo)} to ${spoken(b.hi)}: play its middle note, ${spoken(bandMiddle(b))}`

/** What a band's press says: "Tenor: C 3 to C 5". */
export const bandSaid = (b: VoiceBand): string =>
  `${b.name}: ${spoken(b.lo)} to ${spoken(b.hi)}`

// -------------------------------------------------------------- names

/** A note in words, its octave apart: "E 3", "C sharp 4", as the page's live text says it. */
export function spoken(midi: number): string {
  const s = sharpOf(midi)
  return `${s.letter}${s.alter === 1 ? ' sharp' : ''} ${s.octave}`
}

/** A note in signs: "C♯4". */
export const signed = (midi: number): string => signName(sharpOf(midi))
