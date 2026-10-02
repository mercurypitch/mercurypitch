// ============================================================
// AppearanceScreen — follow the phone, or dark or light by hand
// ============================================================
//
// The web's theme picker offers nine presets and three ways of choosing
// between them. On a phone the question is smaller: does the app follow the
// phone's own setting, or is it always dark or always light. The presets
// stay the web's; one chosen there (Settings sync brings it along) shows
// here as the choice in force, so the screen never reads as if nothing were
// chosen.

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { theDevice } from '@/lib/device-noun'
import type { ThemeMode, ThemeSource } from '@/stores/theme-store'
import { setTheme, setThemeSource, theme, THEME_INFO, THEME_SOURCE_INFO, themeSource, } from '@/stores/theme-store'
import { SettingsChoice } from './SettingsList'

/** What the Appearance row in Settings says. */
export function appearanceLabel(source: ThemeSource, mode: ThemeMode): string {
  if (source === 'system') return `Match ${theDevice()}`
  if (source === 'time') return THEME_SOURCE_INFO.time.label
  return THEME_INFO[mode].label
}

interface Choice {
  id: string
  label: string
  sub?: string
  checked: () => boolean
  choose: () => void
}

const OFFERED: readonly Choice[] = [
  {
    id: 'system',
    get label(): string {
      return `Match ${theDevice()}`
    },
    get sub(): string {
      return `Dark or light, as ${theDevice()} is set`
    },
    checked: () => themeSource() === 'system',
    choose: () => {
      setThemeSource('system')
    },
  },
  {
    id: 'dark',
    label: THEME_INFO.dark.label,
    checked: () => themeSource() === 'manual' && theme() === 'dark',
    choose: () => {
      setTheme('dark')
    },
  },
  {
    id: 'light',
    label: THEME_INFO.light.label,
    checked: () => themeSource() === 'manual' && theme() === 'light',
    choose: () => {
      setTheme('light')
    },
  },
]

/**
 * The choice in force when it is none of the three offered: a preset or the
 * time-of-day source, set on the web. Null when one of the three is it.
 */
function chosenElsewhere(): Choice | null {
  if (OFFERED.some((choice) => choice.checked())) return null
  const source = themeSource()
  const id = source === 'time' ? 'time' : theme()
  return {
    id,
    label: appearanceLabel(source, theme()),
    sub: 'Chosen on the web',
    checked: () => true,
    choose: () => undefined,
  }
}

export function AppearanceScreen(): JSX.Element {
  const choices = (): Choice[] => {
    const elsewhere = chosenElsewhere()
    return elsewhere === null ? [...OFFERED] : [...OFFERED, elsewhere]
  }

  return (
    <div class="mp-set" data-testid="appearance-screen">
      <div class="mp-set-list" role="radiogroup" aria-label="Appearance">
        <For each={choices()}>
          {(choice) => (
            <SettingsChoice
              id={choice.id}
              label={choice.label}
              sub={choice.sub}
              checked={choice.checked()}
              onChoose={choice.choose}
            />
          )}
        </For>
      </div>
    </div>
  )
}
