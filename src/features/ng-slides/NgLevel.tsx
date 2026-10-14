// ============================================================
// Ng slides' level: the room kit's level control, with Ng's lines
// ============================================================
//
// The pill in the head's top-left corner and the sheet it opens
// (LevelControl.tsx). Ng slides reads the level as its slides' rules
// (NG_SLIDES_LEVELS, DESIGN-ng-slides.md 3): how fast each slide goes,
// how close to the line the voice must stay, whether the next note plays
// in the breath, and whether the top must land in tune. These lines say
// so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of a slide in this room. */
export const NG_LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Slow slides with plenty of room around the line. The next note plays in every breath.',
  singer:
    'Steady slides, closer to the line. The next note still plays in every breath.',
  professional:
    'Quick slides, close to the line, and no notes in the breaths. Each top must land in tune.',
}

export interface NgLevelProps {
  /** The room's class for the pill, placed by the room. */
  class: string
}

export function NgLevel(props: NgLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={NG_LEVEL_LINES}
      testId="ng-level"
    />
  )
}
