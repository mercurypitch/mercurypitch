// ============================================================
// Lesson 22 band chart words — the toy's live lines, summaries and readings
// ============================================================
//
// What the steps' toy and free play say (WEB-SPEC, Toys 2): the polite
// live line as a play starts, LESSON.md's own where the spec gives one;
// the canvas's spoken summary of what it draws; the figure's label in each
// state; and Step 2's readings, the counter's swings a second and the
// ruler's cents either side, spoken in words where the page shows ±.

import type { PlayKey } from './sounds'
import type { VibState } from './vib-picture'

/** The figure's label in each state, one 16 px line: none says which note a wave is heard as (FACTS 1a). */
export const FIG: Readonly<Record<VibState, string>> = {
  1: '<span class="fig">Fig. 1</span> A level line, a wave and a swell',
  2: '<span class="fig">Fig. 2</span> Rate and extent',
  3: '<span class="fig">Fig. 3</span> A wave and its middle',
  4: '<span class="fig">Fig. 4</span> Sung, and the app\'s mark',
}

/** The band alone: the canvas's words before a play, as the markup has them. */
export const BAND_ALONE =
  "A band 35 cents either side of Merc's note, A3, with no line at its centre"

/** Whole swings a second in words, for the live lines; a half swing stays a number. */
const WORDS: Readonly<Record<number, string>> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
}
export const swingsWord = (rate: number): string => WORDS[rate] ?? String(rate)

/** A reading's ± in words, for the live lines and a slider's value text. */
export const spokenCents = (extent: number): string =>
  `plus or minus ${extent} cents`

/** A reading's ± as the page shows it: the sign for the eye, words for a screen reader. */
export const shownCents = (extent: number): string =>
  `<span aria-hidden="true">±${extent}</span><span class="sr">plus or minus ${extent}</span> cents`

/** The counter's reading: "6 swings a second". */
export const countLine = (rate: number): string => `${rate} swings a second`

/** The live line as a play starts, and the canvas's summary of what it draws (Steps 2 and 3 take the sliders' values). */
export function playWords(
  key: PlayKey,
  v: {
    readonly rate2: number
    readonly extent2: number
    readonly rate3: number
    readonly drift: boolean
  },
): { readonly said: string; readonly drawn: string } {
  switch (key) {
    case 'straight':
      return {
        said: 'A level line.',
        drawn:
          "Merc's straight note on A3: a level line through the band, 3 seconds",
      }
    case 'wave':
      return {
        said: 'The line waves up and down, six swings a second.',
        drawn:
          "Merc's note on A3 with a wave: a line swinging 40 cents either side, six times a second, a little past the band's edges",
      }
    case 'swell':
      return {
        said: 'The line stays level; the strip under it grows, then shrinks.',
        drawn:
          "Merc's swell on A3: a level line through the band, and the loudness strip under it growing, then shrinking",
      }
    case 'measure':
      return {
        said: `The line swings ${swingsWord(v.rate2)} times a second, ${spokenCents(v.extent2)}.`,
        drawn: `One second at a time of Merc's wave on A3: ${v.rate2} swings a second, ${v.extent2} cents either side, a ruler from its middle to a swing's top`,
      }
    case 'ooh':
      return {
        said: `Merc's “ooh”: 5.5 swings a second, ${spokenCents(14)}, inside the band.`,
        drawn:
          "One second at a time of Merc's “ooh” on A3: 5.5 swings a second, 14 cents either side, inside the band",
      }
    case 'six':
      return {
        said: "Merc's wave, six swings a second.",
        drawn:
          "Merc's wave on A3: six swings a second, 50 cents either side, past both edges of the band, its middle dashed",
      }
    case 'two':
      return {
        said: 'The wave, two swings a second.',
        drawn:
          "Merc's wave on A3: two swings a second, 50 cents either side, past both edges of the band, its middle dashed",
      }
    case 'at-rate':
      return {
        said: `The wave, ${swingsWord(v.rate3)} swings a second.`,
        drawn: v.drift
          ? `Merc's wave on A3: ${v.rate3} swings a second, 50 cents either side, its dashed middle rising 50 cents and leaving the band`
          : `Merc's wave on A3: ${v.rate3} swings a second, 50 cents either side, past both edges of the band, its middle dashed`,
      }
    case 'sung':
      return {
        said: 'The sung line: 11 swings in 2 seconds.',
        drawn:
          "Merc's sung wave on A3: 11 swings in 2 seconds, 30 cents either side, inside the band",
      }
  }
}

/** The live line once a play with Drift has been heard to its end (WEB-SPEC, Toys 2, state 3). */
export const DRIFT_LINE = 'The middle rose 50 cents and left the band.'

/** A state's still, in words: what the canvas shows after the cold open's choice and before a play. */
export function stillWords(
  n: VibState,
  v: {
    readonly rate2: number
    readonly extent2: number
    readonly rate3: number
  },
): string {
  if (n === 1) return BAND_ALONE
  if (n === 2)
    return `One second of Merc's wave on A3: ${v.rate2} swings, ${v.extent2} cents either side, a ruler from its middle to a swing's top`
  if (n === 3)
    return `Merc's wave on A3: ${v.rate3} swings a second, 50 cents either side, past both edges of the band, its middle dashed`
  return "Merc's sung wave on A3: 11 swings in 2 seconds, 30 cents either side, inside the band"
}

/** The ribbon's words: its picture's summary, and the live line after a stretch. */
export const ribbonLabel = (swings: number): string =>
  `The app's wavy ribbon for a vibrato note, ${swings} swings across`
export const stretchLine = (swings: number): string =>
  `The ribbon now swings ${swings} times; the sung line still swings 11.`
