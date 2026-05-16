// ── JamExerciseControls ───────────────────────────────────────────────
// Host-only transport bar for shared exercise playback.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { clearJamExercise, jamExerciseMelody, jamExercisePaused, jamExercisePlaying, jamIsHost, jamPlaybackPause, jamPlaybackPlay, jamPlaybackStop, } from '@/stores/jam-store'
import styles from './JamExerciseControls.module.css'

interface JamExerciseControlsProps {
  onSelectExercise: () => void
  loopEnabled?: boolean
  onToggleLoop?: () => void
}

export const JamExerciseControls: Component<JamExerciseControlsProps> = (
  props,
) => {
  return (
    <Show when={jamIsHost()}>
      <div class={styles.bar}>
        {/* Select exercise */}
        <button
          class={`${styles.btn} ${styles.btnSelect}`}
          onClick={() => props.onSelectExercise()}
          title="Choose a melody to practice"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <span>Exercise</span>
        </button>

        <Show when={jamExerciseMelody()}>
          <div class={styles.divider} />

          {/* Play / Pause toggle */}
          <Show
            when={jamExercisePlaying() && !jamExercisePaused()}
            fallback={
              <button
                class={`${styles.btn} ${styles.btnPlay}`}
                onClick={() => jamPlaybackPlay()}
                title="Start playback for all peers"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Play</span>
              </button>
            }
          >
            <button
              class={`${styles.btn} ${styles.btnPause}`}
              onClick={jamPlaybackPause}
              title="Pause playback"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              <span>Pause</span>
            </button>
          </Show>

          {/* Stop */}
          <button
            class={`${styles.btn} ${styles.btnStop}`}
            onClick={jamPlaybackStop}
            title="Stop and reset playback"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            <span>Stop</span>
          </button>

          {/* Loop toggle */}
          <Show when={props.onToggleLoop !== undefined}>
            <button
              class={`${styles.btn} ${props.loopEnabled === true ? styles.btnLoopOn : styles.btnLoopOff}`}
              onClick={() => props.onToggleLoop?.()}
              title={
                props.loopEnabled === true
                  ? 'Loop on — click to disable'
                  : 'Loop off — click to enable'
              }
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span>Loop</span>
            </button>
          </Show>

          {/* Clear */}
          <button
            class={`${styles.btn} ${styles.btnClear}`}
            onClick={clearJamExercise}
            title="Clear exercise selection"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </Show>
      </div>
    </Show>
  )
}
