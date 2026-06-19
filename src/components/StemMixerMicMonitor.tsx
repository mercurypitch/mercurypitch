// ============================================================
// StemMixerMicMonitor — sidebar control to hear yourself (karaoke)
// ============================================================
//
// Lives next to the stem volume faders in the right sidebar. When the mic is
// active, lets the user toggle self-monitoring and set how loud their own
// voice is fed back over the backing track.

import type { Accessor, Component } from 'solid-js'
import { Show } from 'solid-js'
import { Headphones } from './icons'

export interface StemMixerMicMonitorProps {
  micActive: Accessor<boolean>
  monitorEnabled: Accessor<boolean>
  monitorVolume: Accessor<number>
  onToggleMonitor: (enabled: boolean) => void
  onVolumeChange: (volume: number) => void
}

export const StemMixerMicMonitor: Component<StemMixerMicMonitorProps> = (
  props,
) => {
  return (
    <Show when={props.micActive()}>
      <div class="sm-mic-monitor">
        <button
          class="sm-mic-monitor-toggle"
          classList={{
            'sm-mic-monitor-toggle--active': props.monitorEnabled(),
          }}
          onClick={() => props.onToggleMonitor(!props.monitorEnabled())}
          title={
            props.monitorEnabled()
              ? 'Mute self-monitoring'
              : 'Hear my voice over the track (use headphones)'
          }
        >
          <Headphones />
          <span>Hear myself</span>
        </button>
        <div class="sm-mic-monitor-row">
          <input
            class="sm-mic-monitor-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={props.monitorVolume()}
            disabled={!props.monitorEnabled()}
            onInput={(e) =>
              props.onVolumeChange(parseFloat(e.currentTarget.value))
            }
            aria-label="Self-monitor volume"
          />
          <span class="sm-mic-monitor-pct">
            {Math.round(props.monitorVolume() * 100)}%
          </span>
        </div>
        <Show when={props.monitorEnabled()}>
          <p class="sm-mic-monitor-hint">Use headphones to avoid feedback.</p>
        </Show>
      </div>
    </Show>
  )
}
