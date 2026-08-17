// ============================================================
// Google sign-in mid-onboarding comes back to the map
// ============================================================
//
// Repro: on the keep beat the visitor taps "Continue with Google". That is
// a full-page redirect (COOP severs the GIS popup), and every onboarding
// signal is memory-only — so the app rebooted into a flow that "restarts
// at the beginning", with the freshly measured voiceprint nowhere in
// sight. On Android it is worse: the redirect can land in the installed
// PWA, a different browsing context, so even sessionStorage stashes are
// blank there. The resume marker therefore lives in localStorage, the one
// store both contexts share, and the boot path consumes it one-shot.
//
// Only the map beat is resumable: it is the one beat that rebuilds itself
// entirely from persisted data (saved voiceprints), which is also exactly
// where a sign-in can leave from.

import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RESUME_KEY = 'pitchperfect_onboarding_resume'

async function freshStore() {
  vi.resetModules()
  return await import('@/stores/onboarding-store')
}

beforeEach(() => {
  localStorage.clear()
})

describe('onboarding resume across a sign-in redirect', () => {
  it('reboots into the map after arming on the map beat', async () => {
    // Boot 1: the visitor stands on the map and leaves for Google.
    const before = await freshStore()
    before.openBeat('map')
    before.armOnboardingResume()

    // Boot 2: the redirect landed, all in-memory flow state is gone.
    const after = await freshStore()
    after.startOrResumeOnboarding()
    expect(after.currentBeat()).toBe('map')
    expect(after.flowOpen()).toBe(true)
  })

  it('consumes the marker one-shot', async () => {
    const before = await freshStore()
    before.openBeat('map')
    before.armOnboardingResume()

    const second = await freshStore()
    second.startOrResumeOnboarding()
    const third = await freshStore()
    third.startOrResumeOnboarding()
    expect(third.currentBeat()).toBe('sky')
  })

  it('does not arm while the flow is closed', async () => {
    const before = await freshStore()
    expect(before.flowOpen()).toBe(false)
    before.armOnboardingResume()

    const after = await freshStore()
    after.startOrResumeOnboarding()
    expect(after.currentBeat()).toBe('sky')
  })

  it('resumes only into the map — earlier beats restart honestly', async () => {
    // A beat that needs a live microphone take cannot be re-entered cold;
    // pretending otherwise would strand the visitor mid-capture.
    const before = await freshStore()
    before.openBeat('fork')
    before.armOnboardingResume()

    const after = await freshStore()
    after.startOrResumeOnboarding()
    expect(after.currentBeat()).toBe('sky')
  })

  it('finishing the flow spends any pending marker', async () => {
    const store = await freshStore()
    store.openBeat('map')
    store.armOnboardingResume()
    store.finishOnboarding()

    const after = await freshStore()
    after.startOrResumeOnboarding()
    expect(after.currentBeat()).toBe('sky')
    expect(localStorage.getItem(RESUME_KEY)).not.toContain('map')
  })
})

describe('the boot path and the sign-in button are wired to it', () => {
  it('App boots the flow through startOrResumeOnboarding', () => {
    const source = readFileSync('src/App.tsx', 'utf8')
    expect(source).toContain('startOrResumeOnboarding()')
  })

  it('AuthModal arms the marker before leaving for Google', () => {
    const source = readFileSync('src/components/account/AuthModal.tsx', 'utf8')
    const arm = source.indexOf('armOnboardingResume()')
    const go = source.indexOf('startGoogleSignIn()')
    expect(arm).toBeGreaterThan(-1)
    expect(go).toBeGreaterThan(arm)
  })
})

describe('the installed app opens where the tab was', () => {
  it('the manifest asks Android to navigate an existing instance', () => {
    const manifest = JSON.parse(
      readFileSync('public/site.webmanifest', 'utf8'),
    ) as Record<string, unknown>
    expect(manifest['launch_handler']).toEqual({
      client_mode: 'navigate-existing',
    })
    // The fields the PWA identity hangs on stay put.
    expect(manifest['scope']).toBe('/')
    expect(manifest['start_url']).toBe('/')
  })
})
