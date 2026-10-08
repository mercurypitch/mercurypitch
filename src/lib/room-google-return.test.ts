// ============================================================
// A Google sign-in coming back to a standalone room
// ============================================================
//
// Guitar Night and Drum Night are pages of their own, so a Google sign-in
// started from their dialog returns to them, never to the main app's page,
// whose auth effect is what adopts a new account's takes there. These pin
// the room's own step: a return that created the account adopts this
// device's takes, a returning sign-in leaves them alone, and an ordinary
// visit loads neither the auth layer nor the voiceprint one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loads = { auth: 0, voiceprints: 0 }
const adoptDeviceVoiceprints = vi.fn(async () => 2)

/**
 * Counting factories, registered afresh for every test: each runs when its
 * module is first imported, so a count of zero means the layer never loaded.
 * A hoisted vi.mock would not do: its factory's result outlives
 * vi.resetModules, so it counts the first test's load and nothing after.
 */
function countLoads(options: { authFails?: boolean } = {}): void {
  vi.doMock('@/db/services/auth-service', async (importOriginal) => {
    loads.auth += 1
    if (options.authFails === true) throw new Error('stale chunk')
    return await importOriginal()
  })
  vi.doMock('@/db/services/voiceprint-service', () => {
    loads.voiceprints += 1
    return { adoptDeviceVoiceprints: () => adoptDeviceVoiceprints() }
  })
}

/** A worker-shaped session token, good for an hour. */
function sessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

/** Land on `path` the way the worker sends a Google sign-in back. */
function returnFromGoogle(path: string, created: boolean): void {
  const fragment = `#gauth=${encodeURIComponent(sessionToken())}`
  window.history.replaceState(
    null,
    '',
    `${path}${fragment}${created ? '&gauth_new=1' : ''}`,
  )
}

beforeEach(() => {
  vi.resetModules()
  loads.auth = 0
  loads.voiceprints = 0
  countLoads()
  adoptDeviceVoiceprints.mockReset().mockResolvedValue(2)
  localStorage.clear()
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('after a room has taken a Google return', () => {
  async function takeReturn(created: boolean) {
    returnFromGoogle('/guitar-night', created)
    const auth = await import('@/db/services/auth-service')
    auth.consumeGoogleRedirect()
    return await import('./room-google-return')
  }

  it("adopts this device's takes when the return created the account", async () => {
    const room = await takeReturn(true)

    await expect(room.adoptAfterRoomGoogleSignup()).resolves.toBe(2)
    expect(adoptDeviceVoiceprints).toHaveBeenCalledTimes(1)
  })

  it('adopts nothing after a returning sign-in, and never loads the voiceprint layer', async () => {
    const room = await takeReturn(false)

    await expect(room.adoptAfterRoomGoogleSignup()).resolves.toBe(0)
    expect(adoptDeviceVoiceprints).not.toHaveBeenCalled()
    expect(loads.voiceprints).toBe(0)
  })

  it('resolves to nothing adopted when the adoption fails', async () => {
    adoptDeviceVoiceprints.mockRejectedValue(new Error('offline'))
    const room = await takeReturn(true)

    await expect(room.adoptAfterRoomGoogleSignup()).resolves.toBe(0)
  })
})

describe('a room that keeps the auth layer out of its first paint', () => {
  it('stores the session a Google return carried and clears the fragment', async () => {
    returnFromGoogle('/drum-night?view=seat', false)
    const room = await import('./room-google-return')

    await room.landRoomGoogleReturn()

    const auth = await import('@/db/services/auth-service')
    expect(auth.hasValidToken()).toBe(true)
    expect(window.location.hash).toBe('')
    expect(window.location.search).toBe('?view=seat')
  })

  it("adopts this device's takes when that return created the account", async () => {
    returnFromGoogle('/drum-night', true)
    const room = await import('./room-google-return')

    await room.landRoomGoogleReturn()

    await vi.waitFor(() =>
      expect(adoptDeviceVoiceprints).toHaveBeenCalledTimes(1),
    )
  })

  it('loads no auth on an ordinary visit', async () => {
    window.history.replaceState(null, '', '/drum-night?view=seat')
    const room = await import('./room-google-return')

    await room.landRoomGoogleReturn()

    expect(loads.auth).toBe(0)
  })

  it('still resolves when the auth layer cannot load, so the room renders', async () => {
    countLoads({ authFails: true })
    returnFromGoogle('/drum-night', true)
    const room = await import('./room-google-return')

    await expect(room.landRoomGoogleReturn()).resolves.toBeUndefined()
  })
})
