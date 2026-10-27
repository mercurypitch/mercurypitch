// ============================================================
// First note's level: the room kit's level control, with First note's lines
// ============================================================
//
// The pill in the bar (RoomBar.tsx) and the sheet it opens
// (LevelControl.tsx). First note reads the level as when the note's line
// shows, and how close to the note the voice must hold
// (FIRST_NOTE_LEVELS); these lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of the singer in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'The line shows where the note is from the start. Come in and slide onto it, with room around the note.',
  singer:
    'Come in by ear. The line shows once you have, so you can find the note.',
  professional: 'No line until you land, and less room around the note.',
}

export interface FirstNoteLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function FirstNoteLevel(props: FirstNoteLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={LEVEL_LINES}
      testId="first-note-level"
    />
  )
}
