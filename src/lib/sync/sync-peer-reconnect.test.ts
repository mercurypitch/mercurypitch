// ── Sync peer: a dropped pair rebuilds itself ────────────────────────
// The signaling socket already survives blips (backoff in the shared
// client), and losePeer already removes a dead pair so a fresh one CAN
// be built — but until REQ-SYNC-035 nothing ever re-initiated, so two
// devices still sitting in the same room after an ICE wobble waited for
// each other for ever. These tests drive the peer with a faked
// signaling client and a counting RTCPeerConnection stand-in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const signaling = vi.hoisted(() => ({
  myId: 'zzz' as string | null,
  createRoom: vi.fn(),
  connect: vi.fn(),
  leaveRoom: vi.fn(),
  disconnect: vi.fn(),
  sendOffer: vi.fn(),
  sendAnswer: vi.fn(),
  sendIceCandidate: vi.fn(),
  cb: null as Record<string, (...args: never[]) => void> | null,
}))

vi.mock('@/lib/jam/signaling', () => ({
  createSignalingClient: (cb: Record<string, (...args: never[]) => void>) => {
    signaling.cb = cb
    return {
      createRoom: signaling.createRoom,
      connect: signaling.connect,
      leaveRoom: signaling.leaveRoom,
      disconnect: signaling.disconnect,
      sendOffer: signaling.sendOffer,
      sendAnswer: signaling.sendAnswer,
      sendIceCandidate: signaling.sendIceCandidate,
      getPeerId: () => signaling.myId,
      getRoomId: () => 'ROOM',
    }
  },
}))

vi.mock('@/lib/jam/ice-servers', () => ({
  FALLBACK_ICE_SERVERS: [],
  getIceServers: () => Promise.resolve([]),
  resetIceServers: vi.fn(),
}))

class FakeChannel {
  label = 'sync'
  readyState = 'open'
  binaryType = ''
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: unknown = null
  close = vi.fn()
  send = vi.fn()
}

const built: FakePeerConnection[] = []

class FakePeerConnection {
  channel = new FakeChannel()
  ondatachannel: unknown = null
  onicecandidate: unknown = null
  onnegotiationneeded: (() => void) | null = null
  oniceconnectionstatechange: (() => void) | null = null
  iceConnectionState = 'new'
  signalingState = 'stable'
  remoteDescription = null
  close = vi.fn()

  constructor() {
    built.push(this)
  }

  createDataChannel(): FakeChannel {
    return this.channel
  }

  async createOffer(): Promise<object> {
    return { type: 'offer', sdp: 'x' }
  }

  async createAnswer(): Promise<object> {
    return { type: 'answer', sdp: 'x' }
  }

  async setLocalDescription(): Promise<void> {}
  async setRemoteDescription(): Promise<void> {}
  async addIceCandidate(): Promise<void> {}
}

vi.stubGlobal('RTCPeerConnection', FakePeerConnection)

import type { SyncPeerCallbacks } from '@/lib/sync/sync-peer'
import { createSyncPeer } from '@/lib/sync/sync-peer'

function callbacks(): SyncPeerCallbacks {
  return {
    onChannelReady: vi.fn(),
    onPeerLeft: vi.fn(),
    onControl: vi.fn(),
    onChunk: vi.fn(),
    onError: vi.fn(),
    onRoomClosed: vi.fn(),
  }
}

/** Stand a connected pair up: room joined, peer announced, channel open. */
async function connectedPair(cb: SyncPeerCallbacks) {
  const peer = createSyncPeer(cb)
  await peer.createRoom('Me')
  // Our id ('zzz') is greater, so this side initiates — same glare rule
  // the retry uses.
  signaling.cb?.['onPeerJoined']?.({
    id: 'aaa',
    displayName: 'Other',
  } as never)
  await vi.advanceTimersByTimeAsync(0)
  built[0]!.channel.onopen?.()
  return peer
}

describe('sync peer reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    built.length = 0
    signaling.myId = 'zzz'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('REQ-SYNC-035: rebuilds a dropped pair while both stay in the room', async () => {
    const cb = callbacks()
    await connectedPair(cb)
    expect(cb.onChannelReady).toHaveBeenCalledWith('aaa', 'Other')
    expect(built).toHaveLength(1)

    // The blip: the channel dies while the signaling room stays up.
    built[0]!.channel.onclose?.()
    expect(cb.onPeerLeft).toHaveBeenCalledWith('aaa')

    await vi.advanceTimersByTimeAsync(2_000)
    // A brand-new connection, not the corpse.
    expect(built).toHaveLength(2)

    built[1]!.channel.onopen?.()
    // The display name survived the drop — the store greets the same
    // device, not "Another device".
    expect(cb.onChannelReady).toHaveBeenLastCalledWith('aaa', 'Other')
  })

  it('does not chase a peer that left the room', async () => {
    const cb = callbacks()
    await connectedPair(cb)
    expect(built).toHaveLength(1)

    // A real departure arrives from signaling, not from the channel.
    signaling.cb?.['onPeerLeft']?.('aaa' as never)
    expect(cb.onPeerLeft).toHaveBeenCalledWith('aaa')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(built).toHaveLength(1)
  })

  it('gives up after its two tries', async () => {
    const cb = callbacks()
    await connectedPair(cb)

    built[0]!.channel.onclose?.()
    await vi.advanceTimersByTimeAsync(2_000)
    expect(built).toHaveLength(2)
    // The rebuilt pair never opens (device still away); the second try
    // replaces nothing because the first attempt's connection stands.
    await vi.advanceTimersByTimeAsync(60_000)
    expect(built).toHaveLength(2)
  })

  it('a disposed peer never retries', async () => {
    const cb = callbacks()
    const peer = await connectedPair(cb)

    built[0]!.channel.onclose?.()
    peer.dispose()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(built).toHaveLength(1)
  })
})
