import { createPersistedSignal } from '@/lib/storage'

export const THEME_PRESETS = [
  'dark',
  'light',
  'midnight',
  'forest',
  'ocean',
  'cyberpunk',
  'rose',
  'amber',
  'slate',
] as const

export type ThemeMode = (typeof THEME_PRESETS)[number]

export interface ThemeInfo {
  id: ThemeMode
  label: string
  description: string
  preview: string
}

export const THEME_INFO: Record<ThemeMode, ThemeInfo> = {
  dark: {
    id: 'dark',
    label: 'Dark',
    description: 'Default dark theme with blue accents',
    preview: 'linear-gradient(135deg, #0d1117 40%, #21262d 60%, #58a6ff 100%)',
  },
  light: {
    id: 'light',
    label: 'Light',
    description: 'Soft off-white, easy on the eyes',
    preview: 'linear-gradient(135deg, #f3f4f6 40%, #dde1e6 60%, #0969da 100%)',
  },
  midnight: {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep dark with warm red glow',
    preview: 'linear-gradient(135deg, #0d1117 40%, #161b22 60%, #f85149 100%)',
  },
  forest: {
    id: 'forest',
    label: 'Forest',
    description: 'Calming green sanctuary',
    preview: 'linear-gradient(135deg, #1b2a1b 40%, #142414 60%, #7cb871 100%)',
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    description: 'Deep blue depths, crisp and focused',
    preview: 'linear-gradient(135deg, #0b1a2c 40%, #091422 60%, #4facfe 100%)',
  },
  cyberpunk: {
    id: 'cyberpunk',
    label: 'Cyberpunk',
    description: 'Neon-drenched, high-energy',
    preview: 'linear-gradient(135deg, #0a0a0f 40%, #12101a 60%, #e040fb 100%)',
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    description: 'Warm pink with rosy glow',
    preview: 'linear-gradient(135deg, #1a1418 40%, #1f181e 60%, #d07888 100%)',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    description: 'Golden sunset, warm and energizing',
    preview: 'linear-gradient(135deg, #1a1510 40%, #1e1810 60%, #e8a030 100%)',
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    description: 'Cool blue-gray, calm and focused',
    preview: 'linear-gradient(135deg, #141a22 40%, #181e26 60%, #60a0f0 100%)',
  },
}

const THEME_KEY = 'pitchperfect_theme'

export const [theme, setThemeInternal] = createPersistedSignal<ThemeMode>(
  THEME_KEY,
  'dark',
  {
    validator: (v): v is ThemeMode => THEME_PRESETS.includes(v as ThemeMode),
  },
)

export function setTheme(mode: ThemeMode): void {
  setThemeInternal(mode)
  document.documentElement.setAttribute('data-theme', mode)
}

export function toggleTheme(): void {
  const current = theme()
  const idx = THEME_PRESETS.indexOf(current)
  const next = THEME_PRESETS[(idx + 1) % THEME_PRESETS.length]
  setTheme(next)
}

export function initTheme(): void {
  document.documentElement.setAttribute('data-theme', theme())
}
