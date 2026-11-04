// ============================================================
// Lesson 13 cold open — Merc's ‘ee’, then ‘ee’ into ‘ah’, on the hero's strip
// ============================================================
//
// The kit's predict as it is (kit/predict.ts; WEB-SPEC, Toys 2): two
// choices, "Their heights" and "Their places", that lock on the first
// press; Play Merc's ‘ee’, a free play that works before a choice and
// never reveals, since ‘ee’ alone answers nothing; and Play ‘ee’, then
// ‘ah’, locked until a choice, whose sound heard to its end with sound on
// reveals. Both sing on the hero's compact vowel figure in Merc's lower
// voice, A3, the strip changing as they sound, with sound off as with sound
// on; only the reveal's words wait for the sound.
//
// Each play claims the page's one sound through the figure, so a Four
// words play or a step toy cuts it short; a play cut short resolves false
// and the kit reveals nothing. Merc sings while the vowels sound, and Tavi,
// the puzzled one, celebrates once at the reveal, whichever choice was made.
// The figure's live line never answers the predict before its reveal.

import { q } from '@/features/lessons/kit/dom'
import { mercCelebrate, mercSing } from '@/features/lessons/kit/merc-duo'
import { A3 } from '@/features/lessons/kit/notes'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type { Predict } from '@/features/lessons/kit/predict'
import { mountPredict } from '@/features/lessons/kit/predict'
import type { VowelFigure } from './figure'
import { mountFigure } from './figure'
import { COMPACT_EE, COMPACT_EE_AH, COMPACT_REST, COMPACT_REVEAL, } from './lines'
import type { Line } from './plays'
import { eeThenAh, oneVowel } from './plays'

/** The predict's hints (LESSON.md, the cold open; the page's lock hint is the markup's). */
export const HINTS = {
  chosen: 'Locked in. Now play ‘ee’, then ‘ah’.',
  silent:
    'Sound is off, so nothing played. Turn sound on to hear it, then play it again.',
  again: 'Play either again.',
} as const

/** The reveal's line about the choice, in Lesson 2's form. */
export const guess = (choice: string): string =>
  choice === 'heights' ? 'You said: their heights' : 'You said: their places'

/** The cold open's two plays, and what the live line says once each ends. */
export const PLAYS: Readonly<
  Record<string, { readonly line: Line; readonly said: string }>
> = {
  ee: { line: oneVowel('lower', A3, 'ee'), said: COMPACT_EE },
  'ee-ah': { line: eeThenAh('lower', A3), said: COMPACT_EE_AH },
}

export interface ColdOpen {
  readonly figure: VowelFigure
  readonly predict: Predict
}

export function initColdOpen(): ColdOpen {
  const root = q('#heroVowels')
  const viz = q('[data-vowel-viz]', root)
  const said = q('[data-said]', viz)
  const figure = mountFigure(viz, { compact: true, owner: NowPlaying })
  figure.show({ voice: 'lower', vowel: 'ee' })
  viz.setAttribute('aria-label', COMPACT_REST)
  const say = (text: string): void => {
    if (said.textContent !== text) said.textContent = text
  }

  const predict = mountPredict(q('#predict'), {
    plays: [
      q<HTMLButtonElement>('#heroPlay'),
      q<HTMLButtonElement>('.hero [data-play="ee-ah"]'),
    ],
    revealOn: ['ee-ah'],
    hints: HINTS,
    guess,
    async play(what, audible) {
      const p = PLAYS[what]
      if (p === undefined) return false
      mercSing('blue', A3, true)
      const heard = await figure.play(p.line, { audible })
      mercSing('blue', A3, false)
      if (heard) say(p.said)
      return heard
    },
    onReveal() {
      say(COMPACT_REVEAL)
      mercCelebrate('orange')
    },
  })
  return { figure, predict }
}
