// ============================================================
// Jam service — local media lifecycle
// ============================================================
//
// Who stops the microphone, and when. This runs against the REAL
// createJamService rather than a double, because the defect it covers lived in
// the service's own leaveRoom: a store-level test with a service stub would
// only be asserting what the stub was told to do.
//
// Signaling is mocked into preview mode, which is the service's own switch for
// "no remote endpoint" — it skips ICE fetches and RTCPeerConnection entirely,
// so the local-media surface can be exercised without WebRTC in jsdom.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const signalingStub = {
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  sendSignal: vi.fn(),
  broadcast: vi.fn(),
}

vi.mock('./signaling', () => ({
  createSignalingClient: () => signalingStub,
  jamSignalingIsMocked: () => true,
}))

vi.mock('./ice-servers', () => ({
  FALLBACK_ICE_SERVERS: [],
  getIceServers: async () => [],
  resetIceServers: vi.fn(),
}))

/** A microphone track that records whether anything stopped it. */
function fakeAudioTrack(id = 'fake-audio') {
  const track = {
    kind: 'audio' as const,
    id,
    label: id,
    enabled: true,
    readyState: 'live' as string,
    stopped: false,
    stop: vi.fn(() => {
      track.stopped = true
      track.readyState = 'ended'
    }),
    // makeTransmitTrack clones and constrains; refusing the clone is a
    // supported outcome (the service falls back to sending the raw capture),
    // and it keeps this test about lifetime rather than about echo processing.
    clone: () => {
      throw new Error('no clone in this environment')
    },
    getSettings: () => ({}),
    applyConstraints: async () => undefined,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  return track
}

/**
 * A getUserMedia that can be reprogrammed mid-test.
 *
 * The capture path has three outcomes worth driving -- it succeeds, it
 * fails because the pinned device is gone, it fails because the person
 * said no -- and they are told apart only by the rejection's `name`. So
 * the double has to be able to reject, and to reject as a specific error.
 */
function installFakeMediaDevices(track: ReturnType<typeof fakeAudioTrack>) {
  const streamFor = (t: ReturnType<typeof fakeAudioTrack>) => ({
    getAudioTracks: () => [t],
    getVideoTracks: () => [],
    getTracks: () => [t],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
  })
  const stream = streamFor(track)
  let next: (
    c: MediaStreamConstraints,
  ) => Promise<ReturnType<typeof streamFor>> = async () => stream
  const getUserMedia = vi.fn(async (c: MediaStreamConstraints) => await next(c))
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  const control = {
    getUserMedia,
    streamFor,
    /** Swap what the next getUserMedia call does. */
    program: (fn: typeof next) => {
      next = fn
    },
  }
  // The service builds its own MediaStream to hold the capture; jsdom has no
  // constructor for one, so stand in with the same tiny surface it uses.
  const held: unknown[] = []
  vi.stubGlobal(
    'MediaStream',
    class {
      getAudioTracks() {
        return held.filter((t) => (t as { kind: string }).kind === 'audio')
      }
      getVideoTracks() {
        return held.filter((t) => (t as { kind: string }).kind === 'video')
      }
      getTracks() {
        return held
      }
      addTrack(t: unknown) {
        held.push(t)
      }
      removeTrack(t: unknown) {
        const i = held.indexOf(t)
        if (i >= 0) held.splice(i, 1)
      }
    },
  )
  return control
}

const noopCallbacks = {
  onPeerJoined: vi.fn(),
  onPeerLeft: vi.fn(),
  onRemoteStream: vi.fn(),
  onError: vi.fn(),
  onPitchMessage: vi.fn(),
  onChatMessage: vi.fn(),
  onRoomCreated: vi.fn(),
  onRoomJoined: vi.fn(),
  onStateChange: vi.fn(),
}

describe('jam service — the microphone outlives nothing', () => {
  let track: ReturnType<typeof fakeAudioTrack>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    track = fakeAudioTrack()
    installFakeMediaDevices(track)
  })

  it('stops the capture when the room is left', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    expect(await service.startLocalAudio()).toBe(true)
    expect(service.hasLocalAudio()).toBe(true)

    service.leaveRoom()

    // Closing the peer connections stops anyone hearing the capture; it does
    // not stop the capture. Leaving used to hold the microphone open for the
    // life of the tab, with the browser's recording indicator lit, because
    // only dispose() released it and nothing in the app calls dispose().
    expect(track.stop).toHaveBeenCalled()
    expect(service.hasLocalAudio()).toBe(false)
  })

  it('stops the capture when the service is disposed', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    expect(await service.startLocalAudio()).toBe(true)
    service.dispose()

    expect(track.stop).toHaveBeenCalled()
  })

  it('captures again after a leave, rather than reusing a stopped track', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    await service.startLocalAudio()
    service.leaveRoom()

    // hasLocalAudio must report false after the release, or the next room
    // would skip its capture and sit silent behind an unmuted-looking button.
    expect(service.hasLocalAudio()).toBe(false)
    expect(await service.startLocalAudio()).toBe(true)
    expect(service.hasLocalAudio()).toBe(true)
  })
})

