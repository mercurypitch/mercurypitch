// ============================================================
// The rail steps aside while an exercise holds the singer's note
// ============================================================
//
// Long note hides the rail for the length of a hold (exerciseHoldsFocus) and
// gives it back the moment the note ends, whatever screen is pushed. Drawn
// full-bleed it has no rail at all (run-shell-store.full-bleed.test.ts), so
// the hold is shown here over a screen that keeps its rail: a room switched
// back under the opaque bar behaves the same way.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TAB_SINGING } from '@/features/tabs/constants'
import { setExerciseFocus } from '@/stores/native-shell-store'
import { setActiveTab } from '@/stores/ui-store'
import { pushScreen, railVisible, resetRunShell } from './run-shell-store'

beforeEach(() => {
  setActiveTab(TAB_SINGING)
  resetRunShell()
  setExerciseFocus(false)
})

afterEach(() => {
  setExerciseFocus(false)
  resetRunShell()
})

describe('exercise focus', () => {
  it('hides the rail during a hold and brings it back after', () => {
    pushScreen('settings')
    expect(railVisible()).toBe(true)

    setExerciseFocus(true)
    expect(railVisible()).toBe(false)

    setExerciseFocus(false)
    expect(railVisible()).toBe(true)
  })
})
