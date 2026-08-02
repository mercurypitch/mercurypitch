// ── JamGuideVocal ─────────────────────────────────────────────────────
// How loud the original singer is, in YOUR ears only.
//
// This is deliberately not room state, and it is the one setting in the
// room that should not be: how much guide you need to learn a song is
// about you, not about what the room is doing. Someone who knows the
// track wants it off; someone hearing it for the first time wants it up.
// Every peer has its own audio element, so per-person costs nothing.
//
// Collapsed to a button, expanding to a slider on hover or focus --
// the shape the stem mixer's mic control already uses, so the gesture is
// one people have met before.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import styles from './JamGuideVocal.module.css'

interface JamGuideVocalProps {
  volume: () => number
  onVolume: (v: number) => void
}

export const JamGuideVocal: Component<JamGuideVocalProps> = (props) => {
  const [open, setOpen] = createSignal(false)
  const muted = () => props.volume() <= 0

  return (
    <div
      class={styles.control}
      classList={{ [styles.controlOpen]: open() }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusIn={() => setOpen(true)}
      onFocusOut={() => setOpen(false)}
    >
      <button
        class={styles.btn}
        classList={{ [styles.btnMuted]: muted() }}
        // A tap toggles rather than only expanding: on a phone there is no
        // hover, and "mute the guide" should not need two gestures.
        onClick={() => props.onVolume(muted() ? 0.5 : 0)}
        title={
          muted()
            ? 'Play the original vocal as a guide (only you hear this)'
            : 'Mute the guide vocal'
        }
        aria-label="Guide vocal"
        aria-pressed={!muted()}
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
        </svg>
      </button>
      <input
        class={styles.slider}
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={props.volume()}
        aria-label="Guide vocal volume"
        onInput={(e) => props.onVolume(Number(e.currentTarget.value))}
      />
    </div>
  )
}