// ── Changing input mid-room ───────────────────────────────────────────
// Picking another device or another profile used to be unreachable:
// startLocalAudio returned early while a track existed, and mute only sets
// `track.enabled`, so the capture stayed open and the "mute and unmute to
// switch" advice the UI gave did nothing at all. The only way to act on a
// choice was to leave the room.

describe('jam service — switching input', () => {
  let track: ReturnType<typeof fakeAudioTrack>
  let media: ReturnType<typeof installFakeMediaDevices>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    track = fakeAudioTrack('built-in')
    media = installFakeMediaDevices(track)
  })

  it('leaves the capture alone without replace, which is what a second unmute wants', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    await service.startLocalAudio()
    expect(await service.startLocalAudio()).toBe(true)
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
    expect(track.stop).not.toHaveBeenCalled()
  })

  it('stops the old capture and opens the chosen one with replace', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    await service.startLocalAudio()
    const scarlett = fakeAudioTrack('scarlett')
    media.program(async () => media.streamFor(scarlett))

    expect(
      await service.startLocalAudio({ deviceId: 'scarlett', replace: true }),
    ).toBe(true)
    // Both halves matter: a switch that does not release the old device
    // leaves a second recording indicator lit, and one that does not open
    // the new device is the silent room this bug produced.
    expect(track.stop).toHaveBeenCalled()
    expect(service.hasLocalAudio()).toBe(true)
    expect(media.getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('keeps the working capture when the replacement cannot be opened', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    await service.startLocalAudio()
    media.program(async () => {
      throw new DOMException('gone', 'NotFoundError')
    })

    expect(
      await service.startLocalAudio({ deviceId: 'unplugged', replace: true }),
    ).toBe(false)
    // Taking away a microphone that worked, in exchange for one that does
    // not, is worse than refusing the change.
    expect(track.stop).not.toHaveBeenCalled()
    expect(service.hasLocalAudio()).toBe(true)
  })

  it('carries mute across the switch', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    await service.startLocalAudio()
    service.setMuted(true)

    const scarlett = fakeAudioTrack('scarlett')
    media.program(async () => media.streamFor(scarlett))
    await service.startLocalAudio({ deviceId: 'scarlett', replace: true })

    // A fresh track is enabled by default, so without this a person who
    // changed their input while muted would start transmitting.
    expect(scarlett.enabled).toBe(false)
  })
})

// ── Which failures deserve a retry ───────────────────────────────────
// getCapture pins the chosen device with `exact` so a stale id fails loudly
// rather than silently handing back the laptop microphone, and retries
// without the pin when that is what failed. Retrying on ANY rejection is
// worse than not retrying: Firefox re-prompts on a dismissed request, so a
// person who declined got a second prompt immediately.

describe('jam service — the capture retry', () => {
  let track: ReturnType<typeof fakeAudioTrack>
  let media: ReturnType<typeof installFakeMediaDevices>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    track = fakeAudioTrack()
    media = installFakeMediaDevices(track)
  })

  it('drops the device pin when that device is gone', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    let calls = 0
    media.program(async (c) => {
      calls += 1
      if (calls === 1) throw new DOMException('no', 'OverconstrainedError')
      // The retry must be the unpinned one, or it would fail the same way.
      expect((c.audio as MediaTrackConstraints).deviceId).toBeUndefined()
      return media.streamFor(track)
    })

    expect(await service.startLocalAudio({ deviceId: 'stale' })).toBe(true)
    expect(calls).toBe(2)
  })

  it('does not re-prompt somebody who just said no', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    media.program(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })

    expect(await service.startLocalAudio({ deviceId: 'scarlett' })).toBe(false)
    // One prompt, one answer. The old code asked again straight away.
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('surfaces a device held by something else instead of taking the laptop mic', async () => {
    const { createJamService } = await import('./service')
    const service = createJamService(noopCallbacks as never)

    media.program(async () => {
      throw new DOMException('busy', 'NotReadableError')
    })

    expect(await service.startLocalAudio({ deviceId: 'scarlett' })).toBe(false)
    expect(media.getUserMedia).toHaveBeenCalledTimes(1)
  })
})
