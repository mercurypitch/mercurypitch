// ============================================================
// SessionPill — the run you left in another room
// ============================================================
//
// Names the room and where the run stands, in the present tense, with no
// timer and one control: go back to it. It lives in the dock's accessory
// slot, above a full rail, and only where the run is NOT — a run store in
// this app is a module-level global, so without the owner check it would
// light up in the room it belongs to as well.
//
// "<room> · <state>" is the kit's grammar for this pill, and the state is
// never in doubt: the pill exists only while a run is parked, and parking
// pauses (`parkRun`), so the run behind it is paused by construction. The
// label it is handed is the ROOM's name — "Retro Analog Studio", not "Sing"
// (device round 1, P4).
//
// THE ACCESSIBLE NAME OPENS WITH THE VISIBLE ONE, verbatim, and then says the
// rest. That is WCAG 2.5.3 and it is not a formality here: this app ships
// voice control, and a name that paraphrased the words on the button would
// leave "the thing it says" unspeakable.

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { PlayIcon } from './icons'

export interface SessionPillProps {
  label: () => string
  onReturn: () => void
}

export const SessionPill: Component<SessionPillProps> = (props) => (
  <button
    type="button"
    class="mp-pill"
    data-testid="shell-session-pill"
    aria-label={`${props.label()} · paused. Parked and silent. Return to it`}
    onClick={() => {
      void hapticTap()
      props.onReturn()
    }}
  >
    <span class="mp-pill__dot" />
    <span class="mp-pill__label">{props.label()} · paused</span>
    <span class="mp-pill__btn" aria-hidden="true">
      <PlayIcon />
    </span>
  </button>
)
