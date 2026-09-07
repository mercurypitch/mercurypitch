// Explicit recording controls share the song transport and keep recovery one deliberate action away.
import { For, Show } from 'solid-js'
import { RecordCircle, Square } from '@/components/icons'
import styles from './GuitarRecording.module.css'
import type { GuitarRecordingController } from './useGuitarRecordingController'

export function recordingTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

export function GuitarRecordButton(props: {
  controller: GuitarRecordingController
  disabled?: boolean
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
        <span>
          {props.controller.state() === 'recording'
            ? 'Stop'
            : props.controller.state() === 'preparing'
              ? 'Cancel'
              : props.controller.state() === 'stopping'
                ? 'Saving…'
                : 'Record'}
        </span>
      </button>
      <Show when={props.controller.busy()}>
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
      <Show when={props.controller.state() === 'recording'}>
        <p>
          Recording dry input
          {props.controller.heardNote() !== null
            ? ` · ${props.controller.heardNote()}`
            : ''}{' '}
          · {props.controller.noteCount()} completed notes. Position, loop and
          speed are locked.
        </p>
      </Show>
      <Show when={!props.controller.busy()}>
        <Show when={props.controller.catalogue().length > 0}>
          <details>
            <summary>
              My melodies · {props.controller.catalogue().length}
              <Show
                when={props.controller
                  .catalogue()
                  .some((row) => row.state !== 'kept')}
              >
                {' '}
                · draft to review
              </Show>
            </summary>
            <For each={props.controller.catalogue()}>
              {(row) => (
                <button
                  type="button"
                  onClick={() => void props.controller.recover(row.id)}
                >
                  {row.state === 'capturing' ? 'Recover' : 'Review'} {row.title}
                  <small>
                    {recordingTime(row.frames / row.sampleRate)} ·{' '}
                    {row.state === 'kept'
                      ? row.takeId === null
                        ? 'audio removed · notes kept'
                        : 'kept on this device'
                      : 'saved draft on this device'}
                  </small>
                </button>
              )}
            </For>
          </details>
        </Show>
      </Show>
    </div>
  )
}
