// ============================================================
// Lesson 5 breath toy — one breathing object, the gauge and the figure
// ============================================================
//
// One component in two views, so the breathing object is one object on the
// page (WEB-SPEC, Toys 3): Step 2 shows the gauge (toy-gauge.ts), one long
// note's breath with Quiet and Loud; Step 3 shows the figure
// (toy-figure.ts), Breathe in and the ring, with the Go deeper drawer under
// it. The deck gives both steps this one stage; the step picks the view,
// and the eyebrow names it, Fig. 2 or Fig. 3.

import { q } from '@/features/lessons/kit/dom'
import type { RingStills } from '@/features/lessons/kit/sing'
import { mountFigure } from './toy-figure'
import { mountGauge } from './toy-gauge'

export type BreathView = 'gauge' | 'figure'

const EYEBROW: Readonly<Record<BreathView, { fig: string; title: string }>> = {
  gauge: { fig: 'Fig. 2', title: 'The breath gauge' },
  figure: { fig: 'Fig. 3', title: 'The breath figure' },
}

export interface BreathOptions {
  readonly stills: RingStills
  /** When it draws: a deck's `toyActive(n)`. */
  readonly active: () => boolean
}

export interface Breath {
  /** Shows one view; the gauge's note stops when the figure takes its place. */
  view(v: BreathView): void
  /** Stops the gauge's note now (the viewer left both steps). */
  stop(): void
}

export function mountBreath(root: HTMLElement, opts: BreathOptions): Breath {
  const gaugeRoot = q('[data-breath-view="gauge"]', root)
  const figureRoot = q('[data-breath-view="figure"]', root)
  let shown: BreathView = 'gauge'
  const gauge = mountGauge(gaugeRoot, {
    active: () => shown === 'gauge' && opts.active(),
  })
  mountFigure(figureRoot, {
    stills: opts.stills,
    active: () => shown === 'figure' && opts.active(),
  })

  return {
    view(v) {
      if (v === shown) return
      shown = v
      gaugeRoot.hidden = v !== 'gauge'
      figureRoot.hidden = v !== 'figure'
      q('[data-breath-fig]', root).textContent = EYEBROW[v].fig
      q('[data-breath-title]', root).textContent = EYEBROW[v].title
      if (v !== 'gauge') gauge.stop()
    },
    stop() {
      gauge.stop()
    },
  }
}
