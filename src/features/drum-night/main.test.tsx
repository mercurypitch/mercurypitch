// ============================================================
// Drum Night entry: a Google return lands before the room renders
// ============================================================
//
// A Google sign-in started from this room's dialog comes back to this page
// with the session in the fragment. The entry stores it before the room
// renders, a return that created the account adopts this device's takes, and
// an ordinary visit loads no auth at all.

import type * as SolidWeb from 'solid-js/web'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { beginGoogleReturn } from '@/lib/google-return-nonce'

const entry = vi.hoisted(() => ({
  renders: [] as { hash: string }[],
  authLoads: 0,
  adopt: vi.fn(async () => 1),
}))

vi.mock('solid-js/web', async (importOriginal) => ({
  ...(await importOriginal<typeof SolidWeb>()),
  render: () => {
    entry.renders.push({ hash: window.location.hash })
    return () => undefined
  },
}))
vi.mock('./DrumNightApp', () => ({ DrumNightApp: () => null }))

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

beforeEach(() => {
  vi.resetModules()
  entry.renders.length = 0
  entry.authLoads = 0
  // Registered afresh per test, so the count starts from a module that has
  // not loaded: a hoisted vi.mock's result outlives vi.resetModules.
  vi.doMock('@/db/services/auth-service', async (importOriginal) => {
    entry.authLoads += 1
    return await importOriginal()
  })
  vi.doMock('@/db/services/voiceprint-service', () => ({
    adoptDeviceVoiceprints: () => entry.adopt(),
  }))
  entry.adopt.mockClear()
  localStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
  document.body.innerHTML = ''
})

it("stores a Google return's session before the room renders", async () => {
  window.history.replaceState(
    null,
    '',
    `/drum-night#gauth=${encodeURIComponent(sessionToken())}${startedHere()}`,
  )

  await import('./main')

  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))
  // The fragment is already gone when the room first renders: the token was
  // stored first, and it never rides into a history entry the room writes.
  expect(entry.renders[0].hash).toBe('')
  const auth = await import('@/db/services/auth-service')
  expect(auth.hasValidToken()).toBe(true)
})

it("adopts this device's takes when that return created the account", async () => {
  window.history.replaceState(
    null,
    '',
    `/drum-night#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1${startedHere()}`,
  )

  await import('./main')

  await vi.waitFor(() => expect(entry.adopt).toHaveBeenCalledTimes(1))
})

// Login CSRF: anyone can put their own session in a link to this room.
it('signs nobody in and adopts nothing from a return this room never started', async () => {
  window.history.replaceState(
    null,
    '',
    `/drum-night#gauth=${encodeURIComponent(sessionToken())}&gauth_new=1`,
  )

  await import('./main')
  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))
  await new Promise((resolve) => setTimeout(resolve, 50))

  expect(entry.renders[0].hash).toBe('')
  const auth = await import('@/db/services/auth-service')
  expect(auth.hasValidToken()).toBe(false)
  expect(entry.adopt).not.toHaveBeenCalled()
})

it('renders an ordinary visit without loading the auth layer', async () => {
  window.history.replaceState(null, '', '/drum-night?view=seat')

  await import('./main')

  await vi.waitFor(() => expect(entry.renders).toHaveLength(1))
  expect(entry.authLoads).toBe(0)
})
