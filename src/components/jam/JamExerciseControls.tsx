// ── JamExerciseControls ───────────────────────────────────────────────
// Host-only transport bar for shared exercise playback.

import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import {
  clearJamExercise,
  jamExerciseMelody,
  jamExercisePlaying,
  jamExercisePaused,
  jamIsHost,
  jamPlaybackPause,
  jamPlaybackPlay,
  jamPlaybackStop,
} from '@/stores/jam-store'

interface JamExerciseControlsProps {
  onSelectExercise: () => void
}

export const JamExerciseControls: Component<JamExerciseControlsProps> = (
  props,
) => {
  return (
    <Show when={jamIsHost()}>
      <div class="jam-exercise-controls">
        <button
          class="jam-ex-btn"
          onClick={props.onSelectExercise}
          disabled={false}
        >
          Select Exercise
        </button>
        <Show when={jamExerciseMelody()}>
          <Show
            when={jamExercisePlaying() && !jamExercisePaused()}
            fallback={
              <button
                class="jam-ex-btn jam-ex-play"
                onClick={() => jamPlaybackPlay()}
              >
                Play
              </button>
            }
          >
            <button class="jam-ex-btn jam-ex-pause" onClick={jamPlaybackPause}>
              Pause
            </button>
          </Show>
          <button class="jam-ex-btn jam-ex-stop" onClick={jamPlaybackStop}>
            Stop
          </button>
          <button class="jam-ex-btn jam-ex-clear" onClick={clearJamExercise}>
            Clear
          </button>
        </Show>
      </div>
    </Show>
  )
}
