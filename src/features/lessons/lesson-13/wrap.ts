// ============================================================
// Lesson 13 wrap — the practise card the checkpoint picks, and free play
// ============================================================
//
// The practise card comes in two versions (WEB-SPEC, Practice links): the
// Voice Mirror card, one link to /mirror?lesson=13, with "Ten minutes,
// gently, most days", or, after "Just listen today", "Effortful" or
// "Uncomfortable", the rest card, which links nowhere and names Voice
// Mirror for another day (kit/comfort.ts `mountPractiseCard`). The
// checkpoint's ending is held in memory for the visit (kit/comfort.ts
// `VisitEnding`), never stored, so a new visit opens on the Voice Mirror
// card.
//
// Free play (WEB-SPEC, Toys 7): the vowel figure on one stage with every
// control, bound as the steps bind theirs (controls.ts): the voice switch,
// Resonances, the five vowels, Play the five vowels and All harmonics. The
// switch changes this figure's voice for the visit and stores nothing.
// Each play is the page's one sound, and the figure draws only while it is
// on screen.

import { mountPractiseCard } from '@/features/lessons/kit/comfort'
import { q } from '@/features/lessons/kit/dom'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { playLights } from '@/features/lessons/kit/play-lights'
import type { Controls } from './controls'
import { bindControls } from './controls'
import type { VowelFigure } from './figure'
import { mountFigure } from './figure'

export interface Wrap {
  readonly figure: VowelFigure
  readonly controls: Controls
}

export function initWrap(): Wrap {
  mountPractiseCard(q('#practiseCard'))
  const root = q('#freePlay')
  const figure = mountFigure(q('[data-vowel-viz]', root), {
    owner: NowPlaying,
  })
  figure.show({ voice: 'lower', vowel: 'ee' })
  const controls = bindControls(root, figure, playLights())
  return { figure, controls }
}
