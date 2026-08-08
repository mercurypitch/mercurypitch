// ============================================================
// ThemePicker — Visual theme selection with preview swatches
// ============================================================
//
// Two controls in one surface: *who* picks the preset (manual, system, clock)
// and *which* presets are in play. In an auto source the grid still shows the
// preset currently applied, and tapping a card is the documented override —
// it drops the source back to manual.

import type { Component } from 'solid-js'
import { For, Show } from 'solid-js'
import type { ThemeMode } from '@/stores/theme-store'
import { autoDayTheme, autoNightTheme, setAutoTheme, setTheme, setThemeSource, theme, THEME_INFO, THEME_SOURCE_INFO, themeSource, } from '@/stores/theme-store'
import styles from './ThemePicker.module.css'

const THEME_LIST = Object.values(THEME_INFO)
const SOURCE_LIST = Object.values(THEME_SOURCE_INFO)

interface AutoSlotSelectProps {
  slot: 'day' | 'night'
  label: string
  value: ThemeMode
}

function AutoSlotSelect(props: AutoSlotSelectProps) {
  const id = () => `theme-auto-${props.slot}`

  return (
    <label class={styles.autoField} for={id()}>
      <span class={styles.autoLabel}>{props.label}</span>
      <select
        id={id()}
        class={styles.autoSelect}
        value={props.value}
        onChange={(e) => {
          setAutoTheme(props.slot, e.currentTarget.value as ThemeMode)
        }}
      >
        <For each={THEME_LIST}>
          {(tm) => (
            <option class={styles.autoOption} value={tm.id}>
              {tm.label}
            </option>
          )}
        </For>
      </select>
    </label>
  )
}

export const ThemePicker: Component = () => {
  const isAuto = () => themeSource() !== 'manual'

  return (
    <div class={styles.wrap} data-tour="settings.theme">
      <div class={styles.sources} role="group" aria-label="Theme source">
        <For each={SOURCE_LIST}>
          {(src) => (
            <button
              type="button"
              class={styles.sourceBtn}
              classList={{
                [styles.sourceBtnActive]: themeSource() === src.id,
              }}
              onClick={() => setThemeSource(src.id)}
              title={src.description}
              aria-pressed={themeSource() === src.id}
            >
              {src.label}
            </button>
          )}
        </For>
      </div>

      <Show when={isAuto()}>
        <div class={styles.autoRow}>
          <AutoSlotSelect slot="day" label="Day" value={autoDayTheme()} />
          <AutoSlotSelect slot="night" label="Night" value={autoNightTheme()} />
        </div>
      </Show>

      <div class={styles.grid}>
        <For each={THEME_LIST}>
          {(tm) => (
            <button
              type="button"
              class={styles.card}
              classList={{ [styles.cardActive]: theme() === tm.id }}
              onClick={() => setTheme(tm.id)}
              title={tm.description}
              aria-pressed={theme() === tm.id}
            >
              <span class={styles.swatch} style={{ background: tm.preview }} />
              <span class={styles.label}>{tm.label}</span>
              <Show when={theme() === tm.id}>
                <span class={styles.check} aria-hidden="true">
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>

      <Show when={isAuto()}>
        <small class={styles.autoHint}>
          Auto is on — the highlighted preset is the one in use right now.
          Picking any theme switches back to Manual.
        </small>
      </Show>
    </div>
  )
}
