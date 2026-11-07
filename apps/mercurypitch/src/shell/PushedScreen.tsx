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
//
// A screen that asks (`focusTitle`) is handed the focus at its title as it
// is pushed, so a screen reader starts at the top of what just opened
// rather than on the page. The screen under it may move the focus on
// afterwards: its own mount runs after this one's.
//
// A screen that asks (`swipeBack`) is also left by a swipe in from the left
// edge, as an iPhone's pushed screens are (edge-swipe.ts): the whole screen
// follows the finger, and a release far enough along is the same Back.

import type { Component, JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'
import { registerPushedBarEnd } from '@/stores/native-shell-store'
import { installEdgeSwipe } from './edge-swipe'
import { BackIcon } from './icons'

export interface PushedScreenProps {
  title: string
  onBack: () => void
  /** A premium room's full-bleed variant: the bar over the art, no rail. */
  bleed?: boolean
  /** Hand the focus to the title as the screen is pushed. */
  focusTitle?: boolean
  /** Leave by a swipe in from the left edge, as well as by Back. */
  swipeBack?: boolean
  children: JSX.Element
}

export const PushedScreen: Component<PushedScreenProps> = (props) => {
  let root: HTMLDivElement | undefined
  let title: HTMLSpanElement | undefined
  onMount(() => {
    if (props.focusTitle === true) title?.focus({ preventScroll: true })
    if (props.swipeBack === true && root !== undefined) {
      onCleanup(installEdgeSwipe(root, { onBack: () => props.onBack() }))
    }
  })
  return (
    <div
      ref={root}
      class="mp-pushed"
      classList={{
        'mp-pushed--bleed': props.bleed === true,
        'mp-pushed--swipe': props.swipeBack === true,
      }}
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
        <span
          ref={title}
          class="mp-pushed__title"
          tabindex={props.focusTitle === true ? '-1' : undefined}
        >
          {props.title}
        </span>
        <div
          class="mp-pushed__end"
          ref={(el) => onCleanup(registerPushedBarEnd(el))}
          data-testid="shell-pushed-end"
        />
      </div>
      <div class="mp-pushed__body">{props.children}</div>
    </div>
  )
}
