// ============================================================
// TransportBar — the standard mobile-stage footer.
// ============================================================
//
// A safe-area-aware bottom row for stage transport controls, with the
// gradient scrim that keeps buttons legible over canvases (the karaoke
// bottom bar's recipe, generalized now that Singing is the second
// consumer). Layout only — buttons are the stage's own children, so the
// bar imposes no control set (HIG: the tab bar navigates, this acts).

import type { Component, JSX } from 'solid-js'
import styles from './TransportBar.module.css'

interface TransportBarProps {
  class?: string
  children: JSX.Element
}

export const TransportBar: Component<TransportBarProps> = (props) => (
  <div class={`${styles.bar} ${props.class ?? ''}`}>{props.children}</div>
)
