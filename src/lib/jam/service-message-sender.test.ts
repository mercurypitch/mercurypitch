// ============================================================
// Jam service — who sent a room message
// ============================================================
//
// The room's song, drill and transport are the host's to set, and the store
// takes them only from the peer the room's Durable Object names as host
// (jam-room-host-messages.test.ts). That check is only as good as the sender
// it is handed. The service names the sender by the DataChannel a message
// came in on, never by anything in the message, which any peer can write.
//
// This runs the REAL createJamService, as service-local-media.test.ts does.
// Signaling is a stub that lets the test announce peers, and jsdom has no
// WebRTC, so RTCPeerConnection is a stand-in whose one channel the test can
// deliver messages on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJamService } from './service'
import type { JamCallbacks, JamPeer } from './types'

const ME = 'peer-m'

let signalingCallbacks: JamCallbacks | null = null

const signalingStub = {
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  sendSignal: vi.fn(),
  broadcast: vi.fn(),
  getPeerId: () => ME,
  // ensureIceServers keys the just-in-time ICE fetch to the live room.
  getRoomId: () => 'ABCDEFGH',
}

vi.mock('./signaling', () => ({
  createSignalingClient: (given: JamCallbacks) => {
    signalingCallbacks = given
    return signalingStub
  },
  jamSignalingIsMocked: () => false,
}))

vi.mock('./ice-servers', () => ({
  FALLBACK_ICE_SERVERS: [],
  getIceServers: async () => [],
  resetIceServers: vi.fn(),
}))

/** The one DataChannel a stand-in peer connection opens. */
class FakeChannel {
  binaryType = 'blob'
  readyState = 'connecting'
  onmessage: ((event: { data: unknown }) => void) | null = null
  send = vi.fn()
  close = vi.fn()
}

/** Every stand-in peer connection the service has built, in order. */
const built: FakePeerConnection[] = []

class FakePeerConnection {
  readonly channel = new FakeChannel()
  connectionState = 'new'
  iceConnectionState = 'new'
  signalingState = 'stable'
  addEventListener = vi.fn()
  addTrack = vi.fn()
  getSenders = () => []
  close = vi.fn()
  createDataChannel = () => this.channel

  constructor() {
    built.push(this)
  }
}

function peer(id: string): JamPeer {
  return {
    id,
    displayName: id,
    connectionState: 'connecting',
    latency: 0,
    hasVideo: false,
    hasAudio: false,
  }
}

/** A message arriving on `channel`, as the browser hands it over. */
function deliver(channel: FakeChannel, message: object): void {
  channel.onmessage?.({ data: JSON.stringify(message) })
}

const callbacks = {
  onPeerJoined: vi.fn(),
  onPeerLeft: vi.fn(),
  onPeerStream: vi.fn(),
  onConnectionStateChange: vi.fn(),
  onLatencyUpdate: vi.fn(),
  onChatMessage: vi.fn(),
  onRoomClosed: vi.fn(),
  onError: vi.fn(),
  onSongMessage: vi.fn(),
  onMelodyMessage: vi.fn(),
  onPlaybackMessage: vi.fn(),
} satisfies JamCallbacks

let service: ReturnType<typeof createJamService>

beforeEach(async () => {
  vi.clearAllMocks()
  built.length = 0
  vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
  service = createJamService(callbacks)
  // This device's id sorts after both, so it opens both connections, each
  // with its own channel.
  signalingCallbacks?.onPeerJoined(peer('peer-a'))
  signalingCallbacks?.onPeerJoined(peer('peer-b'))
  // A peer connection is built only after the room's ICE servers are
  // fetched just in time (keyed to the live room), so the two stand-ins
  // appear a tick after the join; wait for them before delivering on them.
  await vi.waitFor(() => expect(built).toHaveLength(2))
})

afterEach(() => {
  service.dispose()
  vi.unstubAllGlobals()
})

const ROOM_MESSAGES = [
  ['song', 'onSongMessage', { type: 'song', action: 'clear' }],
  ['drill', 'onMelodyMessage', { type: 'melody', action: 'clear' }],
  [
    'transport command',
    'onPlaybackMessage',
    {
      type: 'playback',
      action: 'stop',
      scope: 'song',
      positionSec: 0,
      timestamp: 0,
    },
  ],
] as const

describe('a room message, as the service hands it to the store', () => {
  it.each(ROOM_MESSAGES)(
    'names the sender of a %s by its channel, not by what the message says',
    (_kind, handler, body) => {
      const [toA, toB] = built.map((pc) => pc.channel)
      deliver(toB, { ...body, peerId: 'peer-a' })
      deliver(toA, { ...body, peerId: 'peer-b' })

      expect(callbacks[handler].mock.calls).toEqual([
        [{ ...body, peerId: 'peer-a' }, 'peer-b'],
        [{ ...body, peerId: 'peer-b' }, 'peer-a'],
      ])
    },
  )
})
