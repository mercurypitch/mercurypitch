// ============================================================
// Back with the sign-in sheet up
// ============================================================
//
// The sheet opens over whatever asked for it, usually the Account screen.
// Back is for the sheet first: one pane back while it has one to go back to,
// then closed, and only then the screen underneath.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import { pushed, pushSettingsScreen, resetRunShell } from './run-shell-store'
import { openSignIn, registerSignInPaneBack, resetSignIn, signInOpen, } from './settings/sign-in-state'
import { performBack } from './shell-navigation'

const host = () => ({ canGoBack: true, back: vi.fn(), minimize: vi.fn() })

let unregister: (() => void) | null = null

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  resetSignIn()
})

afterEach(() => {
  unregister?.()
  unregister = null
  resetSignIn()
  resetRunShell()
})

describe('Back with the sign-in sheet up', () => {
  it('steps the sheet back a pane before it closes it', () => {
    let panesBehind = 1
    unregister = registerSignInPaneBack(() => {
      if (panesBehind === 0) return false
      panesBehind -= 1
      return true
    })
    pushSettingsScreen('account')
    openSignIn()

    const first = performBack(host())
    const openAfterFirst = signInOpen()
    const second = performBack(host())

    expect([first, second]).toEqual(['sheet', 'sheet'])
    expect(openAfterFirst).toBe(true)
    expect(signInOpen()).toBe(false)
    expect(pushed()).toBe('account')
  })

  it('closes the sheet before it pops the screen underneath', () => {
    pushSettingsScreen('account')
    openSignIn()
    const back = host()

    performBack(back)
    const screenAfterFirst = pushed()
    performBack(back)

    expect(screenAfterFirst).toBe('account')
    expect(pushed()).toBe('settings')
    expect(back.back).not.toHaveBeenCalled()
  })
})
