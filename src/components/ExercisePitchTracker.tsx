import { Show, type Component } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'
import { PitchOverTimeCanvas } from '@/components/PitchOverTimeCanvas'

interface ExercisePitchTrackerProps {
  pitchHistory: () => Array<{
    freq: number
    time: number
    cents: number
    clarity?: number
  }>
  isActive: () => boolean
}

export const ExercisePitchTracker: Component<ExercisePitchTrackerProps> = (
  props,
) => {
  const [visible, setVisible] = createPersistedSignal<boolean>(
    'pitchperfect_exercise_tracker',
    false,
  )

  const toggle = () => setVisible((v) => !v)

  return (
    <>
      <button
        type="button"
        class={`exercise-pitch-tracker-toggle${visible() ? ' exercise-pitch-tracker-toggle-on' : ''}`}
        onClick={toggle}
      >
        {visible() ? 'Hide Tracker' : 'Show Tracker'}
      </button>
      <Show when={visible()}>
        <div class="exercise-pitch-tracker">
          <PitchOverTimeCanvas
            samples={props.pitchHistory}
            isDetecting={props.isActive}
            visibleWindowSeconds={10}
          />
        </div>
      </Show>
    </>
  )
}
