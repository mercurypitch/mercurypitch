// ============================================================
// Voice Room Panel — one non-destructive playback space for every A/B take
// ============================================================

import type { Component } from 'solid-js'
import { createUniqueId, For } from 'solid-js'
import type { FxSettings } from '@/lib/voice-fx-rack'
import { FX_PRESETS, normalizeFxSettings, presetNameFor, } from '@/lib/voice-fx-rack'
import styles from './VoiceRoomPanel.module.css'

interface RoomControl {
  key: keyof FxSettings
  label: string
  detail: string
}

const ROOM_CONTROLS: readonly RoomControl[] = [
  { key: 'echo', label: 'Echo', detail: 'Near reflection' },
  { key: 'reverb', label: 'Reverb', detail: 'Room bloom' },
  { key: 'hall', label: 'Hall', detail: 'Long space' },
]

export const VoiceRoomPanel: Component<{
  settings: FxSettings
  onChange: (settings: FxSettings) => void
}> = (props) => {
  const titleId = createUniqueId()
  const activePreset = (): string =>
    presetNameFor(props.settings) ?? 'Custom room'

  const setValue = (key: keyof FxSettings, value: number): void => {
    props.onChange(
      normalizeFxSettings({
        ...props.settings,
        [key]: value,
      }),
    )
  }

  return (
    <section class={styles.room} aria-labelledby={titleId}>
      <div class={styles.roomHeading}>
        <div>
          <span>Listening room</span>
          <h3 id={titleId}>Place every replay in the same space.</h3>
        </div>
        <output aria-live="polite">{activePreset()}</output>
      </div>

      <div class={styles.presetRow} role="group" aria-label="Room presets">
        <For each={FX_PRESETS}>
          {(preset) => {
            const active = (): boolean => activePreset() === preset.name
            return (
              <button
                type="button"
                classList={{ [styles.preset]: true, [styles.active]: active() }}
                aria-pressed={active()}
                onClick={() => props.onChange({ ...preset.settings })}
              >
                {preset.name}
              </button>
            )
          }}
        </For>
      </div>

      <div class={styles.controls}>
        <For each={ROOM_CONTROLS}>
          {(control) => (
            <label class={styles.control}>
              <span class={styles.controlCopy}>
                <strong>{control.label}</strong>
                <small>{control.detail}</small>
              </span>
              <input
                type="range"
                data-testid={`voice-room-${control.key}`}
                aria-label={`${control.label} room effect`}
                min="0"
                max="100"
                step="1"
                value={props.settings[control.key]}
                aria-valuetext={`${props.settings[control.key]} percent`}
                style={{
                  '--room-fill': `${props.settings[control.key]}%`,
                }}
                onInput={(event) =>
                  setValue(control.key, Number(event.currentTarget.value))
                }
              />
              <output>{Math.round(props.settings[control.key])}</output>
            </label>
          )}
        </For>
      </div>

      <p class={styles.note}>
        Playback only. Your saved recording stays dry, private, and unchanged.
      </p>
    </section>
  )
}
