// ============================================================
// Guitar Night entry: a Google sign-up adopts this device's takes
// ============================================================
//
// A Google sign-in started from this room's dialog comes back to this page,
// not to the main app's, so the main app's after-sign-up step never runs.
// The entry runs the room's own: a return that created the account adopts
// this device's takes, and a returning sign-in loads no voiceprint code.

import type * as SolidWeb from 'solid-js/web'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { beginGoogleReturn } from '@/lib/google-return-nonce'

const entry = vi.hoisted(() => ({
  voiceprintLoads: 0,
  adopt: vi.fn(async () => 1),
}))

vi.mock('solid-js/web', async (importOriginal) => ({
  ...(await importOriginal<typeof SolidWeb>()),
  render: () => () => undefined,
}))
vi.mock('./GuitarNightApp', () => ({ GuitarNightApp: () => null }))

/** A worker-shaped session token, good for an hour. */
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

/** The nonce this room kept when its dialog started the sign-in. */
function startedHere(): string {
  return `&gauth_nonce=${beginGoogleReturn()}`
}

/** Long enough for any fire-and-forget step the entry started to finish. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

beforeEach(() => {
  vi.resetModules()
  entry.voiceprintLoads = 0
  // Registered afresh per test, so the count starts from a module that has
  // not loaded: a hoisted vi.mock's result outlives vi.resetModules.
  vi.doMock('@/db/services/voiceprint-service', () => {
    entry.voiceprintLoads += 1
    return { adoptDeviceVoiceprints: () => entry.adopt() }
  })
  entry.adopt.mockClear()
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
  // restoreAuth may ask the worker about the stored token; nothing answers.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('offline')
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = ''
})

it("adopts this device's takes when a Google return created the account", async () => {
  window.history.replaceState(
    null,
    '',
    `/guitar-night#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1${startedHere()}`,
  )

  await import('./main')

  await vi.waitFor(() => expect(entry.adopt).toHaveBeenCalledTimes(1))
})

// Login CSRF: anyone can put their own session in a link to this room.
it('signs nobody in and adopts nothing from a return this room never started', async () => {
  window.history.replaceState(
    null,
    '',
    `/guitar-night#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1`,
  )

  await import('./main')
  await settle()

  const auth = await import('@/db/services/auth-service')
  expect(auth.hasValidToken()).toBe(false)
  expect(entry.adopt).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('')
})

it('adopts nothing after a returning Google sign-in', async () => {
  window.history.replaceState(
    null,
    '',
    `/guitar-night#gauth=${encodeURIComponent(sessionToken())}${startedHere()}`,
  )

  await import('./main')
  await settle()

  expect(entry.adopt).not.toHaveBeenCalled()
  expect(entry.voiceprintLoads).toBe(0)
})
