// ============================================================
// Lantern ease — the lantern's level between takes, eased
// ============================================================
//
// Out of useLongNoteController: the level a take left stays until the next
// take empties it, over a few hundred milliseconds, a frame at a time. In
// the hold the room shows the engine's own fills instead.

import type { Accessor } from 'solid-js'
import { createSignal, untrack } from 'solid-js'

export interface LanternEase {
  level: Accessor<number>
  /** Straight to a level. */
  set: (level: number) => void
  /** Ease to a level over `ms` milliseconds. */
  ease: (to: number, ms: number) => void
  /** Stop easing: the room is going away. */
  stop: () => void
}

export function createLanternEase(): LanternEase {
  const [level, setLevel] = createSignal(0)
  let tween = 0
  const stop = (): void => {
    if (tween !== 0) cancelAnimationFrame(tween)
    tween = 0
  }
  return {
    level,
    set: (to) => setLevel(to),
    ease: (to, ms) => {
      stop()
      const from = untrack(level)
      const t0 = performance.now()
      const step = (): void => {
        const k = Math.min(1, (performance.now() - t0) / ms)
        const eased = 1 - (1 - k) * (1 - k)
        setLevel(from + (to - from) * eased)
        tween = k < 1 ? requestAnimationFrame(step) : 0
      }
      tween = requestAnimationFrame(step)
    },
    stop,
  }
}
