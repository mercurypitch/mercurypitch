// ============================================================
// Merc's hop — one hop in place, landing on a beat
// ============================================================
//
// Lesson 8's cold open has both Mercs hop on every clap. The hop is the
// renderer's own crouch and flight (src/lib/merc/sim-choreo.ts, `HOP`),
// played on the whole figure, live or still, so a caller that starts it
// HOP_MS before a clap lands it on the clap. Only Lesson 8 imports this
// module, so no other lesson's first paint carries it.

import type { Which } from './merc-duo'
import { Motion } from './motion-switch'

/** A hop's crouch and flight, ms: the renderer's hop, 0.12 s and 0.41 s. */
export const HOP_MS = 530

/**
 * One hop in place, landing HOP_MS from now, over whatever the Merc is
 * doing, singing included: the whole figure crouches, rises and lands.
 * Nothing hops under reduced motion or Pause animations.
 */
export function mercHop(which: Which): void {
  if (Motion.paused) return
  const el = document.querySelector<HTMLElement>(
    which === 'blue' ? '#mercBlue' : '#mercOrange',
  )
  el?.animate(
    [
      { transform: 'none', easing: 'ease-out' },
      {
        transform: 'translateY(3%) scaleY(0.94)',
        offset: 0.23,
        easing: 'ease-out',
      },
      { transform: 'translateY(-7%)', offset: 0.6, easing: 'ease-in' },
      { transform: 'none' },
    ],
    { duration: HOP_MS },
  )
}
