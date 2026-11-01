// ============================================================
// Leap's level: the room kit's level control, with Leap's lines
// ============================================================
//
// The pill in the bar (RoomBar.tsx) and the sheet it opens
// (LevelControl.tsx). Leap reads the level as which leaps a run asks for,
// how much Merc gives before the singer's turn, and how close to the target
// the voice must hold (LEAP_LEVELS); these lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of the singer in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Fourths and fifths up. Merc sings both notes and names the song, then you match him.',
  singer:
    'Fourths, fifths and sixths up. Merc sings his note and names the song; you find the leap.',
  professional:
    'Thirds to the octave, up and down, named by the interval alone, and less room around the note.',
}

export interface LeapLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function LeapLevel(props: LeapLevelProps): JSX.Element {
  return (
    <LevelControl class={props.class} lines={LEVEL_LINES} testId="leap-level" />
  )
}
