// ============================================================
// Echo's level: the room kit's level control, with Echo's lines
// ============================================================
//
// The pill in the bar, beside "?" (RoomBar.tsx), and the sheet it opens
// (LevelControl.tsx). Echo reads the level as its phrases and their rules
// (ECHO_LEVELS, DESIGN-echo.md 3): how many notes, how fast Merc sings
// them, how much room each note has, whether another octave counts, and
// how often Merc sings a phrase again. These lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of an echo in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Three slow notes a phrase. An octave up or down still counts, and Merc sings a phrase again whenever you ask.',
  singer:
    'Four notes a phrase, in the octave Merc sings. He sings each phrase again once if you ask.',
  professional:
    'Five quick notes, with less room around each one. No repeats, and your timing counts too.',
}

export interface EchoLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function EchoLevel(props: EchoLevelProps): JSX.Element {
  return (
    <LevelControl class={props.class} lines={LEVEL_LINES} testId="echo-level" />
  )
}
