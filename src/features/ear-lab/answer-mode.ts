// ============================================================
// Tap or sing: a drill's choice of how its answers are taken. The web's
// stage shows it on the idle console, where the drill puts it; the native
// room offers it under "?" from the stage's own props, so it is there
// however the run began. A station row starts a run as the room opens,
// before the room's chunk has loaded, and the idle console is never drawn.
// ============================================================

import type { ModeToggleProps } from './EarStage'

export type AnswerMode = 'tap' | 'mic'

const ANSWER_MODES: ReadonlyArray<{ id: AnswerMode; label: string }> = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

/** The toggle a drill hands both its idle console and its stage. */
export function answerToggle(
  label: string,
  mode: () => AnswerMode,
  setMode: (mode: AnswerMode) => void,
): ModeToggleProps<string> {
  return {
    label,
    get value() {
      return mode()
    },
    options: ANSWER_MODES,
    onChange: (id) => setMode(id === 'mic' ? 'mic' : 'tap'),
  }
}
