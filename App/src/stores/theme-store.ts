import { createSignal } from 'solid-js'
import { createPersistedSignal } from '@/lib/storage'

export type ThemeMode = 'dark' | 'light'

const THEME_KEY = 'pitchperfect_theme'

export const [theme, setThemeInternal] = createPersistedSignal<ThemeMode>(
  THEME_KEY,
  'dark',
  {
    validator: (v): v is ThemeMode => v === 'light' || v === 'dark',
  },
)

export function setTheme(mode: ThemeMode): void {
  setThemeInternal(mode)
  document.documentElement.setAttribute('data-theme', mode)
}

export function toggleTheme(): void {
  const next = theme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
}

export function initTheme(): void {
  document.documentElement.setAttribute('data-theme', theme())
}
