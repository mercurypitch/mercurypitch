import { Show, type Component } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { PitchOverTimeCanvas } from '@/components/PitchOverTimeCanvas'

interface ExercisePitchTrackerProps {
  pitchHistory: () => Array<{
    freq: number
    time: number
    cents: number
    clarity?: number
    noteName?: string
  }>
  isActive: () => boolean
}

export const ExercisePitchTracker: Component<ExercisePitchTrackerProps> = (
  props,
) => {
  const [visible, setVisible] = createPersistedSignal<boolean>(
    'pitchperfect_exercise_tracker',
    true,
  )

  const toggle = () => setVisible((v) => !v)

  return (
    <>
      <Show when={visible()}>
        <div class="exercise-pitch-tracker">
          <button
            type="button"
            class="exercise-pitch-tracker-toggle"
            onClick={toggle}
            title="Hide pitch tracker"
            aria-label="Hide pitch tracker"
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
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </button>
          <PitchOverTimeCanvas
            samples={props.pitchHistory}
            isDetecting={props.isActive}
            visibleWindowSeconds={10}
          />
        </div>
      </Show>
      <Show when={!visible()}>
        <button
          type="button"
          class="exercise-pitch-tracker-show"
          onClick={toggle}
        >
          Show Tracker
        </button>
      </Show>
    </>
  )
}
