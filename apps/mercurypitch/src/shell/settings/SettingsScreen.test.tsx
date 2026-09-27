// ============================================================
// Settings, the root of the stack: grouped rows that push their own screens
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { setTheme, setThemeSource, stopThemeAutoWatch, } from '@/stores/theme-store'
import type { RenderedShell } from '../render-for-test'
import { renderShell } from '../render-for-test'
import { SettingsScreen } from './SettingsScreen'

let view: RenderedShell | null = null

function row(id: string): HTMLElement | null {
  return (
    view?.container.querySelector<HTMLElement>(`[data-settings-row="${id}"]`) ??
    null
  )
}

afterEach(() => {
  view?.unmount()
  view = null
  stopThemeAutoWatch()
  setTheme('dark')
})

describe('Settings', () => {
  it('says the app follows the phone on the Appearance row, and pushes Appearance from it', () => {
    setThemeSource('system')
    const onPush = vi.fn()
    view = renderShell(() => <SettingsScreen onPush={onPush} />)

    const value = row('appearance')?.textContent ?? ''
    row('appearance')?.click()

    expect(value).toContain('Match the phone')
    expect(onPush).toHaveBeenCalledWith('appearance')
  })

  it('names a preset picked by hand on the Appearance row', () => {
    setTheme('light')

    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    expect(row('appearance')?.textContent).toContain('Light')
  })

  it('ends on the privacy line', () => {
    view = renderShell(() => <SettingsScreen onPush={vi.fn()} />)

    const screen = view.container.querySelector(
      '[data-testid="settings-screen"]',
    )

    expect(screen?.lastElementChild?.textContent?.trim()).toBe(
      'Only you can hear you.',
    )
  })
})
