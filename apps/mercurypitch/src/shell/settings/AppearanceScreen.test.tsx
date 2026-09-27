// ============================================================
// Appearance: follow the phone, or pick dark or light by hand
// ============================================================

import { afterEach, describe, expect, it } from 'vitest'
import { setTheme, setThemeSource, stopThemeAutoWatch, theme, themeSource, } from '@/stores/theme-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { AppearanceScreen } from './AppearanceScreen'

let view: RenderedShell | null = null

function choice(label: string): HTMLElement | undefined {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>('[role="radio"]') ?? []),
  ].find((node) => node.textContent?.includes(label))
}

function checked(): string[] {
  return [
    ...(view?.container.querySelectorAll<HTMLElement>(
      '[role="radio"][aria-checked="true"]',
    ) ?? []),
  ].map((node) => node.dataset.choice ?? '')
}

afterEach(() => {
  view?.unmount()
  view = null
  stopThemeAutoWatch()
  setTheme('dark')
})

describe('Appearance', () => {
  it('hands the choice to the phone on "Match the phone"', () => {
    setTheme('dark')
    view = renderShell(() => <AppearanceScreen />)

    choice('Match the phone')?.click()

    expect(themeSource()).toBe('system')
    expect(checked()).toEqual(['system'])
  })

  it('takes it back from the phone on Light, and marks Light alone', () => {
    setThemeSource('system')
    view = renderShell(() => <AppearanceScreen />)

    choice('Light')?.click()

    expect(themeSource()).toBe('manual')
    expect(theme()).toBe('light')
    expect(checked()).toEqual(['light'])
  })

  it('keeps a preset chosen on the web as the one marked choice', () => {
    // Settings sync carries the web's presets here; a screen with nothing
    // marked would read as if the app had no appearance at all.
    setTheme('midnight')

    view = renderShell(() => <AppearanceScreen />)

    expect(checked()).toEqual(['midnight'])
    expect(choice('Midnight')?.textContent).toContain('Chosen on the web')
  })
})
