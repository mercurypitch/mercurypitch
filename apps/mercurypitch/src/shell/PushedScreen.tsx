// ============================================================
// PushedScreen — a screen pushed over the tab, with its own Back
// ============================================================
//
// A navigation level rather than a modal: the rail stays reachable beneath
// it, and Back pops it. It brings its OWN scroll container, because the app's
// scroller is `.main-content` and this screen is not inside it — Settings
// scrolls sections into view (`SettingsPanel`) and would otherwise be
// scrolling something that is not on screen.

import type { Component, JSX } from 'solid-js'
import { BackIcon } from './icons'

export interface PushedScreenProps {
  title: string
  onBack: () => void
  children: JSX.Element
}

export const PushedScreen: Component<PushedScreenProps> = (props) => (
  <div
    class="mp-pushed"
    role="group"
    aria-label={props.title}
    data-testid="shell-pushed"
  >
    <div class="mp-pushed__bar">
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
    </div>
    <div class="mp-pushed__body">{props.children}</div>
  </div>
)
