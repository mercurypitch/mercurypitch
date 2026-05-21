// ============================================================
// MicButton — Microphone toggle button
// ============================================================

import type { Component } from 'solid-js'
import styles from './MicButton.module.css'

interface MicButtonProps {
  active: boolean
  onClick: () => void
  disabled?: boolean
}

export const MicButton: Component<MicButtonProps> = (props) => {
  return (
    <button
      id="btn-mic"
      class={`${styles.ctrlBtn} ${props.active ? styles.recording : ''}`}
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
      title={props.active ? 'Disable microphone' : 'Enable microphone'}
    >
      {props.active ? (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="currentColor"
          opacity="0.6"
        >
          <path d="M19 11h-2c0 .91-.26 1.75-.69 2.48l1.46 1.46A6.921 6.921 0 0019 11zM14.98 11.17c.01-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3s-3 1.34-3 3v1.17l5.98 5.98zM4.27 3L3 4.27l6 6V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.37-.2 2.62-.77 3.65-1.55l2.08 2.08 1.27-1.27L4.27 3z" />
        </svg>
      )}
    </button>
  )
}
