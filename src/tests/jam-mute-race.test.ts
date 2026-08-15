// ============================================================
// Jam mute — concurrency around the microphone capture
// ============================================================
//
// The first unmute is where getUserMedia actually runs, so it is the one place
// in the jam flow with a long, user-visible await: the permission prompt. The
// leading cases here are about what happens to a second action taken while
// that prompt is on screen, which is exactly when a person taps again or gives
// up and leaves.
//
// The store is imported once, statically, and reset between tests with
// disposeJam(). An earlier shape of this file re-imported jam-store per test
// (vi.resetModules() + a dynamic import inside each test body), which
// re-executed the store's whole module graph — about a second cold — inside
// the 5s test budget. Alone that passed; under a full-suite run the starved
// workers pushed the first import past the timeout, and the timed-out test's
// continuation then resumed against the shared `service` variable, answering
// the NEXT test's permission prompt with a grant it never gave. Hence the two
// rules this file now follows: nothing slow inside a test body, and every
// test drives only its own double, held in a local const.
//
// This is also the file that drives jam-store through a mocked
// @/lib/jam/service. The store's service callbacks were previously
// unreachable from any test — tests set peer state directly and bypassed the
// handlers.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { disposeJam, initJam, jamIsMuted, toggleJamMute, } from '@/stores/jam-store'

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
  // One audio track the moment capture succeeds: enough for the store's
  // startJamPitchDetection to accept the stream on the granted path.
  const localStream = {
    getAudioTracks: () => [{}],
  } as unknown as MediaStream

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
    getLocalStream: () => (localAudio ? localStream : null),
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

// The store starts pitch detection after a successful unmute. That path is
// internal to jam-store (startJamPitchDetection lives there), so the seam to
// observe is the detector class it constructs — not the audio engine behind
// it, which is not what this file is about.
const JamPitchDetectorMock = vi.hoisted(() =>
  // A regular function, not an arrow: the store constructs it with `new`,
  // and the returned object becomes the instance.
  vi.fn(function () {
    return {
      onPitch: null,
      start: () => {},
      stop: () => {},
      getInputLevel: () => 0,
    }
  }),
)
vi.mock('@/lib/jam/jam-pitch-detector', () => ({
  JamPitchDetector: JamPitchDetectorMock,
}))

describe('toggleJamMute — a second action during the permission prompt', () => {
  beforeEach(() => {
    service = createServiceDouble()
    JamPitchDetectorMock.mockClear()
    initJam()
  })

  afterEach(async () => {
    // A failed test can leave the permission prompt open and the store's
    // in-flight guard set. Answer the prompt on the ending test's own double
    // and give the store's finally a turn to clear the guard, then tear the
    // room down so the next test starts on a silent, service-less store.
    service.denyPermission()
    await new Promise((resolve) => setTimeout(resolve, 0))
    disposeJam()
  })

  it('captures the microphone once when the button is tapped twice', async () => {
    const svc = service

    // Two taps before the person answers the prompt. hasLocalAudio() is still
    // false for the second one, which is how it used to slip past the guard.
    const first = toggleJamMute()
    const second = toggleJamMute()

    svc.grantPermission()
    await Promise.all([first, second])

    // Two captures would leave one live MediaStream unreachable: a recording
    // indicator that never goes out, and a microphone Leave cannot stop.
    expect(svc.startLocalAudioCalls).toBe(1)
  })

  it('leaves the microphone muted when permission is refused', async () => {
    const svc = service

    const pending = toggleJamMute()
    svc.denyPermission()
    await pending

    // Showing an unmuted mic the person did not grant is the one lie this
    // control must not tell.
    expect(jamIsMuted()).toBe(true)
    expect(JamPitchDetectorMock).not.toHaveBeenCalled()
  })

  it('allows a later unmute after a refused one', async () => {
    const svc = service

    const refused = toggleJamMute()
    svc.denyPermission()
    await refused

    // The in-flight guard must clear on the failure path too, or one refusal
    // would disable the mic button for the rest of the session.
    const retried = toggleJamMute()
    svc.grantPermission()
    await retried

    expect(svc.startLocalAudioCalls).toBe(2)
    expect(jamIsMuted()).toBe(false)
  })
})

// The "does Leave release the microphone?" case is deliberately NOT here.
// It belongs to the service, and a store test built on the double above could
// only assert what the double was programmed to do — the exact shape this
// audit flags elsewhere as testing a copy of the system. It lives in
// src/lib/jam/service-local-media.test.ts, against the real createJamService.
