// ============================================================
// Lip roll's level: the room kit's level control, with Lip roll's lines
// ============================================================
//
// The pill in the head's top-left corner and the sheet it opens
// (LevelControl.tsx). Lip roll reads the level as its waves' rules
// (LIP_ROLL_LEVELS, DESIGN-lip-roll.md 3): how fast each wave goes, how
// close to the dots the voice must stay, whether the next note plays in
// the breath, and whether the top must be reached. One line per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of a wave in this room. */
export const LIP_LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Slow waves with plenty of room around the dots. The next note plays in every breath.',
  singer:
    'Steady waves, closer to the dots. The next note still plays in every breath.',
  professional:
    'Quick waves, close to the dots, and no notes in the breaths. Each wave must reach its top in tune.',
}

export interface LipLevelProps {
  /** The room's class for the pill, placed by the room. */
  class: string
}

export function LipLevel(props: LipLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={LIP_LEVEL_LINES}
      testId="lip-level"
    />
  )
}
