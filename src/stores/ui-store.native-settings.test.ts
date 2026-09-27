// ============================================================
// Settings under the native build: the shell's screen, never a tab
// ============================================================
//
// The native app draws Settings as a pushed screen (apps/mercurypitch,
// S6). Its Settings TAB renders nothing there, so every in-app jump to a
// section ("Sign in" in Karaoke, a What's New link, the mic advisor) has to
// reach the shell instead of switching to an empty tab.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { TAB_PROGRESS, TAB_SETTINGS } from '@/features/tabs/constants'
import type * as NativeBuild from '@/lib/native-build'
import { registerShellApi } from './native-shell-store'
import { activeTab, authModalMode, closeAuthModal, openAuthModal, openSettingsSection, setActiveTab, } from './ui-store'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

afterEach(() => {
  build.native = false
  setActiveTab(TAB_PROGRESS)
  closeAuthModal()
})

describe('opening a Settings section', () => {
  it('switches to the Settings tab on the web', () => {
    setActiveTab(TAB_PROGRESS)

    openSettingsSection('account')

    expect(activeTab()).toBe(TAB_SETTINGS)
  })

  it('asks the native shell to push Settings, and stays on the tab it was asked from', () => {
    build.native = true
    const pushSettings = vi.fn()
    const unregister = registerShellApi({ pushSettings })
    setActiveTab(TAB_PROGRESS)

    openSettingsSection('account')
    unregister()

    expect(pushSettings).toHaveBeenCalledWith('account')
    expect(activeTab()).toBe(TAB_PROGRESS)
  })
})

describe('asking the singer to sign in', () => {
  it('opens the web sign-in dialog on the web', () => {
    openAuthModal('login')

    expect(authModalMode()).toBe('login')
  })

  it('asks the native shell for its sheet, and never opens the web dialog (D2)', () => {
    build.native = true
    const openSignIn = vi.fn()
    const unregister = registerShellApi({ pushSettings: vi.fn(), openSignIn })

    openAuthModal('register')
    unregister()

    expect(openSignIn).toHaveBeenCalledTimes(1)
    expect(authModalMode()).toBeNull()
  })
})
