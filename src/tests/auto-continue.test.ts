// The auto-continue preference and its escalation. The rule worth pinning is
// the one about absent prefs: everyone who used the app before this setting
// existed has a stored object without the key, and reading that as "off" would
// silently opt out every existing singer.

import { beforeEach, describe, expect, it } from 'vitest'
import { AUTO_CONTINUE_SECONDS, autoContinueEnabled, DISMISSALS_BEFORE_OFFER, noteAutoContinueDismissed, resetAutoContinueDismissals, shouldOfferToDisable, } from '@/features/routines/auto-continue'
import { routinePrefs, setRoutinePrefs, } from '@/features/routines/use-daily-routine'

describe('autoContinueEnabled', () => {
  beforeEach(() => {
    resetAutoContinueDismissals()
    setRoutinePrefs({ length: 'standard', focus: 'auto', autoContinue: true })
  })

  it('is on by default', () => {
    expect(autoContinueEnabled()).toBe(true)
  })

  it('is on when the pref predates the setting', () => {
    setRoutinePrefs({ length: 'standard', focus: 'auto' })
    expect(routinePrefs().autoContinue).toBeUndefined()
    expect(autoContinueEnabled()).toBe(true)
  })

  it('is off only when explicitly turned off', () => {
    setRoutinePrefs((p) => ({ ...p, autoContinue: false }))
    expect(autoContinueEnabled()).toBe(false)
  })
})

describe('shouldOfferToDisable', () => {
  beforeEach(() => {
    resetAutoContinueDismissals()
    setRoutinePrefs({ length: 'standard', focus: 'auto', autoContinue: true })
  })

  it('stays quiet until they have cancelled enough to mean it', () => {
    expect(shouldOfferToDisable()).toBe(false)
    for (let i = 0; i < DISMISSALS_BEFORE_OFFER - 1; i++) {
      noteAutoContinueDismissed()
      expect(shouldOfferToDisable()).toBe(false)
    }
    noteAutoContinueDismissed()
    expect(shouldOfferToDisable()).toBe(true)
  })

  // Offering to turn off something already off is a dead control.
  it('never offers when the countdown is already disabled', () => {
    setRoutinePrefs((p) => ({ ...p, autoContinue: false }))
    noteAutoContinueDismissed()
    noteAutoContinueDismissed()
    noteAutoContinueDismissed()
    expect(shouldOfferToDisable()).toBe(false)
  })
})

describe('AUTO_CONTINUE_SECONDS', () => {
  // Under three seconds is not a chance to stop it; over eight is a wait.
  it('leaves room to react without becoming a delay', () => {
    expect(AUTO_CONTINUE_SECONDS).toBeGreaterThanOrEqual(3)
    expect(AUTO_CONTINUE_SECONDS).toBeLessThanOrEqual(8)
  })
})
