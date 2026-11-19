// ============================================================
// Tap or sing: a drill's choice of how its answers are taken. The older
// bench's stage (the store build's) shows it on the idle console, where the
// drill puts it; Merc's bench offers it on the station's sheet, before the run
// (merc/answer-choice.ts). A station row starts a run as the room opens,
// and the room draws no idle console.
// ============================================================

import type { ModeToggleProps } from './EarStage'

export type AnswerMode = 'tap' | 'mic'

export const ANSWER_MODES: ReadonlyArray<{ id: AnswerMode; label: string }> = [
  { id: 'tap', label: 'Tap' },
  { id: 'mic', label: 'Sing or play' },
]

/** The toggle a drill puts on its idle console: the older bench's. */
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
