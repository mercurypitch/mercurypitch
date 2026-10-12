// ============================================================
// The room's controls: the mic button, a result's Again and Done, and the
// mic's blocked notice
// ============================================================
//
// The big round mic button under a premium room's stage starts a take and
// stops it; it rings while it listens, dims while a demo sings through the
// room, and nudges once after the demo's Try it. A result swaps it for
// Again and Done. A microphone that will not open swaps it for a notice
// and Try again, with Open Settings when the phone refused it and the
// shell can open the app's settings. The room says when each shows, and
// gives each its test id.

import type { JSX } from 'solid-js'
import { Show } from 'solid-js'
import { Mic } from '@/components/icons'
import { nativeShellApi } from '@/stores/native-shell-store'
import styles from './RoomControls.module.css'
import type { CaptureFailure } from './useExerciseCapture'

export interface MicButtonProps {
  /** The mic is open and hearing the singer: the ring quickens. */
  listening: boolean
  /** A demo sings through the room: the mic is not listening and looks it. */
  demo: boolean
  /** One nudge, after the demo's Try it. */
  pulse: boolean
  disabled: boolean
  label: string
  onClick: () => void
  testId: string
}

export function MicButton(props: MicButtonProps): JSX.Element {
  return (
    <button
      type="button"
      class={styles.mic}
      classList={{
        [styles.micListening]: props.listening,
        [styles.micDemo]: props.demo,
        [styles.micPulse]: props.pulse,
      }}
      disabled={props.disabled}
      aria-label={props.label}
      onClick={() => props.onClick()}
      data-testid={props.testId}
    >
      <Mic />
    </button>
  )
}

export interface ResultActionsProps {
  onAgain: () => void
  onDone: () => void
  againTestId: string
  doneTestId: string
}

/** A result's two ways on: the same again, or out of the room. */
export function ResultActions(props: ResultActionsProps): JSX.Element {
  return (
    <div class={styles.actions}>
      <button
        type="button"
        class={styles.again}
        onClick={() => props.onAgain()}
        data-testid={props.againTestId}
      >
        Again
      </button>
      <button
        type="button"
        class={styles.done}
        onClick={() => props.onDone()}
        data-testid={props.doneTestId}
      >
        Done
      </button>
    </div>
  )
}

export interface MicBlockedProps {
  /** Why the mic did not open. */
  block: CaptureFailure | null
  /** Try again: a new start, from the same tap. */
  onRetry: () => void
  retryTestId: string
}

/** The mic would not open: why, and the way back. */
export function MicBlocked(props: MicBlockedProps): JSX.Element {
  return (
    <>
      <p class={styles.blocked} role="alert">
        {props.block === 'denied'
          ? 'Merc needs the microphone to hear your note. Allow it in Settings, then try again.'
          : 'The microphone did not open. Check that no other app is using it, then try again.'}
      </p>
      <div class={styles.actions}>
        <Show
          when={props.block === 'denied' && nativeShellApi()?.openAppSettings}
        >
          {(open) => (
            <button
              type="button"
              class={styles.again}
              onClick={() => void open()()}
            >
              Open Settings
            </button>
          )}
        </Show>
        <button
          type="button"
          class={styles.done}
          onClick={() => props.onRetry()}
          data-testid={props.retryTestId}
        >
          Try again
        </button>
      </div>
    </>
  )
}
