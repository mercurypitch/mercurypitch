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
function fakeAudioTrack() {
  const track = {
    kind: 'audio' as const,
    id: 'fake-audio',
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

function installFakeMediaDevices(track: ReturnType<typeof fakeAudioTrack>) {
  const stream = {
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
    getTracks: () => [track],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
  }
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  })
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
  return stream
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
