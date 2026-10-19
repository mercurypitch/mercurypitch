// ============================================================
// Lesson 5 breath figure toy — Fig. 3, Breathe in, then out on "sss"
// ============================================================
//
// The figure view of the breath toy (WEB-SPEC, Toys 3): the schematic side
// view of breath-figure.ts beside the breathing ring, with Merc's still at
// its centre and the cue "sss ... and stop". Breathe in is one tap, by
// pointer, Space or Enter, never a press and hold: the dome flattens and
// the belly moves out over a fixed 2 s, then at once the dome rises and the
// belly returns over 5 s while the ring counts the "sss". There is no hold
// between the two, and nothing the viewer does keeps the dome flat (FACTS
// 33, 65): a tap during a breath does nothing, and the button says so
// (aria-disabled) without losing the keyboard's place. The figure plays no
// sound, so leaving the step lets a breath finish on its own.
//
// A polite line says each phase as it begins. Under reduced motion the
// figure is two still frames, at rest and breathed in, and the ring holds
// still while its count carries the "sss".

import { q } from '@/features/lessons/kit/dom'
import { addDrawer, surface, watch } from '@/features/lessons/kit/frame-loop'
import { reducedMotion } from '@/features/lessons/kit/motion-switch'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountRing } from '@/features/lessons/kit/sing'
import type { BreathPhase } from './breath-figure'
import { breathAt, drawFigure, figureBox, IN_SEC, OUT_SEC, PHASE_WORDS, } from './breath-figure'

/** The figure's canvas label in each phase. */
const FIGURE_LABEL: Readonly<Record<BreathPhase, string>> = {
  rest: 'A side view of the chest and belly at rest: the lungs, the diaphragm domed under them, and the belly wall',
  in: 'Breathing in: the diaphragm flattens and lowers, and the belly moves out',
  out: 'Breathing out on sss: the diaphragm rises back into its dome, and the belly returns',
}

const STILLS_LABEL =
  'Two still frames of a side view of the chest and belly: at rest, the diaphragm domed under the lungs; breathed in, the diaphragm flatter and lower and the belly further out'

export interface FigureToyOptions {
  readonly stills: RingStills
  /** When it draws: a deck's `toyActive(n)`; default while its root is on screen. */
  readonly active?: () => boolean
}

export function mountFigure(root: HTMLElement, opts: FigureToyOptions): void {
  const canvas = q<HTMLCanvasElement>('.figure-viz canvas', root)
  const cv = surface(canvas)
  const button = q<HTMLButtonElement>('[data-figure="breathe"]', root)
  const words = q('[data-figure-words]', root)
  const live = q('[data-figure-live]', root)
  const ring = mountRing(q('.ring', root), {
    stills: opts.stills,
    calm: true,
    words: {
      listen: 'Ready',
      breathe: 'Breathe in',
      turn: (n) => `sss · ${n}`,
      done: 'At rest',
    },
  })
  let t0: number | null = null
  let phase: BreathPhase = 'rest'

  function say(p: BreathPhase): void {
    if (p === phase) return
    phase = p
    words.textContent = PHASE_WORDS[p]
    live.textContent = PHASE_WORDS[p]
    if (!reducedMotion()) canvas.setAttribute('aria-label', FIGURE_LABEL[p])
  }

  function rest(): void {
    t0 = null
    button.removeAttribute('aria-disabled')
    say('rest')
  }

  button.addEventListener('click', () => {
    if (t0 !== null) return
    t0 = performance.now()
    button.setAttribute('aria-disabled', 'true')
    say('in')
    void ring
      .run({
        which: 'blue',
        label: 'sss &#8230; and stop',
        listen: 0,
        breathe: IN_SEC,
        turn: OUT_SEC,
        ripples: false,
        exhale: true,
      })
      .then(() => {
        if (t0 !== null) rest()
      })
  })

  function paint(now: number): void {
    const { ctx, w, h } = cv.fit()
    const t = t0 === null ? null : (now - t0) / 1000
    if (t !== null && t >= IN_SEC + OUT_SEC) rest()
    else if (t !== null) say(breathAt(t).phase)
    if (reducedMotion()) {
      canvas.setAttribute('aria-label', STILLS_LABEL)
      const half = w / 2
      drawFigure(ctx, figureBox(h, 0, half, true), 0, { caption: 'AT REST' })
      drawFigure(ctx, figureBox(h, half, half, true), 1, {
        caption: 'BREATHED IN',
      })
      return
    }
    drawFigure(ctx, figureBox(h, 0, w), breathAt(t0 === null ? null : t).u)
  }

  addDrawer({ active: opts.active ?? watch(root), draw: paint })
  words.textContent = PHASE_WORDS.rest
  canvas.setAttribute(
    'aria-label',
    reducedMotion() ? STILLS_LABEL : FIGURE_LABEL.rest,
  )
}
