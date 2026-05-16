// ── JamExerciseControls ───────────────────────────────────────────────
// Host-only transport bar for shared exercise playback.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { clearJamExercise, jamExerciseMelody, jamExercisePaused, jamExercisePlaying, jamIsHost, jamPlaybackPause, jamPlaybackPlay, jamPlaybackStop, } from '@/stores/jam-store'
import styles from './JamExerciseControls.module.css'

interface JamExerciseControlsProps {
  onSelectExercise: () => void
}

export const JamExerciseControls: Component<JamExerciseControlsProps> = (
  props,
) => {
  return (
    <Show when={jamIsHost()}>
      <div class={styles.controls}>
        <button class={styles.btn} onClick={() => props.onSelectExercise()}>
          Select Exercise
        </button>
        <Show when={jamExerciseMelody()}>
          <Show
            when={jamExercisePlaying() && !jamExercisePaused()}
            fallback={
              <button
                class={`${styles.btn} ${styles.play}`}
                onClick={() => jamPlaybackPlay()}
              >
                Play
              </button>
            }
          >
            <button
              class={`${styles.btn} ${styles.pause}`}
              onClick={jamPlaybackPause}
            >
              Pause
            </button>
          </Show>
          <button
            class={`${styles.btn} ${styles.stop}`}
            onClick={jamPlaybackStop}
          >
            Stop
          </button>
          <button
            class={`${styles.btn} ${styles.clear}`}
            onClick={clearJamExercise}
          >
            Clear
          </button>
        </Show>
      </div>
    </Show>
  )
}
