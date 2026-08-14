// ============================================================
// Jam mute — concurrency around the microphone capture
// ============================================================
//
// The first unmute is where getUserMedia actually runs, so it is the one place
// in the jam flow with a long, user-visible await: the permission prompt. Both
// cases here are about what happens to a second action taken while that prompt
// is on screen, which is exactly when a person taps again or gives up and
// leaves.
//
// This is also the first test to drive jam-store through a mocked
// @/lib/jam/service. The store's service callbacks were previously unreachable
// from any test — tests set peer state directly and bypassed the handlers.

import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A service double whose startLocalAudio resolves only when we say so, standing
 * in for the permission prompt.
 *
 * Every pending call is tracked, not just the most recent one: if the store
 * opens two captures, both must be able to settle. A double that only
 * remembered the last one would turn the double-capture bug into a 5s timeout
 * instead of a clean assertion on the call count.
 */
function createServiceDouble() {
  let localAudio = false
  const pending: Array<(v: boolean) => void> = []

  const settle = (granted: boolean) => {
    if (granted) localAudio = true
    while (pending.length > 0) pending.shift()!(granted)
  }

  const api = {
    startLocalAudioCalls: 0,
    disposed: false,

    startLocalAudio: vi.fn(async (): Promise<boolean> => {
      api.startLocalAudioCalls += 1
      return await new Promise<boolean>((resolve) => {
        pending.push(resolve)
      })
    }),
    hasLocalAudio: () => localAudio,
    getLocalStream: () => null,
    setMuted: vi.fn(),
    setVideoEnabled: vi.fn(),
    dispose: vi.fn(() => {
      api.disposed = true
    }),
    leaveRoom: vi.fn(),
    connect: vi.fn(),
    sendPitch: vi.fn(),
    sendChat: vi.fn(),

    /** Answer every permission prompt currently open. */
    grantPermission: () => settle(true),
    denyPermission: () => settle(false),
  }
  return api
}

let service = createServiceDouble()

vi.mock('@/lib/jam/service', () => ({
  createJamService: () => service,
}))

// The store starts pitch detection after a successful unmute; that path reaches
// the audio engine, which is not what this file is about.
const startPitchDetection = vi.fn()
vi.mock('@/lib/jam/jam-pitch', () => ({
  startJamPitchDetection: startPitchDetection,
  stopJamPitchDetection: vi.fn(),
}))

describe('toggleJamMute — a second action during the permission prompt', () => {
  beforeEach(() => {
    vi.resetModules()
    service = createServiceDouble()
    startPitchDetection.mockClear()
  })

  it('captures the microphone once when the button is tapped twice', async () => {
    const store = await import('@/stores/jam-store')
    store.initJam()

    // Two taps before the person answers the prompt. hasLocalAudio() is still
    // false for the second one, which is how it used to slip past the guard.
    const first = store.toggleJamMute()
    const second = store.toggleJamMute()

    service.grantPermission()
    await Promise.all([first, second])

    // Two captures would leave one live MediaStream unreachable: a recording
    // indicator that never goes out, and a microphone Leave cannot stop.
    expect(service.startLocalAudioCalls).toBe(1)
  })

  it('leaves the microphone muted when permission is refused', async () => {
    const store = await import('@/stores/jam-store')
    store.initJam()

    const pending = store.toggleJamMute()
    service.denyPermission()
    await pending

    // Showing an unmuted mic the person did not grant is the one lie this
    // control must not tell.
    expect(store.jamIsMuted()).toBe(true)
    expect(startPitchDetection).not.toHaveBeenCalled()
  })

  it('allows a later unmute after a refused one', async () => {
    const store = await import('@/stores/jam-store')
    store.initJam()

    const refused = store.toggleJamMute()
    service.denyPermission()
    await refused

    // The in-flight guard must clear on the failure path too, or one refusal
    // would disable the mic button for the rest of the session.
    const retried = store.toggleJamMute()
    service.grantPermission()
    await retried

    expect(service.startLocalAudioCalls).toBe(2)
    expect(store.jamIsMuted()).toBe(false)
  })
})

// The "does Leave release the microphone?" case is deliberately NOT here.
// It belongs to the service, and a store test built on the double above could
// only assert what the double was programmed to do — the exact shape this
// audit flags elsewhere as testing a copy of the system. It lives in
// src/lib/jam/service-local-media.test.ts, against the real createJamService.
