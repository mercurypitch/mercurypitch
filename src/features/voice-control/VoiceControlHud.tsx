// ============================================================
// VoiceControlHud — the ambient hands-free control pill
// ============================================================
//
// Bottom-left, sharing the corner with the practice-timer pill: when that
// pill is visible this one raises itself a row so both stay readable.
// Deliberately quiet — an icon button when idle, live text only while the
// listener hears something or a command just landed. Not a live region:
// interim transcripts change many times a second while music plays.

import { Show } from 'solid-js'
import { Mic } from '@/components/icons'
import { practiceTimerVisible } from '@/stores/practice-timer-store'
import type { VoiceControlController } from './useVoiceControlController'
import styles from './VoiceControlHud.module.css'

interface VoiceControlHudProps {
  controller: VoiceControlController
}

export function VoiceControlHud(props: VoiceControlHudProps) {
  const listening = () =>
    props.controller.enabled() &&
    props.controller.listenerState() === 'listening'
  const hasError = () =>
    props.controller.enabled() && props.controller.listenerState() === 'error'

  const statusText = () => {
    if (hasError()) {
      // The mic and the model fail differently; say which one it was.
      return props.controller.errorDetail() === 'local-engine-failed'
        ? 'Voice engine failed'
        : 'Mic unavailable'
    }
    if (props.controller.listenerState() === 'starting') {
      return 'Loading voice engine'
    }
    const fb = props.controller.feedback()
    if (fb !== null && fb.kind === 'matched') return fb.action ?? 'Done'
    if (fb !== null && (fb.kind === 'failed' || fb.kind === 'unavailable')) {
      return fb.message ?? 'Could not do that'
    }
    const interim = props.controller.interim()
    if (interim !== '') return interim
    if (fb !== null) return `"${fb.heard}"?`
    return 'Listening'
  }

  const title = () => {
    if (!props.controller.isSupported) {
      return 'Voice control is not supported in this browser (try Chrome, Edge or Safari)'
    }
    return props.controller.enabled()
      ? 'Turn voice control off (V)'
      : 'Turn voice control on (V)'
  }

  return (
    <div
      class={styles.pill}
      classList={{
        [styles.raised]: practiceTimerVisible(),
        [styles.expanded]: props.controller.enabled(),
      }}
      data-testid="voice-control-pill"
    >
      <button
        type="button"
        class={styles.toggle}
        classList={{
          [styles.listening]: listening(),
          [styles.errorState]: hasError(),
          [styles.unsupported]: !props.controller.isSupported,
        }}
        aria-pressed={props.controller.enabled()}
        aria-label={title()}
        title={title()}
        onClick={() => props.controller.toggle()}
      >
        <Mic />
      </button>
      <Show when={props.controller.enabled()}>
        <span
          class={styles.status}
          classList={{
            [styles.statusMatched]:
              props.controller.feedback()?.kind === 'matched',
            [styles.statusMiss]:
              props.controller.feedback()?.kind === 'unrecognized',
            [styles.statusWarn]:
              props.controller.feedback()?.kind === 'failed' ||
              props.controller.feedback()?.kind === 'unavailable',
          }}
          title={props.controller.feedback()?.heard ?? ''}
          data-testid="voice-control-status"
        >
          {statusText()}
        </span>
        <Show when={props.controller.lastLatencyMs() !== null}>
          <span
            class={styles.latency}
            title="End-of-speech to text time (on-device engine)"
          >
            {props.controller.lastLatencyMs()} ms
          </span>
        </Show>
      </Show>
    </div>
  )
}
