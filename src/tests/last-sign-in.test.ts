// ── The note this device leaves itself ───────────────────────────────
//
// The whole affordance rests on this file, so the properties that make it safe
// are the ones worth pinning: it holds a METHOD and nothing else, it survives
// signing out on purpose, and a corrupted value degrades to "never signed in"
// rather than to something the UI will try to render.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetSignInMethod, lastSignInMethod, rememberSignInMethod, signInMethodLabel, } from '@/lib/last-sign-in'

const KEY = 'pitchperfect_last_sign_in'

beforeEach(() => {
  localStorage.clear()
  forgetSignInMethod()
})

describe('lastSignInMethod', () => {
  it('starts empty, so a new device offers nothing', () => {
    expect(lastSignInMethod()).toBe('')
  })

  it('remembers the method across a reload', () => {
    rememberSignInMethod('passkey')
    expect(lastSignInMethod()).toBe('passkey')
    expect(localStorage.getItem(KEY)).toBe('passkey')
  })

  it('stores the method and NOTHING else', () => {
    // The privacy property: a rehearsal-room laptop must not tell the next
    // person who practises on it. No name, no address, no user id — the whole
    // stored value is one of four words.
    rememberSignInMethod('google')
    const raw = localStorage.getItem(KEY) ?? ''
    expect(raw).toBe('google')
    expect(raw).not.toMatch(/@/)
    expect(raw.length).toBeLessThan(12)
  })

  it('is forgotten only when asked', () => {
    // Signing out keeps it: signing out and coming back is exactly the case
    // the hint exists for. Account deletion is what calls this.
    rememberSignInMethod('emailcode')
    forgetSignInMethod()
    expect(lastSignInMethod()).toBe('')
    expect(localStorage.getItem(KEY) ?? '').toBe('')
  })

  it('reads a junk value as "never signed in"', async () => {
    // Anything can write to localStorage. A value the UI would try to render a
    // label for must not survive the validator — and the validator only runs
    // at module load, so the module has to be loaded again to exercise it.
    localStorage.setItem(KEY, 'not-a-method')
    vi.resetModules()
    const fresh = await import('@/lib/last-sign-in')
    expect(fresh.lastSignInMethod()).toBe('')
  })

  it('survives a reload that finds a good value', async () => {
    // The other half of the same mechanism: a real value must come BACK, or
    // the hint would never outlive the tab that wrote it.
    localStorage.setItem(KEY, 'passkey')
    vi.resetModules()
    const fresh = await import('@/lib/last-sign-in')
    expect(fresh.lastSignInMethod()).toBe('passkey')
  })
})

describe('signInMethodLabel', () => {
  it('offers, rather than demands', () => {
    // Copy review, pinned: this line appears unprompted to somebody who did
    // not ask to sign in, so it must read as an offer.
    for (const method of [
      'passkey',
      'google',
      'emailcode',
      'password',
    ] as const) {
      const label = signInMethodLabel(method)
      expect(label.length).toBeGreaterThan(0)
      expect(label).not.toMatch(/must|required|need to/i)
    }
  })

  it('names the passkey, because that is the one worth naming', () => {
    expect(signInMethodLabel('passkey')).toBe('Sign in with your passkey')
    expect(signInMethodLabel('google')).toBe('Continue with Google')
  })
})
