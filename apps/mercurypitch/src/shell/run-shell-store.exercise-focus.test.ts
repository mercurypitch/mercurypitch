// ============================================================
// The rail steps aside while an exercise holds the singer's note
// ============================================================
//
// Long note hides the rail for the length of a hold (exerciseHoldsFocus) and
// gives it back the moment the note ends, whatever screen is pushed.

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
    pushScreen('long-note')
    expect(railVisible()).toBe(true)

    setExerciseFocus(true)
    expect(railVisible()).toBe(false)

    setExerciseFocus(false)
    expect(railVisible()).toBe(true)
  })
})
