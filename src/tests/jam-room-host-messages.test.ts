// ============================================================
// Jam room messages — only the host sets the room's song
// ============================================================
//
// The song manifest carries the room's key, its words and who sings which
// line, and every peer adopted whichever manifest arrived. The DataChannel is
// an unauthenticated relay, so a guest's modified client could move
// everyone's key. A peer now takes the song only from the peer the room's
// Durable Object names as host, and the service says who sent each message.
//
// Driven through a mocked @/lib/jam/service, as jam-room-key-broadcast.test.ts
// does, with the store's own callbacks kept so that each message arrives
// exactly as the service hands it over.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamCallbacks, JamSongMessage } from '@/lib/jam/types'
import { disposeJam, initJam, jamRoomKeyShift, jamSong, jamSongParts, setJamHostPeerId, setJamIsHost, setJamPeerId, } from '@/stores/jam-store'

function createServiceDouble() {
  return {
    sendSong: vi.fn(),
    sendSongHave: vi.fn(),
    dispose: vi.fn(),
    leaveRoom: vi.fn(),
  }
}

let service = createServiceDouble()
let callbacks: JamCallbacks | null = null

vi.mock('@/lib/jam/service', () => ({
  createJamService: (given: JamCallbacks) => {
    callbacks = given
    return service
  },
}))

const HOST = 'host-peer'
const GUEST = 'other-guest'

type WireSong = NonNullable<JamSongMessage['song']>

function manifest(over: Partial<WireSong> = {}): JamSongMessage {
  return {
    type: 'song',
    action: 'set',
    song: {
      id: 'demo',
      title: 'Demo',
      stems: { instrumental: 'https://example.test/inst.m4a' },
      lines: [
        { text: 'first line', startSec: 0 },
        { text: 'second line', startSec: 4 },
      ],
      notes: [{ midi: 60, startSec: 0, endSec: 1 }],
      durationSec: 180,
      ...over,
    },
  }
}

/** A song message arriving over the DataChannel from `from`. */
function receive(msg: JamSongMessage, from: string): void {
  if (callbacks?.onSongMessage === undefined) {
    throw new Error('the store gave the service no song handler')
  }
  callbacks.onSongMessage(msg, from)
}

/** What the room's song is on this device: its id, key, words and parts. */
const room = () => ({
  id: jamSong()?.id,
  key: jamRoomKeyShift(),
  words: jamSong()?.lines.map((line) => line.text),
  parts: jamSongParts(),
})

const HOST_SONG = {
  id: 'demo',
  key: 2,
  words: ['first line', 'second line'],
  parts: { 0: 'me' },
}

beforeEach(() => {
  service = createServiceDouble()
  initJam()
  setJamPeerId('me')
  setJamIsHost(false)
  setJamHostPeerId(HOST)
  receive(manifest({ keyShift: 2, parts: { 0: 'me' } }), HOST)
})

afterEach(() => {
  disposeJam()
})

describe("the room's song, as a guest receives it", () => {
  it("takes the host's song, key and parts", () => {
    expect(room()).toEqual(HOST_SONG)
  })

  it("keeps the host's key, words and parts when another guest sends the same song", () => {
    receive(
      manifest({
        keyShift: 6,
        lines: [{ text: 'not the words', startSec: 0 }],
        parts: { 0: GUEST, 1: GUEST },
      }),
      GUEST,
    )

    expect(room()).toEqual(HOST_SONG)
  })

  it('keeps the song when another guest sends a different one, or clears it', () => {
    receive(manifest({ id: 'theirs', title: 'Theirs' }), GUEST)
    expect(room()).toEqual(HOST_SONG)

    receive({ type: 'song', action: 'clear' }, GUEST)
    expect(room()).toEqual(HOST_SONG)
  })

  it('takes the next key from the host', () => {
    receive(manifest({ keyShift: -3, parts: { 0: 'me' } }), HOST)

    expect(room()).toEqual({ ...HOST_SONG, key: -3 })
  })

  it('takes nothing once the host has left, even from the peer that was host', () => {
    setJamHostPeerId(null)
    receive(manifest({ keyShift: 6 }), HOST)

    expect(room()).toEqual(HOST_SONG)
  })
})

describe("the room's song, as the host receives one", () => {
  it('keeps its own song, key and parts when a guest sends a manifest', () => {
    setJamIsHost(true)
    setJamHostPeerId('me')
    receive(manifest({ keyShift: 5, parts: { 0: GUEST } }), GUEST)

    expect(room()).toEqual(HOST_SONG)
  })
})
