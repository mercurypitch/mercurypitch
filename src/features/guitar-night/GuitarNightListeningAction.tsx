// Shared Session action keeps starting, stopping and cancelling Listening explicit.
import { Mic } from '@/components/icons'
import styles from './GuitarNightApp.module.css'
import quickStyles from './GuitarNightListeningQuickControls.module.css'
import type { GuitarListeningStatus } from './useGuitarListeningController'

interface GuitarNightListeningActionProps {
  status: GuitarListeningStatus
  listening: boolean
  disabled?: boolean
  detail?: string
  compact?: boolean
  onToggle(): void
}

export function GuitarNightListeningAction(
  props: GuitarNightListeningActionProps,
) {
  return (
    <button
      type="button"
      class={
        props.compact === true ? quickStyles.toggle : styles.sessionListening
      }
      classList={{
        [styles.listeningActive]: props.compact !== true && props.listening,
      }}
      data-on={props.listening}
      aria-pressed={props.listening}
      disabled={props.disabled === true && !props.listening}
      aria-label={
        props.status === 'requesting'
          ? 'Cancel opening input'
          : props.status === 'calibrating'
            ? 'Stop calibration'
            : props.listening
              ? 'Stop Listening'
              : 'Turn on Listening'
      }
      onClick={() => props.onToggle()}
    >
      <span aria-hidden="true">
        <Mic />
      </span>
      <span>
        <strong>
          {props.compact === true
            ? 'Listening'
            : props.status === 'requesting'
              ? 'Opening input'
              : props.status === 'calibrating'
                ? 'Calibrating'
                : props.listening
                  ? 'Listening is on'
                  : 'Turn on Listening'}
        </strong>
        <small>
          {props.compact === true
            ? props.status === 'requesting'
              ? 'Cancel'
              : props.status === 'calibrating'
                ? 'Stop test'
                : props.listening
                  ? 'On'
                  : 'Off'
            : (props.detail ?? 'Hear notes and enable a live score.')}
        </small>
      </span>
    </button>
  )
}
