// ============================================================
// Glass — the FX rack rail (plan §17.1): three crafted sliders
// (Echo · Reverb · Hall) + the cosmic preset pills. Docked left
// of the mirror on desktop, stacked beneath it on mobile. The
// live-monitor toggle is headphone-gated: enabling it requires
// an explicit "I'm wearing headphones" confirmation.
// ============================================================

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { FxSettings } from './fx-rack'
import { FX_PRESETS, presetNameFor } from './fx-rack'

interface SliderSpec {
  key: keyof FxSettings
  label: string
}

const SLIDERS: readonly SliderSpec[] = [
  { key: 'echo', label: 'Echo' },
  { key: 'reverb', label: 'Reverb' },
  { key: 'hall', label: 'Hall' },
]

export const FxRackPanel: Component<{
  settings: FxSettings
  onChange: (settings: FxSettings) => void
  /** Fired on slider release / preset tap — the funnel commit point. */
  onCommit: (settings: FxSettings) => void
  /** Monitor controls only make sense while singing live. */
  showMonitor: boolean
  monitorOn: boolean
  monitorConfirming: boolean
  monitorNotice: string | null
  onMonitorToggle: () => void
  onMonitorConfirm: () => void
  onMonitorCancel: () => void
}> = (props) => {
  const activePreset = (): string | null => presetNameFor(props.settings)

  const setValue = (key: keyof FxSettings, value: number): void => {
    props.onChange({ ...props.settings, [key]: value })
  }

  return (
    <aside class="glass-fx" aria-label="Voice effects">
      <p class="glass-fx-title">Your room</p>
      <For each={SLIDERS}>
        {(slider) => (
          <label class="glass-fx-row">
            <span class="glass-fx-label">{slider.label}</span>
            <input
              class="glass-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={props.settings[slider.key]}
              style={{
                '--fill': `${props.settings[slider.key]}%`,
              }}
              onInput={(event) =>
                setValue(slider.key, Number(event.currentTarget.value))
              }
              onChange={() => props.onCommit(props.settings)}
            />
            <span class="glass-fx-value">{props.settings[slider.key]}</span>
          </label>
        )}
      </For>
      <div class="glass-fx-presets" role="group" aria-label="Effect presets">
        <For each={FX_PRESETS}>
          {(preset) => (
            <button
              type="button"
              class="glass-fx-pill"
              classList={{ on: activePreset() === preset.name }}
              aria-pressed={activePreset() === preset.name}
              onClick={() => {
                props.onChange({ ...preset.settings })
                props.onCommit(preset.settings)
              }}
            >
              {preset.name}
            </button>
          )}
        </For>
      </div>

      <Show when={props.showMonitor}>
        <div class="glass-fx-monitor">
          <Show
            when={props.monitorConfirming}
            fallback={
              <button
                type="button"
                class="glass-fx-pill glass-fx-monitor-toggle"
                classList={{ on: props.monitorOn }}
                aria-pressed={props.monitorOn}
                onClick={() => props.onMonitorToggle()}
              >
                Hear yourself live {props.monitorOn ? 'on' : 'off'}
              </button>
            }
          >
            <p class="glass-fx-confirm">
              Speakers would feed back — headphones only.
            </p>
            <div class="glass-fx-confirm-actions">
              <button
                type="button"
                class="glass-fx-pill on"
                onClick={() => props.onMonitorConfirm()}
              >
                I'm wearing headphones
              </button>
              <button
                type="button"
                class="glass-fx-pill"
                onClick={() => props.onMonitorCancel()}
              >
                Cancel
              </button>
            </div>
          </Show>
          <Show when={props.monitorNotice}>
            <p class="glass-fx-notice">{props.monitorNotice}</p>
          </Show>
        </div>
      </Show>
    </aside>
  )
}
