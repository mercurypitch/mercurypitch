// ============================================================
// TransportBar — the standard mobile-stage footer.
// ============================================================
//
// A safe-area-aware bottom row for stage transport controls, with the
// gradient scrim that keeps buttons legible over canvases (the karaoke
// bottom bar's recipe, generalized now that Singing is the second
// consumer). Layout only — buttons are the stage's own children, so the
// bar imposes no control set (HIG: the tab bar navigates, this acts).
//
// While it stands across the window's foot the bar is a page's dock: it
// publishes its room as --page-dock-space (lib/foot-space.ts), and the
// notices stand on it instead of over its buttons. Upright the Singing
// stage's mic notice lay over its transport (8-382 x 679-780 against a bar
// at 706-782, at 390x844), and the Piano stage's did the same. On its side
// the Singing bar is in the stage's left column and the notices stand
// beside it, so the stage says when it docks (`dock`). The native app says
// a notice in its own pill, and its shell holds the foot: it publishes
// nothing.

import type { Component, JSX } from 'solid-js'
import { PAGE_DOCK_SPACE, publishFootSpace } from '@/lib/foot-space'
import { IS_NATIVE_BUILD } from '@/lib/native-build'
import styles from './TransportBar.module.css'

interface TransportBarProps {
  class?: string
  /** While true, the notices stand on this bar: it spans the window's foot. */
  dock?: () => boolean
  children: JSX.Element
}

export const TransportBar: Component<TransportBarProps> = (props) => (
  <div
    ref={(el) => {
      const dock = props.dock
      if (!IS_NATIVE_BUILD && dock !== undefined) {
        publishFootSpace(el, PAGE_DOCK_SPACE, 'self', dock)
      }
    }}
    class={`${styles.bar} ${props.class ?? ''}`}
    data-testid="mobile-transport-bar"
  >
    {props.children}
  </div>
)
