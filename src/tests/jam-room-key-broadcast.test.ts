// ============================================================
// Jam room key — what the room is sent while the host steps it
// ============================================================
//
// Every press of the host's key stepper re-sent the whole song manifest
// (words, notes, parts) to every peer, so stepping from 0 to +4 sent four
// manifests and every guest moved through each key on the way. Presses close
// together now go out as one manifest, in the key the host stopped on. The
// host's own audio follows the store, and the store moves on every press.
//
// Driven through a mocked @/lib/jam/service, as jam-mute-race.test.ts does:
// what a peer receives is whatever the service's sendSong is given.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import { assignJamSongLines, disposeJam, initJam, jamRoomKeyShift, selectJamSong, setJamIsHost, setJamPeers, setJamRoomKeyShift, } from '@/stores/jam-store'

interface SentManifest {
  id: string
  keyShift?: number
  parts?: Record<number, string>
}

function createServiceDouble() {
  return {
    sendSong: vi.fn<(song: object | null) => void>(),
    sendSongHave: vi.fn(),
    dispose: vi.fn(),
    leaveRoom: vi.fn(),
  }
}

let service = createServiceDouble()

vi.mock('@/lib/jam/service', () => ({
  createJamService: () => service,
}))

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

/** The manifests the room has been sent, oldest first. */
const sent = (): Array<SentManifest | null> =>
  service.sendSong.mock.calls.map(
    ([manifest]) => manifest as SentManifest | null,
  )

beforeEach(() => {
  vi.useFakeTimers()
  service = createServiceDouble()
  initJam()
  setJamPeers([])
  setJamIsHost(true)
  selectJamSong(song('demo'))
  service.sendSong.mockClear()
})

afterEach(() => {
  disposeJam()
  vi.useRealTimers()
})

describe('the room key, while the host steps it', () => {
  it('sends presses close together as one manifest, in the key the host stopped on', () => {
    setJamRoomKeyShift(1)
    expect(jamRoomKeyShift()).toBe(1)
    vi.advanceTimersByTime(60)
    setJamRoomKeyShift(2)
    expect(jamRoomKeyShift()).toBe(2)
    vi.advanceTimersByTime(60)
    setJamRoomKeyShift(3)
    expect(jamRoomKeyShift()).toBe(3)
    expect(sent()).toEqual([])

    vi.advanceTimersByTime(150)

    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ id: 'demo', keyShift: 3 })
  })

  it('still sends each of two presses made well apart', () => {
    setJamRoomKeyShift(-1)
    vi.advanceTimersByTime(150)
    setJamRoomKeyShift(-2)
    vi.advanceTimersByTime(150)

    expect(sent().map((manifest) => manifest?.keyShift)).toEqual([-1, -2])
  })

  it('lets a manifest sent for another reason carry the key, instead of sending a second', () => {
    setJamRoomKeyShift(2)
    assignJamSongLines(0, 0, 'peer-a')
    vi.advanceTimersByTime(150)

    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({
      id: 'demo',
      keyShift: 2,
      parts: { 0: 'peer-a' },
    })
  })

  it('drops a key change for a song the room has moved on from', () => {
    setJamRoomKeyShift(2)
    selectJamSong(song('next'))
    vi.advanceTimersByTime(150)

    expect(sent()).toHaveLength(1)
    expect(sent()[0]).toMatchObject({ id: 'next' })
    expect(sent()[0]).not.toHaveProperty('keyShift')
  })
})
