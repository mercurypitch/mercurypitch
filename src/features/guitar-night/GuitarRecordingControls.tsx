// Explicit recording controls share the song transport and keep recovery one deliberate action away.
import { Show } from 'solid-js'
import { RecordCircle, Square } from '@/components/icons'
import styles from './GuitarRecording.module.css'
import type { GuitarRecordingController } from './useGuitarRecordingController'

export function recordingTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function GuitarRecordingLiveNotesToggle(props: {
  enabled: boolean
  onChange(enabled: boolean): void
}) {
  return (
    <label
      class={styles.liveNotesToggle}
      title="Show recently recognized notes. Turning this off reduces visual work; audio recording and monitoring continue."
    >
      <input
        type="checkbox"
        checked={props.enabled}
        onChange={(event) => props.onChange(event.currentTarget.checked)}
      />
      Live notes
    </label>
  )
}

export function GuitarRecordButton(props: {
  controller: GuitarRecordingController
  disabled?: boolean
  showDuration?: boolean
  iconOnly?: boolean
  disabledReason?: string
}) {
  return (
    <div class={styles.recordControl}>
      <button
        type="button"
        class={styles.recordButton}
        aria-label={
          props.controller.state() === 'idle'
            ? 'Record a melody'
            : props.controller.state() === 'preparing'
              ? 'Cancel recording start'
              : 'Stop recording'
        }
        aria-pressed={props.controller.busy()}
        title={props.disabled === true ? props.disabledReason : undefined}
        disabled={
          props.disabled === true || props.controller.state() === 'stopping'
        }
        onClick={() =>
          props.controller.busy()
            ? void props.controller.stop()
            : void props.controller.start()
        }
      >
        <span aria-hidden="true">
          <Show when={props.controller.busy()} fallback={<RecordCircle />}>
            <Square />
          </Show>
        </span>
        <Show when={props.iconOnly !== true}>
          <span>
            {props.controller.state() === 'recording'
              ? 'Stop'
              : props.controller.state() === 'preparing'
                ? 'Cancel'
                : props.controller.state() === 'stopping'
                  ? 'Saving…'
                  : 'Record'}
          </span>
        </Show>
      </button>
      <Show when={props.controller.busy() && props.showDuration !== false}>
        <output aria-label="Recording duration">
          {recordingTime(props.controller.duration())} / 5:00
        </output>
      </Show>
    </div>
  )
}

export function GuitarRecordingStatus(props: {
  controller: GuitarRecordingController
}) {
  return (
    <div class={styles.status}>
      <Show when={props.controller.error()}>
        {(error) => <p role="alert">{error()}</p>}
      </Show>
    </div>
  )
}
