// ============================================================
// PushedScreen — a screen pushed over the tab, with its own Back
// ============================================================
//
// A navigation level rather than a modal: the rail stays reachable beneath
// it, and Back pops it. It brings its OWN scroll container, because the app's
// scroller is `.main-content` and this screen is not inside it — Settings
// scrolls sections into view (`SettingsPanel`) and would otherwise be
// scrolling something that is not on screen.
//
// A premium room is drawn full-bleed (`bleed`, decision D1 in
// premium-rooms.ts): the body takes the whole screen, under the status bar
// and the home indicator, and the bar floats over the room's art, see-through
// but for the back button's own glass and a soft scrim behind the title. The
// room keeps its content clear of the bar with `--pushed-top` and of the
// screen's bottom edge with `--pushed-bottom` (shell.css), and paints its
// art across the whole body. The art is a dark stage in either app theme
// (dark-stage.css), so the bar over it takes the same contract: in the light
// theme a dark title would otherwise sit on the dark art.
//
// The bar's right side is the screen's own: a slot (registerPushedBarEnd,
// native-shell-store.ts) the screen under it fills. A premium room puts its
// level pill and its "?" there (RoomBarEnd in the room kit); every other
// screen leaves it empty.

import type { Component, JSX } from 'solid-js'
import { onCleanup } from 'solid-js'
import { registerPushedBarEnd } from '@/stores/native-shell-store'
import { BackIcon } from './icons'

export interface PushedScreenProps {
  title: string
  onBack: () => void
  /** A premium room's full-bleed variant: the bar over the art, no rail. */
  bleed?: boolean
  children: JSX.Element
}

export const PushedScreen: Component<PushedScreenProps> = (props) => (
  <div
    class="mp-pushed"
    classList={{ 'mp-pushed--bleed': props.bleed === true }}
    role="group"
    aria-label={props.title}
    data-testid="shell-pushed"
    data-bleed={props.bleed === true ? 'on' : undefined}
  >
    <div
      class="mp-pushed__bar"
      classList={{ 'mp-dark-stage': props.bleed === true }}
    >
      <button
        type="button"
        class="mp-iconbtn"
        aria-label="Back"
        data-testid="shell-pushed-back"
        onClick={() => props.onBack()}
      >
        <BackIcon />
      </button>
      <span class="mp-pushed__title">{props.title}</span>
      <div
        class="mp-pushed__end"
        ref={(el) => onCleanup(registerPushedBarEnd(el))}
        data-testid="shell-pushed-end"
      />
    </div>
    <div class="mp-pushed__body">{props.children}</div>
  </div>
)
