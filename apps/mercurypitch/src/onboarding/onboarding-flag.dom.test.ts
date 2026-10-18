// ============================================================
// The onboarding flag: settled once, done for good, this install's own
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { markOnboardingDone, ONBOARDING_KEY, onboardingDue, onboardingFlagBuilt, resetOnboarding, resetOnboardingFlagForTests, settleOnboarding, } from './onboarding-flag'

// Read before any test builds it: importing the module must not read storage.
const builtAtImport = onboardingFlagBuilt()

beforeEach(() => {
  localStorage.clear()
  resetOnboardingFlagForTests()
})

afterEach(() => {
  localStorage.clear()
  resetOnboardingFlagForTests()
})

describe('the onboarding flag', () => {
  it('is not built at import', () => {
    expect(builtAtImport).toBe(false)
  })

  it('settles due on a new install, and done on one that opened a door', () => {
    settleOnboarding(false)
    expect(onboardingDue()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('due')

    localStorage.clear()
    resetOnboardingFlagForTests()
    settleOnboarding(true)
    expect(onboardingDue()).toBe(false)
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
  })

  it('settles once: a later door does not undo a due onboarding', () => {
    settleOnboarding(false)
    settleOnboarding(true)
    expect(onboardingDue()).toBe(true)
  })

  it('is done for good once done, across a relaunch', () => {
    settleOnboarding(false)
    markOnboardingDone()
    markOnboardingDone()
    expect(onboardingDue()).toBe(false)
    resetOnboardingFlagForTests()
    settleOnboarding(false)
    expect(onboardingDue()).toBe(false)
  })

  it('reads the bare word a walk seeds', () => {
    localStorage.setItem(ONBOARDING_KEY, 'done')
    settleOnboarding(false)
    expect(onboardingDue()).toBe(false)
  })

  it('is due again after a replay', () => {
    settleOnboarding(true)
    resetOnboarding()
    expect(onboardingDue()).toBe(true)
  })

  it('is an mp: key, which the settings sync never pushes', () => {
    expect(ONBOARDING_KEY.startsWith('mp:')).toBe(true)
  })
})
