// ============================================================
// A full-bleed premium room keeps the rail away for the whole room
// ============================================================
//
// Decision D1 (13 Oct 2026): a premium room drawn full-bleed shows no tab
// rail at all, not just while a note is held, and the rail comes back with
// the screen under it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { fullBleedOnTop, popScreen, pushScreen, railVisible, resetRunShell, } from './run-shell-store'

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  setExerciseFocus(false)
})

afterEach(() => {
  setExerciseFocus(false)
  resetRunShell()
})

describe('a full-bleed room', () => {
  it('hides the rail from the moment it opens until it closes', () => {
    expect(railVisible()).toBe(true)

    pushScreen('long-note')
    expect(fullBleedOnTop()).toBe(true)
    expect(railVisible()).toBe(false)

    popScreen()
    expect(fullBleedOnTop()).toBe(false)
    expect(railVisible()).toBe(true)
  })

  it('keeps the rail away after a held note ends', () => {
    pushScreen('long-note')
    setExerciseFocus(true)
    setExerciseFocus(false)

    expect(railVisible()).toBe(false)
  })

  it('leaves the rail with a screen that is not a room', () => {
    pushScreen('settings')

    expect(fullBleedOnTop()).toBe(false)
    expect(railVisible()).toBe(true)
  })
})
