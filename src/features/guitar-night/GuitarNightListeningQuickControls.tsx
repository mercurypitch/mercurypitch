// Direct-input quick controls share capture, backing and live-monitor actions across both rooms.
import { createUniqueId, Show } from 'solid-js'
import { Headphones, HeadphonesOff, Volume2, VolumeX } from '@/components/icons'
import { GuitarNightListeningAction } from './GuitarNightListeningAction'
import styles from './GuitarNightListeningQuickControls.module.css'
import type { GuitarListeningStatus } from './useGuitarListeningController'

interface GuitarNightListeningQuickControlsProps {
  status: GuitarListeningStatus
  listening: boolean
  disabled?: boolean
  backingEnabled: boolean
  hasBacking: boolean
  canMonitor: boolean
  monitoringEnabled: boolean
  monitoringActive: boolean
  onListening(): void
  onBacking(enabled: boolean): void
  onMonitor(enabled: boolean): void
}

export function GuitarNightListeningQuickControls(
  props: GuitarNightListeningQuickControlsProps,
) {
  const helpId = createUniqueId()
  const monitorHelp = () =>
    !props.canMonitor
      ? props.listening
        ? 'Live input unavailable. Check Input in Session.'
        : 'Turn Listening on, then turn Me on to hear your guitar.'
      : props.monitoringEnabled
        ? 'Me plays your live guitar. Keep speaker volume low.'
        : 'Me is muted. Turn it on to hear your guitar.'

  return (
    <div
      class={styles.controls}
      role="group"
      aria-label="Direct input quick controls"
    >
      <div class={styles.toggles}>
        <GuitarNightListeningAction
          compact
          status={props.status}
          listening={props.listening}
          disabled={props.disabled}
          onToggle={() => props.onListening()}
        />
        <button
          type="button"
          class={styles.toggle}
          data-on={props.backingEnabled}
          aria-pressed={props.backingEnabled}
          aria-label={props.backingEnabled ? 'Mute backing' : 'Unmute backing'}
          disabled={!props.hasBacking}
          title={
            props.hasBacking
              ? 'Song or backing parts only; keeps your live guitar audible.'
              : 'No backing parts in this score'
          }
          onClick={() => props.onBacking(!props.backingEnabled)}
        >
          <span aria-hidden="true">
            <Show when={props.backingEnabled} fallback={<VolumeX />}>
              <Volume2 />
            </Show>
          </span>
          <span>
            <strong>Backing</strong>
            <small>
              {!props.hasBacking
                ? 'None'
                : props.backingEnabled
                  ? 'On'
                  : 'Muted'}
            </small>
          </span>
        </button>
        <button
          type="button"
          class={styles.toggle}
          classList={{ [styles.monitor]: true }}
          data-on={props.monitoringEnabled}
          aria-pressed={props.monitoringEnabled}
          aria-label={
            props.monitoringEnabled
              ? 'Mute Me monitoring'
              : 'Turn on Me monitoring'
          }
          aria-describedby={helpId}
          disabled={
            !props.monitoringEnabled &&
            (!props.canMonitor || props.disabled === true)
          }
          onClick={() => props.onMonitor(!props.monitoringEnabled)}
        >
          <span aria-hidden="true">
            <Show when={props.monitoringEnabled} fallback={<HeadphonesOff />}>
              <Headphones />
            </Show>
          </span>
          <span>
            <strong>Me</strong>
            <small>
              {props.monitoringActive
                ? 'Live'
                : props.monitoringEnabled
                  ? 'Starting'
                  : 'Muted'}
            </small>
          </span>
        </button>
      </div>
      <p id={helpId} class={styles.hint}>
        {monitorHelp()}
      </p>
    </div>
  )
}
