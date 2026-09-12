// ============================================================
// RoomHeader — Back · room chip · gear
// ============================================================
//
// The screen-7 grammar, over the top of a room. Back is the whole navigation
// story on this surface (there is no title bar and no menu): it closes what
// is open, then leaves the room, parking a run on the way out. The gear opens
// the room's OWN options sheet — the shell does not own that content — whose
// last row is "All settings", which pushes Settings.
//
// IT LEAVES WHILE A SCREEN IS PUSHED, and it leaves the way the rail does:
// the same tokens, so reduced motion collapses it to the same 120 ms
// crossfade with nothing moving. `visibility` alone would not be enough —
// it is deferred until the fade finishes, and for those 220 ms the header
// would still be taking taps meant for the screen over it. So the outgoing
// state drops `pointer-events` and sets `inert` on the same frame the class
// changes, which takes the keyboard and the accessibility tree with it.
//
// The attribute rather than the property, written from an effect: the
// attribute is the spec'd way to carry `inert` and it is the half a DOM can
// be asserted on — setting only the property leaves nothing behind in jsdom,
// so the suite would go green against a header that still swallowed the
// pushed screen's Back.

import type { Component } from 'solid-js'
import { createEffect, Show } from 'solid-js'
import { BackIcon, GearIcon, MicIcon } from './icons'

export interface RoomHeaderProps {
  title: () => string
  onBack: () => void
  onGear?: () => void
  /**
   * The chip's tap, where the room has something behind it — today the
   * background picker (device round 2, R5).
   *
   * ABSENT MEANS A LABEL, and the chip stays a `<span>`. A room with no
   * picker of its own must not grow a button that does nothing; the shell
   * cannot open a picker it does not own, so the room provides the one it
   * has (`openRoomPicker` on the bridge) or the chip does not react at all.
   */
  onChip?: () => void
  /** On screen, or fading out behind a pushed screen. Absent means on. */
  visible?: () => boolean
}

export const RoomHeader: Component<RoomHeaderProps> = (props) => {
  const on = (): boolean => props.visible?.() !== false
  let root: HTMLDivElement | undefined

  // `on()` FIRST, before the ref check. An effect subscribes to what it read
  // on the run it made, so a run that returned early would have read nothing
  // and would never be woken again — the header would be stuck at whatever it
  // was when the element was still undefined.
  createEffect(() => {
    const inert = !on()
    if (root === undefined) return
    if (inert) root.setAttribute('inert', '')
    else root.removeAttribute('inert')
  })

  return (
    <div
      ref={root}
      class="mp-room-header"
      classList={{ 'is-in': on() }}
      data-testid="shell-room-header"
    >
      <button
        type="button"
        class="mp-iconbtn"
        aria-label="Back"
        data-testid="shell-room-back"
        onClick={() => props.onBack()}
      >
        <BackIcon />
      </button>
      <Show
        when={props.onChip}
        fallback={
          <span class="mp-room-chip" data-testid="shell-room-chip">
            <MicIcon />
            {props.title()}
          </span>
        }
      >
        {(chip) => (
          <button
            type="button"
            class="mp-room-chip mp-room-chip--button"
            aria-label={`${props.title()}. Tap to choose the room`}
            data-testid="shell-room-chip"
            onClick={() => chip()()}
          >
            <MicIcon />
            {props.title()}
          </button>
        )}
      </Show>
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
}
