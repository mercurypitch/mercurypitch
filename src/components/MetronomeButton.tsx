// ============================================================
// MetronomeButton — Toggle metronome with precount
// ============================================================

import type { Component } from 'solid-js'
import styles from './MetronomeButton.module.css'

interface MetronomeButtonProps {
  active: boolean
  onClick: () => void
}

export const MetronomeButton: Component<MetronomeButtonProps> = (props) => {
  return (
    <button
      id="btn-metronome"
      class={`${styles.ctrlBtn} ${props.active ? styles.active : ''}`}
      onClick={props.onClick}
      title="Toggle metronome"
    >
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="currentColor"
          d="M12 2L8 22h8L12 2zm0 5.5l2.5 10h-5L12 7.5z"
        />
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="5"
          stroke="currentColor"
          stroke-width="1.5"
        />
        <circle cx="12" cy="3.5" r="0.5" fill="currentColor" />
      </svg>
      <span>Metronome</span>
    </button>
  )
}
