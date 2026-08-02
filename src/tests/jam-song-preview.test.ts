// ── A song room in a PR preview ──────────────────────────────────────
// Previews run against mock signaling, which invents a couple of peers so
// the room has something in it. Those peers are props: they cannot hear
// anything, so refusing a local song on their behalf blocks the feature
// the preview exists to demonstrate.
//
// Its own file because the mock flag has to be set before the store is
// imported, and the rest of the song tests want the real answer.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type * as Signaling from '@/lib/jam/signaling'

vi.mock('@/lib/jam/signaling', async () => {
  const actual = await vi.importActual<typeof Signaling>('@/lib/jam/signaling')
  return { ...actual, jamSignalingIsMocked: () => true }
})

const store = await import('@/stores/jam-store')

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'session:mine',
    title: 'My Take',
    stems: { instrumental: 'blob:mine' },
    lines: [],
    notes: [],
    durationSec: 90,
    origin: 'local',
    ...over,
  }
}

const fakePeer = {
  id: 'mock-ada',
  displayName: 'Ada',
  connectionState: 'connected' as const,
  latency: 0,
  hasVideo: false,
  hasAudio: true,
}

describe('a song room in a preview', () => {
  beforeEach(() => {
    store.clearJamSong()
    store.setJamError(null)
    store.setJamPeers([])
  })

  it('lets you load your own song even with invented peers present', () => {
    store.setJamPeers([fakePeer])
    expect(store.selectJamSong(song())).toBe(true)
    expect(store.jamError()).toBeNull()
  })

  it('still refuses a song with no backing track', () => {
    // The peer-count exemption is about who can hear it, not about
    // waiving every check -- a song with nothing to sing over is broken
    // in a preview exactly as it is anywhere else.
    store.setJamPeers([fakePeer])
    expect(store.selectJamSong(song({ stems: { instrumental: '' } }))).toBe(
      false,
    )
    expect(store.jamError()).toMatch(/no backing track/i)
  })
})
