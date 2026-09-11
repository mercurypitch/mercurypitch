// ============================================================
// SessionPill — the run you left in another room
// ============================================================
//
// Names the room and where the run stands, in the present tense, with no
// timer and one control: go back to it. It lives in the dock's accessory
// slot, above a full rail, and only where the run is NOT — a run store in
// this app is a module-level global, so without the owner check it would
// light up in the room it belongs to as well.

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
    aria-label={`Parked and silent. Return to ${props.label()}`}
    onClick={() => {
      void hapticTap()
      props.onReturn()
    }}
  >
    <span class="mp-pill__dot" />
    <span class="mp-pill__label">{props.label()}</span>
    <span class="mp-pill__btn" aria-hidden="true">
      <PlayIcon />
    </span>
  </button>
)
