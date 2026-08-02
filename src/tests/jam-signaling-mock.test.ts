// ── Mock signaling tests ──────────────────────────────────────────────
// A preview room has to render populated without pretending anyone is
// really there. These pin the flag (so a local dev server keeps hitting
// the real worker) and the peer lifecycle the layout depends on.

import { describe, expect, it, vi } from 'vitest'
import { createMockSignalingClient } from '@/lib/jam/signaling-mock'
import type { JamCallbacks, JamPeer } from '@/lib/jam/types'

function callbacks(): JamCallbacks & { joined: string[] } {
  const joined: string[] = []
  return {
    joined,
    onPeerJoined: (p: JamPeer) => joined.push(p.id),
    onPeerLeft: vi.fn(),
    onPeerStream: vi.fn(),
    onConnectionStateChange: vi.fn(),
    onLatencyUpdate: vi.fn(),
    onChatMessage: vi.fn(),
    onRoomClosed: vi.fn(),
    onHostStatus: vi.fn(),
    onError: vi.fn(),
  } as unknown as JamCallbacks & { joined: string[] }
}

describe('mock signaling', () => {
  it('hands back a room id shaped like a real one', async () => {
    // The header, invite modal and hosted-rooms list all render it, so a
    // differently shaped id would make the preview lie about layout.
    const cb = callbacks()
    const c = createMockSignalingClient(cb)
    c.createRoom('Tester')
    await vi.waitFor(() => expect(c.getRoomId()).toMatch(/^[A-Z2-9]{8}$/))
  })

  it('makes the creator host and a joiner not', async () => {
    // A joiner is the more interesting state to look at: no mode picker,
    // no transport.
    const host = callbacks()
    createMockSignalingClient(host).createRoom('Tester')
    await vi.waitFor(() => expect(host.onHostStatus).toHaveBeenCalledWith(true))

    const guest = callbacks()
    createMockSignalingClient(guest).connect('ABCD1234', 'Tester')
    await vi.waitFor(() =>
      expect(guest.onHostStatus).toHaveBeenCalledWith(false),
    )
  })

  it('fills the room over time rather than all at once', async () => {
    // Peers arriving one by one exercises the one-peer and two-peer
    // layouts, which is the whole point of previewing it.
    const cb = callbacks()
    createMockSignalingClient(cb).createRoom('Tester')
    await vi.waitFor(() => expect(cb.joined.length).toBe(1), { timeout: 4000 })
    await vi.waitFor(() => expect(cb.joined.length).toBe(2), { timeout: 4000 })
  })

  it('settles peers to connected so the peer list is not stuck', async () => {
    const cb = callbacks()
    createMockSignalingClient(cb).createRoom('Tester')
    await vi.waitFor(
      () =>
        expect(cb.onConnectionStateChange).toHaveBeenCalledWith(
          'preview-peer-1',
          'connected',
        ),
      { timeout: 5000 },
    )
  })

  it('stops inventing peers once disconnected', async () => {
    // Leaving a preview room must not keep firing joins into a torn-down
    // store.
    const cb = callbacks()
    const c = createMockSignalingClient(cb)
    c.createRoom('Tester')
    c.disconnect()
    await new Promise((r) => setTimeout(r, 3000))
    expect(cb.joined).toEqual([])
    expect(c.getRoomId()).toBeNull()
  }, 10_000)

  it('never reports an error, because there is nothing to fail', async () => {
    const cb = callbacks()
    const c = createMockSignalingClient(cb)
    c.createRoom('Tester')
    c.sendOffer('x', 'y')
    c.sendAnswer('x', 'y')
    c.sendIceCandidate('x', 'y')
    await new Promise((r) => setTimeout(r, 500))
    expect(cb.onError).not.toHaveBeenCalled()
  })
})
