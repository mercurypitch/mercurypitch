// ============================================================
// The level's rules in a premium room: followed between takes, held in one
// ============================================================
//
// The level is the singer's accuracy tier, read through exercise-level.ts.
// Each exercise turns it into its own rules (Long note: LANTERN_LEVELS, the
// band and the steadiness the lantern's top asks for). Between takes the
// rules follow the level as it is picked, in the room or in Settings. A take
// keeps the rules it opened with, so a level changed during it (on another
// device, say) never re-judges the voice halfway; the next take opens at
// the new level.

import type { Accessor } from 'solid-js'
import { createEffect, createSignal, untrack } from 'solid-js'
import type { ExerciseLevel } from '@/stores/exercise-level'
import { exerciseLevel } from '@/stores/exercise-level'

export interface LevelPreset<P> {
  /** The rules a take is heard by. */
  preset: Accessor<P>
  /** The level's rules as the level stands. */
  levelPreset: () => P
  /** A take opens: under its own rules (a demo's), else the level's. */
  take: (own?: P) => void
  /** Back to the level's rules (the demo is over). */
  follow: () => void
}

/**
 * `presets` holds each level's rules; `held` says a take is open, and
 * while it is the rules stay as they are.
 */
export function createLevelPreset<P>(
  presets: Readonly<Record<ExerciseLevel, P>>,
  held: () => boolean,
): LevelPreset<P> {
  const levelPreset = (): P => presets[exerciseLevel()]
  const [preset, setPreset] = createSignal(untrack(levelPreset))
  createEffect(() => {
    const next = levelPreset()
    if (!untrack(held)) setPreset(() => next)
  })
  return {
    preset,
    levelPreset,
    take: (own) => {
      const next = own ?? untrack(levelPreset)
      setPreset(() => next)
    },
    follow: () => {
      const next = levelPreset()
      setPreset(() => next)
    },
  }
}
