// ============================================================
// Lesson 24 drone words — the figure's label, its readout and what it says
// ============================================================
//
// The words beside the drone chart (WEB-SPEC, Toys 2): each state's figure
// label; the readout under the chart, the rate in Beat Hunt's words, "2
// beats a second", "a beat every 2 s", and "still" at none, or "beating"
// and "still" for a chord (FACTS 28); the canvas's spoken summary of what
// it shows; and the line the polite live region says as a play starts,
// which carries the rate under reduced motion too. Nothing here is said
// before the cold open's choice, when the figure shows the drone's band
// alone and its markup's own words.

import { centsAbove } from '@/features/lessons/kit/band-chart-drone-scene'
import { beatRate, chordWords, rateWords, } from '@/features/lessons/kit/drone-beats'
import type { Choices, DroneState, Settings } from './drone-picture'
import { heldBack, miHz } from './drone-picture'
import type { Play, PlayKey } from './sounds'
import { DRONE_HZ, firstHz, PIANO } from './sounds'

/** Each state's figure label, as free play's switch names the states. */
export const FIG: Readonly<Record<DroneState, string>> = {
  1: '<span class="fig">Fig. 1</span> Close notes',
  2: '<span class="fig">Fig. 2</span> The beads',
  3: '<span class="fig">Fig. 3</span> The band on mi',
  4: '<span class="fig">Fig. 4</span> The wave',
}

/** The canvas's words while the figure is held back: the markup's own. */
export const HELD_WORDS = 'A drone band on A3, the note the others are tuned to'

/** Step 4's readout under the wave, which has no one rate: FACTS 38's words. */
export const WAVE_WORDS = 'much fainter, under a flutter'

/** A frequency as the figure writes it: "224 Hz", "220.5 Hz", "277.2 Hz". */
export const hzWords = (f: number): string => `${Math.round(f * 10) / 10} Hz`

/** Where Step 3's mi sits, as its slider and the summary say it. */
export function miWords(cents: number): string {
  const pure = centsAbove(275, PIANO.mi)
  if (Math.abs(cents) < 0.25) return "at the piano's tick"
  if (Math.abs(cents - pure) <= 0.25) return 'at the pure tick'
  const n = Math.round(Math.abs(cents) * 10) / 10
  return `${n} cents ${cents < 0 ? 'under' : 'over'} the piano's tick`
}

/** The rate of `f` against the drone, in Beat Hunt's words. */
const against = (f: number): string => rateWords(beatRate(f, DRONE_HZ))

/**
 * The readout under the chart, or null where it shows nothing: while held
 * back, in Step 2 until a play, and in Step 4 at rest.
 */
export function readoutOf(
  n: DroneState,
  s: Settings,
  c: Choices,
  playing: { readonly key: PlayKey; readonly play: Play } | null,
): string | null {
  if (heldBack(n, c)) return null
  if (n === 1) return against(playing ? firstHz(playing.play.notes[0]) : s.top)
  if (n === 3)
    return against(playing ? firstHz(playing.play.notes[0]) : miHz(s.mi))
  if (playing === null) return null
  if (playing.key === 'chord')
    return chordWords([DRONE_HZ, ...playing.play.notes.map(firstHz)])
  if (playing.key === 'wave') return WAVE_WORDS
  return against(firstHz(playing.play.notes[0]))
}

/** The canvas's spoken summary of a state's still. */
export function stillWords(n: DroneState, s: Settings, c: Choices): string {
  if (heldBack(n, c)) return HELD_WORDS
  if (n === 1) {
    const ref = s.octave ? 2 * DRONE_HZ : DRONE_HZ
    const cents = Math.round(centsAbove(s.top, ref))
    const where =
      cents === 0
        ? 'on it'
        : `${Math.abs(cents)} cents ${cents > 0 ? 'above' : 'below'} it`
    const band = s.octave
      ? "The band marks the drone's second harmonic, 440 Hz"
      : "The drone's band on A3"
    return `${band}, and the top note's line at ${hzWords(s.top)}, ${where}.`
  }
  if (n === 2) {
    const tuning = s.tuning === 'pure' ? 'pure' : "the piano's"
    const ticks = c.step2 ? ' Dashed ticks mark the pure mi and so.' : ''
    return `The drone's band on A3, with do, mi and so as beads at its left edge, in ${tuning} tuning.${ticks}`
  }
  if (n === 3)
    return `Lesson 5's band on mi, C sharp 4, with the piano's tick at its middle and the pure one 14 cents under it; the drone is the chrome line below, on A3. Mi's line is ${miWords(s.mi)}.`
  return "No band: the top note's line on E4, at the piano's tick, with the drone pinned below, on A3."
}

/** What a play sets against the drone, as the live region names it. */
function whatOf(key: PlayKey, play: Play, s: Settings): string {
  const f = firstHz(play.notes[0])
  const tuning = s.tuning === 'pure' ? 'pure' : "the piano's"
  switch (key) {
    case 'octave':
      return `The drone with the top note at ${hzWords(f)}, an octave up`
    case 'fifth':
      return "The drone with the piano's fifth, E4"
    case 'third':
      return "The drone with the piano's major third, C sharp 4"
    case 'mi':
    case 'so':
      return `The drone with ${key}, ${tuning}`
    case 'chord':
      return `Do, mi and so together, ${tuning}`
    case 'mi-piano':
      return "The piano's mi over the drone"
    case 'mi-pure':
      return 'Pure mi over the drone'
    case 'wave':
      return "The piano's fifth with a wave"
    case 'straight':
      return "The piano's fifth, straight"
    default:
      return `The drone with the top note at ${hzWords(f)}`
  }
}

/** The live region's line as a play starts: what it plays, and how it beats. */
export function playWords(
  n: DroneState,
  s: Settings,
  c: Choices,
  key: PlayKey,
  play: Play,
): string {
  const rate = readoutOf(n, s, c, { key, play }) ?? ''
  return `${whatOf(key, play, s)}: ${rate}.`
}

/** The live region's line for a drag left at `f` Hz: Step 1's top note or Step 3's mi. */
export const dragWords = (n: DroneState, f: number): string =>
  `${n === 3 ? 'Mi' : 'The top note'} at ${hzWords(f)} with the drone: ${against(f)}.`
