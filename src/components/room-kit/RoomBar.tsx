// ============================================================
// The room's side of the bar: its level pill and its "?"
// ============================================================
//
// A premium room is pushed over the tab under the shell's bar, with Back
// and the room's name on its left (PushedScreen.tsx). The level pill and
// "?" sat on the room's stage under the bar until 15 Oct 2026, when the
// owner moved them up into the bar, on its right. That side of the bar is
// a slot the room fills (registerPushedBarEnd, native-shell-store.ts):
// RoomBarEnd draws what the room gives it there, from the room's own tree,
// so the room's signals, its focus hand-off and its cleanup reach them as
// before. With no shell (a test, a fixture) it draws them in place, in the
// room's top right corner, where the bar's right side would be.
//
// The room still says when each shows: at rest and at a result, never
// while a take runs or the demo plays.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { HelpCircle } from '@/components/icons'
import { pushedBarEnd } from '@/stores/native-shell-store'
import styles from './RoomBar.module.css'

export interface RoomBarEndProps {
  /** The room's controls for the bar, each behind its own Show. */
  children: JSX.Element
}

export function RoomBarEnd(props: RoomBarEndProps): JSX.Element {
  return (
    <Show
      when={pushedBarEnd()}
      keyed
      fallback={<div class={styles.inPlace}>{props.children}</div>}
    >
      {(slot) => <Portal mount={slot}>{props.children}</Portal>}
    </Show>
  )
}

export interface RoomAskProps {
  /** Opens the room's "how it works" demo. */
  onAsk: () => void
  label: string
  testId: string
}

/** "?": the room's demo, from the bar. */
export function RoomAsk(props: RoomAskProps): JSX.Element {
  return (
    <button
      type="button"
      class={styles.ask}
      onClick={() => props.onAsk()}
      aria-label={props.label}
      data-testid={props.testId}
    >
      <HelpCircle size={22} />
    </button>
  )
}
