// ============================================================
// Home note's level: the room kit's level control, with Home note's lines
// ============================================================
//
// The pill in the bar (RoomBar.tsx) and the sheet it opens
// (LevelControl.tsx). Home note reads the level as how much the intro
// says before the singer's turn, and how close to home the voice must hold
// (HOME_NOTE_LEVELS); these lines say so, one per level.

import type { JSX } from 'solid-js'
import { LevelControl } from '@/components/room-kit/LevelControl'
import type { ExerciseLevel } from '@/stores/exercise-level'

/** What each level asks of the singer in this room. */
const LEVEL_LINES: Record<ExerciseLevel, string> = {
  learning:
    'Four chords, then Merc sings home. Match him, in any octave, with room around the note.',
  singer:
    'Three chords that lean toward home, then your turn. Nobody sings it first.',
  professional: 'Two chords only, and less room around home.',
}

export interface HomeNoteLevelProps {
  /** A class of the room's own for the pill, if it places it itself. */
  class?: string
}

export function HomeNoteLevel(props: HomeNoteLevelProps): JSX.Element {
  return (
    <LevelControl
      class={props.class}
      lines={LEVEL_LINES}
      testId="home-note-level"
    />
  )
}
