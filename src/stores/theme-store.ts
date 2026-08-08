// ============================================================
// Theme Store — the nine colour presets and how one gets picked
// ============================================================
//
// Adding a preset means three edits in lockstep: the `THEME_PRESETS` tuple,
// a `THEME_INFO` entry, and the matching `body[data-theme='...']` token block
// in src/styles/app.css. Miss the CSS and the theme silently renders as dark.
//
// `theme()` is always the preset currently on the DOM, whoever chose it. The
// *chooser* is `themeSource()`: 'manual' means the user picked from the grid,
// 'system' follows prefers-color-scheme, 'time' follows the local clock. Both
// auto sources map onto exactly two user-chosen presets — `autoDayTheme()` and
// `autoNightTheme()` — so all nine presets stay reachable from Auto. Picking a
// preset by hand always drops back to 'manual'; that is the override.

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

/** Where the active preset comes from. */
export const THEME_SOURCES = ['manual', 'system', 'time'] as const

export type ThemeSource = (typeof THEME_SOURCES)[number]

export interface ThemeSourceInfo {
  id: ThemeSource
  label: string
  description: string
}

export const THEME_SOURCE_INFO: Record<ThemeSource, ThemeSourceInfo> = {
  manual: {
    id: 'manual',
    label: 'Manual',
    description: 'Stay on the preset you picked',
  },
  system: {
    id: 'system',
    label: 'System',
    description: 'Follow the light or dark mode of your device',
  },
  time: {
    id: 'time',
    label: 'Time of day',
    description: 'Day preset from 07:00, night preset from 19:00',
  },
}

/** Local-clock day window: `autoDayTheme` applies from 07:00 until 19:00. */
export const DAY_START_HOUR = 7
export const NIGHT_START_HOUR = 19

/** How often 'time' mode re-checks the clock. Cheap, and survives sleep. */
const TIME_TICK_MS = 60_000

const THEME_KEY = 'pitchperfect_theme'
const THEME_SOURCE_KEY = 'pitchperfect_theme_source'
const AUTO_DAY_KEY = 'pitchperfect_theme_auto_day'
const AUTO_NIGHT_KEY = 'pitchperfect_theme_auto_night'

const isPreset = (v: unknown): v is ThemeMode =>
  THEME_PRESETS.includes(v as ThemeMode)

export const [theme, setThemeInternal] = createPersistedSignal<ThemeMode>(
  THEME_KEY,
  'dark',
  { validator: isPreset },
)

export const [themeSource, setThemeSourceInternal] =
  createPersistedSignal<ThemeSource>(THEME_SOURCE_KEY, 'manual', {
    validator: (v): v is ThemeSource =>
      THEME_SOURCES.includes(v as ThemeSource),
  })

export const [autoDayTheme, setAutoDayThemeInternal] =
  createPersistedSignal<ThemeMode>(AUTO_DAY_KEY, 'light', {
    validator: isPreset,
  })

export const [autoNightTheme, setAutoNightThemeInternal] =
  createPersistedSignal<ThemeMode>(AUTO_NIGHT_KEY, 'dark', {
    validator: isPreset,
  })

/** The dark-mode media query, or null on a host without matchMedia. */
function darkMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return null
  return window.matchMedia('(prefers-color-scheme: dark)')
}

/** True when the device asks for dark. A host that cannot answer counts as light. */
function prefersDark(): boolean {
  return darkMediaQuery()?.matches ?? false
}

/** True inside the local day window. Exported for tests, which cannot move the clock. */
export function isDaytime(hour: number = new Date().getHours()): boolean {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR
}

/**
 * The preset an auto source wants right now. 'manual' resolves to the
 * current preset so callers never have to special-case it.
 */
export function resolveThemeForSource(source: ThemeSource): ThemeMode {
  if (source === 'system')
    return prefersDark() ? autoNightTheme() : autoDayTheme()
  if (source === 'time') return isDaytime() ? autoDayTheme() : autoNightTheme()
  return theme()
}

function applyTheme(mode: ThemeMode): void {
  setThemeInternal(mode)
  document.documentElement.setAttribute('data-theme', mode)
}

/** Re-resolve the auto source and apply it only when the preset actually changes. */
function syncAutoTheme(): void {
  const source = themeSource()
  if (source === 'manual') return
  const next = resolveThemeForSource(source)
  if (next !== theme()) applyTheme(next)
}

let mediaQuery: MediaQueryList | null = null
let timeTimer: ReturnType<typeof setInterval> | null = null

function stopAutoWatch(): void {
  mediaQuery?.removeEventListener('change', syncAutoTheme)
  mediaQuery = null
  if (timeTimer !== null) clearInterval(timeTimer)
  timeTimer = null
}

/** Watch whatever the active source depends on, then apply it once. */
function startAutoWatch(): void {
  stopAutoWatch()
  const source = themeSource()
  if (source === 'system') {
    mediaQuery = darkMediaQuery()
    mediaQuery?.addEventListener('change', syncAutoTheme)
  } else if (source === 'time') {
    timeTimer = setInterval(syncAutoTheme, TIME_TICK_MS)
  }
  syncAutoTheme()
}

/** Pick a preset by hand. Always an override — it drops the source to 'manual'. */
export function setTheme(mode: ThemeMode): void {
  stopAutoWatch()
  setThemeSourceInternal('manual')
  applyTheme(mode)
}

/** Switch chooser. Auto sources take effect immediately. */
export function setThemeSource(source: ThemeSource): void {
  setThemeSourceInternal(source)
  if (source === 'manual') {
    stopAutoWatch()
    return
  }
  startAutoWatch()
}

/** Change which preset an auto source uses for day or night, and re-apply. */
export function setAutoTheme(slot: 'day' | 'night', mode: ThemeMode): void {
  if (slot === 'day') setAutoDayThemeInternal(mode)
  else setAutoNightThemeInternal(mode)
  syncAutoTheme()
}

export function toggleTheme(): void {
  const current = theme()
  const idx = THEME_PRESETS.indexOf(current)
  const next = THEME_PRESETS[(idx + 1) % THEME_PRESETS.length]
  setTheme(next)
}

export function initTheme(): void {
  const source = themeSource()
  if (source === 'manual') {
    document.documentElement.setAttribute('data-theme', theme())
    return
  }
  startAutoWatch()
}

/** Test-only teardown: drops the media-query listener and the clock timer. */
export function stopThemeAutoWatch(): void {
  stopAutoWatch()
}
