// ============================================================
// ThemePicker — Visual theme selection with preview swatches
// ============================================================

import type { Component } from 'solid-js'
import { For } from 'solid-js'
import { THEME_INFO, type ThemeMode, theme, setTheme } from '@/stores/theme-store'
import styles from './ThemePicker.module.css'

export const ThemePicker: Component = () => {
  const themes = Object.values(THEME_INFO)

  return (
    <div class={styles.grid}>
      <For each={themes}>
        {(tm) => (
          <button
            class={styles.card}
            classList={{ [styles.cardActive]: theme() === tm.id }}
            onClick={() => setTheme(tm.id as ThemeMode)}
            title={tm.description}
            aria-pressed={theme() === tm.id}
          >
            <span
              class={styles.swatch}
              style={{ background: tm.preview }}
            />
            <span class={styles.label}>{tm.label}</span>
            {theme() === tm.id && (
              <span class={styles.check} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </button>
        )}
      </For>
    </div>
  )
}
