// ============================================================
// The pushed-screen stack: Settings and the screens its rows push
// ============================================================
//
// Settings is a short grouped list whose rows push screens of their own (S6,
// decision D1 A), so a pushed screen is a stack now, not one id. One Back
// order covers every level: each press pops ONE, and only a rail tap or the
// session pill clears the lot (shell-navigation.test.ts has those).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setActiveTab } from '@/stores/ui-store'
import { clearScreens, popScreen, pushed, pushedStack, pushScreen, pushSettingsScreen, resetRunShell, roomHeaderVisible, shellCovered, } from './run-shell-store'

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
})

afterEach(() => {
  resetRunShell()
})

describe('the pushed-screen stack', () => {
  it('puts a sub-screen over Settings and answers the top one', () => {
    pushScreen('settings')

    pushScreen('appearance')

    expect(pushedStack()).toEqual(['settings', 'appearance'])
    expect(pushed()).toBe('appearance')
  })

  it('pops one level per call, down to nothing pushed', () => {
    pushScreen('settings')
    pushScreen('appearance')

    popScreen()
    const afterOne = pushed()
    popScreen()

    expect(afterOne).toBe('settings')
    expect(pushed()).toBeNull()
  })

  it('goes back down to a screen already in the stack instead of stacking it twice', () => {
    // More is reachable while a sub-screen is up, and its Settings tile must
    // land on Settings, not on a second copy above the first.
    pushScreen('settings')
    pushScreen('appearance')

    pushScreen('settings')

    expect(pushedStack()).toEqual(['settings'])
  })

  it('leaves the stack alone when the top screen is pushed again', () => {
    pushScreen('settings')
    pushScreen('appearance')

    pushScreen('appearance')

    expect(pushedStack()).toEqual(['settings', 'appearance'])
  })

  it('clears every level at once', () => {
    pushScreen('settings')
    pushScreen('appearance')

    clearScreens()

    expect(pushedStack()).toEqual([])
    expect(pushed()).toBeNull()
  })

  it('pops nothing when nothing is pushed', () => {
    popScreen()

    expect(pushedStack()).toEqual([])
  })

  it('keeps the room header away and the tab covered at every depth', () => {
    pushScreen('settings')
    pushScreen('appearance')
    const deep = { header: roomHeaderVisible(), covered: shellCovered() }

    popScreen()
    const shallow = { header: roomHeaderVisible(), covered: shellCovered() }
    popScreen()

    expect(deep).toEqual({ header: false, covered: true })
    expect(shallow).toEqual({ header: false, covered: true })
    expect({ header: roomHeaderVisible(), covered: shellCovered() }).toEqual({
      header: true,
      covered: false,
    })
  })

  it('opens a screen of Settings with Settings under it', () => {
    // More's Account tile: Back from Account has to land on Settings.
    pushSettingsScreen('account')

    expect(pushedStack()).toEqual(['settings', 'account'])
  })

  it('opens Settings itself when no screen of it is named', () => {
    pushScreen('settings')
    pushScreen('appearance')

    pushSettingsScreen()

    expect(pushedStack()).toEqual(['settings'])
  })
})
