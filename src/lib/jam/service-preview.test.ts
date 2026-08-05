// ============================================================
// Jam service preview mode — network isolation regression tests
// ============================================================
//
// Mock signaling invents peers for screenshots. Those peers must stay UI
// fixtures: passing them through the normal service used to fetch TURN
// credentials and start ICE even though no remote peer existed.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamCallbacks, JamPeer } from './types'

const mocks = vi.hoisted(() => ({
  getIceServers: vi.fn(),
  resetIceServers: vi.fn(),
  signalingCallbacks: null as JamCallbacks | null,
}))

vi.mock('./ice-servers', () => ({
  FALLBACK_ICE_SERVERS: [],
  getIceServers: mocks.getIceServers,
  resetIceServers: mocks.resetIceServers,
}))

vi.mock('./signaling', () => ({
  jamSignalingIsMocked: () => true,
  createSignalingClient: (callbacks: JamCallbacks) => {
    mocks.signalingCallbacks = callbacks
    return {
      createRoom: vi.fn(),
      connect: vi.fn(),
      leaveRoom: vi.fn(),
      disconnect: vi.fn(),
      sendOffer: vi.fn(),
      sendAnswer: vi.fn(),
      sendIceCandidate: vi.fn(),
      getRoomId: () => 'PREVIEW1',
      getPeerId: () => 'preview-self',
      connecting: false,
    }
  },
}))

import { createJamService } from './service'

class PreviewMediaStream {
  getTracks(): MediaStreamTrack[] {
    return []
  }

  getAudioTracks(): MediaStreamTrack[] {
    return []
  }

  getVideoTracks(): MediaStreamTrack[] {
    return []
  }
}

function callbacks(): JamCallbacks {
  return {
    onPeerJoined: vi.fn(),
    onPeerLeft: vi.fn(),
    onPeerStream: vi.fn(),
    onConnectionStateChange: vi.fn(),
    onLatencyUpdate: vi.fn(),
    onChatMessage: vi.fn(),
    onRoomClosed: vi.fn(),
    onError: vi.fn(),
  }
}

const previewPeer: JamPeer = {
  id: 'preview-peer-1',
  displayName: 'Ada',
  connectionState: 'connecting',
  latency: 0,
  hasVideo: false,
  hasAudio: true,
}

describe('Jam service preview mode', () => {
  beforeEach(() => {
    mocks.getIceServers.mockReset()
    mocks.signalingCallbacks = null
    vi.stubGlobal('MediaStream', PreviewMediaStream)
  })

  it('creates and joins rooms without fetching ICE credentials', async () => {
    const service = createJamService(callbacks())

    await service.createRoom('Merc')
    await service.joinRoom('PREVIEW1', 'Merc')

    expect(mocks.getIceServers).not.toHaveBeenCalled()
    service.dispose()
  })

  it('renders invented peers without constructing RTCPeerConnection', () => {
    const peerConnection = vi.fn()
    vi.stubGlobal('RTCPeerConnection', peerConnection)
    const cb = callbacks()
    const service = createJamService(cb)

    mocks.signalingCallbacks?.onPeerJoined(previewPeer)

    expect(cb.onPeerJoined).toHaveBeenCalledWith(previewPeer)
    expect(peerConnection).not.toHaveBeenCalled()
    service.dispose()
  })
})
