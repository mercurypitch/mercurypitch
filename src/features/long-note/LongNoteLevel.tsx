// ============================================================
// Long note's level: the room kit's level control, with Long note's lines
// ============================================================
//
// The pill in the bar, beside "?" (RoomBar.tsx), and the sheet it opens
// (LevelControl.tsx). Long note reads the level as the room around
// the note and the steadiness the lantern's top asks for (LANTERN_LEVELS);
// these lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of a held note in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'More room around the note. A wobble or a natural vibrato still fills the top.',
  singer: 'A light vibrato fills the top. A wider one fills part of it.',
  professional:
    'Less room around the note. Only a near-straight tone fills the top.',
}

export interface LongNoteLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function LongNoteLevel(props: LongNoteLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={LEVEL_LINES}
      testId="long-note-level"
    />
  )
}
