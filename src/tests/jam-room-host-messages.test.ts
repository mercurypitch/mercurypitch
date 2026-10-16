// ============================================================
// Jam room messages — only the host drives the room
// ============================================================
//
// The song manifest carries the room's key, its words and who sings which
// line, and every peer adopted whichever manifest arrived. The DataChannel is
// an unauthenticated relay, so a guest's modified client could move
// everyone's key. The drill and the transport had the same gap: the host
// ignored them from anybody, but every guest followed every other guest's
// drill, play, pause and seek. A peer now takes all three only from the peer
// the room's Durable Object names as host, and the service says who sent
// each message.
//
// Driven through a mocked @/lib/jam/service, as jam-room-key-broadcast.test.ts
// does, with the store's own callbacks kept so that each message arrives
// exactly as the service hands it over.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamCallbacks, JamMelodyMessage, JamPlaybackMessage, JamSongMessage, } from '@/lib/jam/types'
import { disposeJam, initJam, jamExerciseMelody, jamExercisePlaying, jamRoomKeyShift, jamSong, jamSongParts, jamSongPositionSec, jamSongSeekRequest, setJamHostPeerId, setJamIsHost, setJamPeerId, } from '@/stores/jam-store'
import type { NoteName } from '@/types'

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

type RoomHandler = 'onSongMessage' | 'onMelodyMessage' | 'onPlaybackMessage'

/** The store's own handler, as it gave it to the service. */
function handler<K extends RoomHandler>(name: K): NonNullable<JamCallbacks[K]> {
  const given = callbacks?.[name]
  if (given === undefined) {
    throw new Error(`the store gave the service no ${name}`)
  }
  return given as NonNullable<JamCallbacks[K]>
}

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
  handler('onSongMessage')(msg, from)
}

function drill(id: string): JamMelodyMessage {
  return {
    type: 'melody',
    action: 'set',
    melody: {
      id,
      name: id,
      bpm: 80,
      key: 'C',
      scaleType: 'major',
      createdAt: 0,
      updatedAt: 0,
      items: [
        {
          id: 1,
          note: { midi: 60, name: 'C' as NoteName, octave: 4, freq: 261.63 },
          duration: 8,
          startBeat: 0,
        },
      ],
    },
  }
}

/** A drill message arriving over the DataChannel from `from`. */
function receiveDrill(msg: JamMelodyMessage, from: string): void {
  handler('onMelodyMessage')(msg, from)
}

function songCommand(
  action: JamPlaybackMessage['action'],
  positionSec: number,
): JamPlaybackMessage {
  return { type: 'playback', action, scope: 'song', positionSec, timestamp: 0 }
}

function drillCommand(
  action: JamPlaybackMessage['action'],
): JamPlaybackMessage {
  return {
    type: 'playback',
    action,
    scope: 'drill',
    currentBeat: 0,
    timestamp: 0,
  }
}

/** A transport command arriving over the DataChannel from `from`. */
function receiveCommand(msg: JamPlaybackMessage, from: string): void {
  handler('onPlaybackMessage')(msg, from)
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

/** Where this device's copy of the song is: playing, at which second. */
const transport = () => ({
  playing: jamExercisePlaying(),
  at: jamSongPositionSec(),
})

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

describe("the song's transport, as a guest receives it", () => {
  it('plays, seeks and stops for the host', () => {
    receiveCommand(songCommand('play', 30), HOST)
    expect(transport()).toEqual({ playing: true, at: 30 })

    const before = jamSongSeekRequest().token
    receiveCommand(songCommand('seek', 90), HOST)
    expect([transport(), jamSongSeekRequest().token]).toEqual([
      { playing: true, at: 90 },
      before + 1,
    ])

    receiveCommand(songCommand('stop', 0), HOST)
    expect(transport()).toEqual({ playing: false, at: 0 })
  })

  it('plays, seeks and stops for nobody else', () => {
    receiveCommand(songCommand('play', 30), GUEST)
    expect(transport()).toEqual({ playing: false, at: 0 })

    receiveCommand(songCommand('play', 30), HOST)
    const before = jamSongSeekRequest().token
    receiveCommand(songCommand('seek', 90), GUEST)
    receiveCommand(songCommand('stop', 0), GUEST)

    expect([transport(), jamSongSeekRequest().token]).toEqual([
      { playing: true, at: 30 },
      before,
    ])
  })
})

describe("the room's drill, as a guest receives it", () => {
  beforeEach(() => {
    // The host moves the room off the song and onto a drill.
    receive({ type: 'song', action: 'clear' }, HOST)
    receiveDrill(drill('host-drill'), HOST)
  })

  it("takes the host's drill, and plays it when the host says", () => {
    receiveCommand(drillCommand('play'), HOST)

    expect([jamExerciseMelody()?.id, jamExercisePlaying()]).toEqual([
      'host-drill',
      true,
    ])
  })

  it("keeps the host's drill when another guest sends one, or clears it", () => {
    receiveDrill(drill('their-drill'), GUEST)
    expect(jamExerciseMelody()?.id).toBe('host-drill')

    receiveDrill({ type: 'melody', action: 'clear' }, GUEST)
    expect(jamExerciseMelody()?.id).toBe('host-drill')
  })

  it("keeps the host's drill playing when another guest's drill ends", () => {
    receiveCommand(drillCommand('play'), HOST)
    receiveCommand(drillCommand('stop'), GUEST)

    expect(jamExercisePlaying()).toBe(true)
  })
})
