// ============================================================
// SheetViewToggle — in-flow Melody / Notation segmented control
// ============================================================

import type { Component } from 'solid-js'
import { Music, MusicBoard } from '@/components/icons'
import styles from './SheetViewToggle.module.css'

interface SheetViewToggleProps {
  /** true when the sheet-music view is active */
  active: () => boolean
  onToggle: (sheet: boolean) => void
}

export const SheetViewToggle: Component<SheetViewToggleProps> = (props) => {
  return (
    <div
      class={styles.toggle}
      role="group"
      aria-label="Visualization view"
      data-tour="view.sheet-toggle"
    >
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.btnActive]: !props.active() }}
        aria-pressed={!props.active()}
        title="Show the scrolling melody guide"
        onClick={() => props.onToggle(false)}
      >
        <MusicBoard />
        <span class={styles.label}>Melody</span>
      </button>
      <button
        type="button"
        class={styles.btn}
        classList={{ [styles.btnActive]: props.active() }}
        aria-pressed={props.active()}
        title="Show standard music notation"
        onClick={() => props.onToggle(true)}
      >
        <Music />
        <span class={styles.label}>Notation</span>
      </button>
    </div>
  )
}
