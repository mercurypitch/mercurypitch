// ============================================================
// Back and the Settings questions
// ============================================================
//
// A question Settings asks (Sign out?, and the deletion and storage ones
// that follow) sits over the pushed screen that asked it. Back answers it
// with Cancel, exactly as the alert's own Cancel does, and only the next
// press pops the screen.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { askSettings, resetSettingsAlert, settingsAlert, } from './settings/settings-alert'
import type { BackHost } from './shell-navigation'
import { performBack } from './shell-navigation'

const host: BackHost = { canGoBack: false, back: vi.fn(), minimize: vi.fn() }

beforeEach(() => {
  resetRunShell()
  resetSettingsAlert()
})

afterEach(() => {
  resetRunShell()
  resetSettingsAlert()
})

describe('Back with a Settings question up', () => {
  it('cancels the question before it pops the screen that asked', () => {
    const confirm = vi.fn()
    pushSettingsScreen('account')
    askSettings({
      title: 'Sign out?',
      text: 'A question.',
      confirmLabel: 'Sign out',
      onConfirm: confirm,
    })

    const first = performBack(host)
    const afterFirst = pushed()
    const second = performBack(host)

    expect([first, second]).toEqual(['alert', 'pushed'])
    expect(afterFirst).toBe('account')
    expect(settingsAlert()).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })
})
