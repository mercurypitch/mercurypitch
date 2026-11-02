// ============================================================
// Harmony's level: the room kit's level control, with Harmony's lines
// ============================================================
//
// The pill in the bar (RoomBar.tsx) and the sheet it opens
// (LevelControl.tsx). Harmony reads the level as how long its lines are,
// how much Merc gives before the singer's turn, and how close to each note
// the voice must hold (HARMONY_LEVELS); these lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of the singer in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Three notes by step. Merc sings his line, then yours, before you sing.',
  singer:
    'Four notes. Merc sings his line; the gold lamps show where yours goes.',
  professional:
    'Five notes with a leap, some a third below, the lamps unlit until you sing them, and less room around each note.',
}

export interface HarmonyLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function HarmonyLevel(props: HarmonyLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={LEVEL_LINES}
      testId="harmony-level"
    />
  )
}
