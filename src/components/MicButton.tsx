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
      class={`ctrl-btn ${props.active ? 'recording' : ''}`}
      onClick={() => props.onClick?.()}
      disabled={props.disabled}
      title={props.active ? 'Disable microphone' : 'Enable microphone'}
    >
      {props.active ? (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect x="9" y="2" width="6" height="11" rx="3" fill="currentColor" />
          <path
            d="M19 10a7 7 0 01-10 6.33V18a1 1 0 01-2 0v-1.67A7 7 0 015 10a7 7 0 007 7 1 1 0 010 2 9 9 0 009-9z"
            fill="currentColor"
          />
          <circle cx="12" cy="20" r="1.5" fill="currentColor" />
          <circle cx="12" cy="3" r="1" fill="#f85149" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18">
          <rect
            x="9"
            y="2"
            width="6"
            height="11"
            rx="3"
            fill="currentColor"
            opacity="0.4"
          />
          <path
            d="M19 10a7 7 0 01-10 6.33V18a1 1 0 01-2 0v-1.67A7 7 0 015 10a7 7 0 007 7 1 1 0 010 2 9 9 0 009-9z"
            fill="currentColor"
            opacity="0.4"
          />
          <line
            x1="2"
            y1="2"
            x2="22"
            y2="22"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      )}
      <span>{props.active ? 'Mic On' : 'Mic Off'}</span>
    </button>
  )
}
