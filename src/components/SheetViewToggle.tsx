// ============================================================
// SheetViewToggle — compact Notes / Sheet switch for a canvas surface
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
      role="tablist"
      aria-label="Visualization view"
      data-tour="view.sheet-toggle"
    >
      <button
        type="button"
        role="tab"
        class={styles.btn}
        classList={{ [styles.btnActive]: !props.active() }}
        aria-selected={!props.active()}
        title="Notes view"
        onClick={() => props.onToggle(false)}
      >
        <MusicBoard />
        <span class={styles.label}>Notes</span>
      </button>
      <button
        type="button"
        role="tab"
        class={styles.btn}
        classList={{ [styles.btnActive]: props.active() }}
        aria-selected={props.active()}
        title="Sheet music view"
        onClick={() => props.onToggle(true)}
      >
        <Music />
        <span class={styles.label}>Sheet</span>
      </button>
    </div>
  )
}
