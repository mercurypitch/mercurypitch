// ============================================================
// Lesson 2 ruler maths — cents above A3, hertz, and the app's reading
// ============================================================
//
// The ruler counts cents above A3: f = 220 x 2^(c / 1200), so 1,200 cents
// double 220 Hz to 440 Hz and every equal semitone is 100 (FACTS 22, 29a).
// MercuryPitch's monitor reads it differently: the nearest note, in the
// app's sharp spelling ("A#3", FACTS 28), and how far above or below it the
// pitch is, up to 50 cents either way, so at 50 cents the name flips to the
// next note (FACTS 24, 30). The slider's spoken value says what the monitor
// shows, then the frequency: "A3 plus 37 cents, 224.75 hertz".

import { clamp } from '@/features/lessons/kit/dom'
import { octaveOf } from '@/features/lessons/kit/notes'

/** The ruler's bottom, A3, and its top, 1,200 cents (A4) above. */
export const RULER_HZ = 220
export const RULER_TOP = 1200

/** A3's MIDI number: the ruler's 0. */
const A3 = 57

/** The frequency `cents` above A3. */
export const centsHz = (cents: number): number => RULER_HZ * 2 ** (cents / 1200)

/** The cents above A3 of a frequency. */
export const hzCents = (f: number): number => 1200 * Math.log2(f / RULER_HZ)

/** The app's names: sharps, written with "#" as its pitch line writes them. */
const APP_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
]

/** The note as MercuryPitch's pitch line labels it: "A#3". */
export function appName(midi: number): string {
  return `${APP_NAMES[((midi % 12) + 12) % 12]}${octaveOf(midi)}`
}

/** The same name in words: "A sharp 3". */
export function appSpoken(midi: number): string {
  return appName(midi).replace('#', ' sharp ')
}

/** What the monitor reads at `cents` above A3: the nearest note, and the cents from it (-50 up to +49.9). */
export interface Reading {
  readonly midi: number
  readonly off: number
}

/** The nearest note to `cents` above A3; exactly halfway, the note above (the name flips at 50). */
export function reading(cents: number): Reading {
  const steps = Math.floor(cents / 100 + 0.5)
  return { midi: A3 + steps, off: cents - 100 * steps }
}

/** Where the monitor's marker sits on its bar, 0 at -50 to 1 at +50. */
export const markerAt = (off: number): number => clamp((off + 50) / 100, 0, 1)

/** Hertz to two decimals: "224.75". */
export const hz2 = (f: number): string => f.toFixed(2)

/** Hertz to one decimal, as the monitor prints it: "224.8". */
export const hz1 = (f: number): string => f.toFixed(1)

const centsWord = (n: number): string => (n === 1 ? 'cent' : 'cents')

/**
 * The slider's spoken value: the nearest note and the distance from it, as
 * the monitor reads, then the frequency. "A3 plus 37 cents, 224.75 hertz";
 * "A sharp 3 minus 40 cents, 227.76 hertz"; "A3 exactly, 220.00 hertz".
 */
export function rulerValueText(cents: number): string {
  const r = reading(cents)
  const off = Math.round(r.off)
  const name = appSpoken(r.midi)
  const f = `${hz2(centsHz(cents))} hertz`
  if (off === 0) return `${name} exactly, ${f}`
  const sign = off > 0 ? 'plus' : 'minus'
  return `${name} ${sign} ${Math.abs(off)} ${centsWord(Math.abs(off))}, ${f}`
}
