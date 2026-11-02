// ============================================================
// Jam room — catching up a peer who arrives late
// ============================================================
//
// The room's drill and its mode reached a peer only when the host changed
// one of them, so somebody who joined after the host had set the room up
// sat on a drill of their own, in unison, until the host touched
// something. The host now sends both to that peer once their channel is
// open. Not when they are announced (onPeerJoined runs before there is a
// channel to them), and not to the room: taking a drill rewinds a guest's
// transport, so an arrival must not stop everyone already singing.
//
// Driven through a mocked @/lib/jam/service with the store's own callbacks
// kept, as jam-room-host-messages.test.ts does: what a peer receives is
// whatever the service's sendMelody is given. What that puts on the wire
// is service-message-sender.test.ts's.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamCallbacks, JamPeer } from '@/lib/jam/types'
import { disposeJam, initJam, jamExerciseMelody, jamRoomMode, selectJamExercise, selectJamRoomMode, selectJamSong, setJamHostPeerId, setJamIsHost, setJamPeerId, } from '@/stores/jam-store'
import type { MelodyData, NoteName } from '@/types'

function createServiceDouble() {
  return {
    sendMelody: vi.fn(),
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
const LATE = 'late-peer'

type Arrival = 'onPeerJoined' | 'onPeerChannelReady' | 'onMelodyMessage'

/** The store's own handler, as it gave it to the service. */
function handler<K extends Arrival>(name: K): NonNullable<JamCallbacks[K]> {
  const given = callbacks?.[name]
  if (given === undefined) {
    throw new Error(`the store gave the service no ${name}`)
  }
  return given as NonNullable<JamCallbacks[K]>
}

function drill(id: string): MelodyData {
  return {
    id,
    name: id,
    bpm: 110,
    key: 'C',
    scaleType: 'major',
    createdAt: 0,
    updatedAt: 0,
    items: [
      {
        id: 1,
        note: { midi: 60, name: 'C' as NoteName, octave: 4, freq: 261.63 },
        duration: 4,
        startBeat: 0,
      },
    ],
  }
}

/** A song that already has its pitch line, so picking it starts no analysis. */
function song(id: string): JamSong {
  return {
    id,
    title: 'Demo',
    stems: { instrumental: 'https://example.test/inst.m4a' },
    lines: [{ text: 'a line', startSec: 0 }],
    notes: [{ midi: 60, startSec: 0, endSec: 1 }],
    durationSec: 180,
    origin: 'url',
  }
}

function peer(id: string): JamPeer {
  return {
    id,
    displayName: id,
    connectionState: 'connecting',
    latency: 0,
    hasVideo: false,
    hasAudio: true,
  }
}

/** Someone arrives: the room announces them, and later their channel opens. */
function arrive(id: string): void {
  handler('onPeerJoined')(peer(id))
  handler('onPeerChannelReady')(id)
}

beforeEach(() => {
  service = createServiceDouble()
  initJam()
})

afterEach(() => {
  disposeJam()
})

describe('a peer who arrives after the host has set the room up', () => {
  beforeEach(() => {
    setJamPeerId(HOST)
    setJamHostPeerId(HOST)
    setJamIsHost(true)
  })

  it('is sent the drill and its mode, on their own channel once it opens', () => {
    const arpeggio = drill('arpeggio')
    selectJamExercise(arpeggio)
    selectJamRoomMode('harmony')
    service.sendMelody.mockClear()

    handler('onPeerJoined')(peer(LATE))
    // Announced, with no channel to them yet: a message sent now would
    // reach everyone but them.
    expect(service.sendMelody).not.toHaveBeenCalled()

    handler('onPeerChannelReady')(LATE)
    // To them alone, so the room already singing keeps its place.
    expect(service.sendMelody.mock.calls).toEqual([[arpeggio, 'harmony', LATE]])
  })

  it('is sent no drill when the room has moved on to a song', () => {
    selectJamExercise(drill('arpeggio'))
    selectJamRoomMode('harmony')
    selectJamSong(song('demo'))
    service.sendMelody.mockClear()

    arrive(LATE)

    expect(service.sendMelody).not.toHaveBeenCalled()
  })
})

describe('the same arrival, on the late peer', () => {
  beforeEach(() => {
    setJamPeerId(LATE)
    setJamHostPeerId(HOST)
    setJamIsHost(false)
  })

  it("trades the drill it picked for itself, in unison, for the host's drill and mode", () => {
    // A peer arriving in a room seeds a default drill of its own (JamPanel),
    // and that was all it had until the host changed something.
    selectJamExercise(drill('my-default'))
    expect([jamExerciseMelody()?.id, jamRoomMode()]).toEqual([
      'my-default',
      'unison',
    ])

    handler('onMelodyMessage')(
      {
        type: 'melody',
        action: 'set',
        melody: drill('arpeggio'),
        mode: 'harmony',
      },
      HOST,
    )

    expect([jamExerciseMelody()?.id, jamRoomMode()]).toEqual([
      'arpeggio',
      'harmony',
    ])
  })

  it('sends its own drill to nobody when its channel to the host opens', () => {
    selectJamExercise(drill('my-default'))
    service.sendMelody.mockClear()

    handler('onPeerChannelReady')(HOST)

    expect(service.sendMelody).not.toHaveBeenCalled()
  })
})
