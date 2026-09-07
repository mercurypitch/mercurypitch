// Direct-input quick controls share capture, backing and live-monitor actions across both rooms.
import { createUniqueId } from 'solid-js'
import { GuitarNightListeningAction } from './GuitarNightListeningAction'
import styles from './GuitarNightListeningQuickControls.module.css'
import { GuitarNightBackingToggle, GuitarNightMonitorToggle, } from './GuitarNightMixToggle'
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
        : 'Turn Listening on, then enable your live sound.'
      : props.monitoringEnabled
        ? 'Your live guitar plays through the amp.'
        : 'Your live sound is muted. Turn it on to hear your guitar.'

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
        <GuitarNightBackingToggle
          enabled={props.backingEnabled}
          available={props.hasBacking}
          onToggle={props.onBacking}
        />
        <GuitarNightMonitorToggle
          enabled={props.monitoringEnabled}
          active={props.monitoringActive}
          available={props.canMonitor}
          disabled={props.disabled}
          describedBy={helpId}
          onToggle={props.onMonitor}
        />
      </div>
      <p id={helpId} class={styles.hint}>
        {monitorHelp()}
      </p>
    </div>
  )
}
