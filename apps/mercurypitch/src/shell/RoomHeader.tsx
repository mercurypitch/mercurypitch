// ============================================================
// RoomHeader — Back · room chip · gear
// ============================================================
//
// The screen-7 grammar, over the top of a room. Back is the whole navigation
// story on this surface (there is no title bar and no menu): it closes what
// is open, then leaves the room, parking a run on the way out. The gear opens
// the room's OWN options sheet — the shell does not own that content — whose
// last row is "All settings", which pushes Settings.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { BackIcon, GearIcon, MicIcon } from './icons'

export interface RoomHeaderProps {
  title: () => string
  onBack: () => void
  onGear?: () => void
}

export const RoomHeader: Component<RoomHeaderProps> = (props) => (
  <div class="mp-room-header" data-testid="shell-room-header">
    <button
      type="button"
      class="mp-iconbtn"
      aria-label="Back"
      data-testid="shell-room-back"
      onClick={() => props.onBack()}
    >
      <BackIcon />
    </button>
    <span class="mp-room-chip">
      <MicIcon />
      {props.title()}
    </span>
    <Show
      when={props.onGear}
      fallback={<span class="mp-iconbtn" aria-hidden="true" />}
    >
      {(gear) => (
        <button
          type="button"
          class="mp-iconbtn"
          aria-label="Practice options"
          data-testid="shell-room-gear"
          onClick={() => gear()()}
        >
          <GearIcon />
        </button>
      )}
    </Show>
  </div>
)
