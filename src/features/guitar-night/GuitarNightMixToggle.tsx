// Shared playback-mix toggles keep accompaniment separate from your live input.
import { Show } from 'solid-js'
import { Headphones, HeadphonesOff, Volume2, VolumeX } from '@/components/icons'
import styles from './GuitarNightListeningQuickControls.module.css'

interface GuitarNightBackingToggleProps {
  enabled: boolean
  available: boolean
  compact?: boolean
  onToggle(enabled: boolean): void
}

export function GuitarNightBackingToggle(props: GuitarNightBackingToggleProps) {
  return (
    <button
      type="button"
      class={styles.toggle}
      classList={{ [styles.compact]: props.compact === true }}
      data-on={props.enabled}
      aria-pressed={props.enabled}
      aria-label={props.enabled ? 'Mute backing' : 'Unmute backing'}
      disabled={!props.available}
      title={
        props.available
          ? 'Accompaniment only; your live guitar stays independent.'
          : 'No backing parts available'
      }
      onClick={() => props.onToggle(!props.enabled)}
    >
      <span aria-hidden="true">
        <Show when={props.enabled} fallback={<VolumeX />}>
          <Volume2 />
        </Show>
      </span>
      <span>
        <strong>Backing</strong>
        <small>
          {!props.available ? 'None' : props.enabled ? 'On' : 'Muted'}
        </small>
      </span>
    </button>
  )
}

interface GuitarNightMonitorToggleProps {
  enabled: boolean
  active: boolean
  available: boolean
  disabled?: boolean
  compact?: boolean
  describedBy?: string
  onToggle(enabled: boolean): void
}

export function GuitarNightMonitorToggle(props: GuitarNightMonitorToggleProps) {
  return (
    <button
      type="button"
      class={styles.toggle}
      classList={{
        [styles.monitor]: true,
        [styles.compact]: props.compact === true,
      }}
      data-on={props.enabled}
      aria-pressed={props.enabled}
      aria-label={
        props.enabled ? 'Mute your monitoring' : 'Turn on your monitoring'
      }
      aria-describedby={props.describedBy}
      title={
        props.enabled
          ? 'Your live guitar through the amp'
          : props.available
            ? 'Hear your live guitar through the amp'
            : 'Turn on Direct-input Listening first'
      }
      disabled={!props.enabled && (!props.available || props.disabled === true)}
      onClick={() => props.onToggle(!props.enabled)}
    >
      <span aria-hidden="true">
        <Show when={props.enabled} fallback={<HeadphonesOff />}>
          <Headphones />
        </Show>
      </span>
      <span>
        <strong>You</strong>
        <small>
          {props.active ? 'Live' : props.enabled ? 'Starting' : 'Muted'}
        </small>
      </span>
    </button>
  )
}
