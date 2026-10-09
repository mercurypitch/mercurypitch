// ============================================================
// LongNoteScreen — the Long note exercise, on the shell's stack
// ============================================================
//
// Premium exercises, decision L2: while there is only one, the Sing room's
// options push it. NativeShell imports this file only on a build with the
// premium exercises (`PREMIUM_EXERCISES`), lazily, so the room and Merc's
// renderer load when it is first opened. Back pops it, and so does Done.

import type { JSX } from 'solid-js'
import { LongNoteRoom } from '@/features/long-note/LongNoteRoom'
import { popScreen } from './run-shell-store'

export function LongNoteScreen(): JSX.Element {
  return <LongNoteRoom onDone={popScreen} />
}
