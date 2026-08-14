// ============================================================
// sync-peer — closing the modal during the ICE fetch
// ============================================================
//
// createRoom and joinRoom both await getIceServers() before touching the
// signaling client, and that await is a network call with a 4s timeout path.
// Closing the Sync-devices modal during it calls dispose(), which disconnects a
// signaling client that has not connected yet. The `disposed` flag was checked
// before the await and not after, so the continuation went on to open a
// WebSocket and a room that nothing was left to close.
//
// Both halves are deferrable here so the close can be landed while the fetch is
// genuinely in flight, rather than approximated with a timer.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const signalingStub = {
  createRoom: vi.fn(),
  connect: vi.fn(),
  leaveRoom: vi.fn(),
  disconnect: vi.fn(),
  send: vi.fn(),
  sendSignal: vi.fn(),
}

vi.mock('@/lib/jam/signaling', () => ({
  createSignalingClient: () => signalingStub,
  jamSignalingIsMocked: () => true,
}))

let resolveIce: ((v: RTCIceServer[]) => void) | null = null

vi.mock('@/lib/jam/ice-servers', () => ({
  FALLBACK_ICE_SERVERS: [],
  resetIceServers: vi.fn(),
  getIceServers: vi.fn(
    async () =>
      await new Promise<RTCIceServer[]>((resolve) => {
        resolveIce = resolve
      }),
  ),
}))

const callbacks = {
  onPeerJoined: vi.fn(),
  onPeerLeft: vi.fn(),
  onChannelReady: vi.fn(),
  onControl: vi.fn(),
  onChunk: vi.fn(),
  onError: vi.fn(),
  onRoomClosed: vi.fn(),
}

describe('createSyncPeer — dispose during the ICE fetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveIce = null
  })

  it('does not create a room after dispose', async () => {
    const { createSyncPeer } = await import('./sync-peer')
    const peer = createSyncPeer(callbacks)

    const pending = peer.createRoom('Phone')
    // The person gives up and closes the modal while the fetch is in flight.
    peer.dispose()
    resolveIce?.([])
    await pending

    expect(signalingStub.createRoom).not.toHaveBeenCalled()
  })

  it('does not join a room after dispose', async () => {
    const { createSyncPeer } = await import('./sync-peer')
    const peer = createSyncPeer(callbacks)

    const pending = peer.joinRoom('ROOM123', 'Phone')
    peer.dispose()
    resolveIce?.([])
    await pending

    expect(signalingStub.connect).not.toHaveBeenCalled()
  })

  it('still creates the room when nobody closed the modal', async () => {
    // The negative control. A guard that refused everything would satisfy both
    // cases above while breaking device sync entirely.
    const { createSyncPeer } = await import('./sync-peer')
    const peer = createSyncPeer(callbacks)

    const pending = peer.createRoom('Phone')
    resolveIce?.([])
    await pending

    expect(signalingStub.createRoom).toHaveBeenCalledWith('Phone')
  })

  it('still joins the room when nobody closed the modal', async () => {
    const { createSyncPeer } = await import('./sync-peer')
    const peer = createSyncPeer(callbacks)

    const pending = peer.joinRoom('ROOM123', 'Phone')
    resolveIce?.([])
    await pending

    expect(signalingStub.connect).toHaveBeenCalledWith('ROOM123', 'Phone')
  })
})
