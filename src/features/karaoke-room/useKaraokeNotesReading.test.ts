// ============================================================
// The room's notes read at rest: what stops it, and what lets it go on
// ============================================================
//
// The hook over the room's parts as plain signals, the real microphone
// manager over a device stood in for, and the real notes reader over a read
// the test holds open: a read that is stopped rejects as the real one does,
// so what is under test is when the room asks for a read and when it lets
// go of one.

import { createRoot, createSignal } from 'solid-js'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { micManager } from '@/lib/mic-manager'
import type { RoomSong } from './karaoke-room-library'

vi.mock('./karaoke-room-library', () => ({
  roomLibrary: (): RoomSong[] => [
    {
      sessionId: 'a',
      title: 'Alpha',
      artist: null,
      durationSec: 200,
      credit: null,
      kind: 'yours',
      stems: { vocal: '', instrumental: '' },
    },
  ],
}))

vi.mock('@/stores/uvr-store', () => ({
  getUvrSession: (sessionId: string) => ({ sessionId }),
  isSessionStoreReady: () => true,
}))

const { resetKaraokeNotesForTests, setKaraokeNotesReaderForTests } =
  await import('./karaoke-notes-reader')
const { reloadNotesWantedForTests, wantNotesRead } =
  await import('./karaoke-notes-wanted')
const { resetSongReadLockForTests } = await import('@/lib/song-read-lock')
const { useKaraokeNotesReading } = await import('./useKaraokeNotesReading')

/** Each read the room started, held open until it is stopped. */
let reads: AbortSignal[] = []

/** How the room arrives: at rest unless said. */
interface Arriving {
  readonly seeded?: boolean
  readonly loading?: boolean
  /** No mixer handed over yet: the first song is still being cued. */
  readonly cueing?: boolean
}

/** The room's parts, each a switch the test throws. */
function room(arriving: Arriving = {}) {
  const [seeded, setSeeded] = createSignal(arriving.seeded ?? true)
  const [playing, setPlaying] = createSignal(false)
  const [loading, setLoading] = createSignal(arriving.loading ?? false)
  const [findingNotes, setFindingNotes] = createSignal(false)
  const controls = {
    playing,
    loading,
    findingNotes,
  } as unknown as HostedMixerControls
  const [mixer, setMixer] = createSignal<HostedMixerControls | null>(
    arriving.cueing === true ? null : controls,
  )
  const [pageHidden, setPageHidden] = createSignal(false)
  const [inWindow, setInWindow] = createSignal(false)
  const [findListening, setFindListening] = createSignal(false)
  const stop = createRoot((dispose) => {
    useKaraokeNotesReading({
      seeded,
      mixer,
      pageHidden,
      inWindow,
      findListening,
    })
    return dispose
  })
  return {
    stop,
    controls,
    setSeeded,
    setPlaying,
    setLoading,
    setFindingNotes,
    setMixer,
    setPageHidden,
    setInWindow,
    setFindListening,
  }
}

/** A microphone that opens when asked. */
function deviceThatOpens(): void {
  const track = {
    stop: () => undefined,
    getSettings: () => ({ deviceId: 'mic' }),
    addEventListener: () => undefined,
  }
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => Promise.resolve(stream) },
  })
}

let info: MockInstance<typeof console.info>
let stopRoom: () => void = () => undefined
/** Long enough for a read the room would start to have started. */
const aMoment = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 10)
  })
const told = (): string[] =>
  info.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith('[notes-read] stopped'))

beforeEach(() => {
  // A phone that streams, so the room reads at all.
  vi.stubGlobal('AudioDecoder', vi.fn())
  deviceThatOpens()
  localStorage.clear()
  reloadNotesWantedForTests()
  resetKaraokeNotesForTests()
  resetSongReadLockForTests()
  reads = []
  setKaraokeNotesReaderForTests(
    (_sessionId, run) =>
      new Promise((_resolve, reject) => {
        const signal = run?.signal
        if (signal !== undefined) reads.push(signal)
        signal?.addEventListener('abort', () => {
          const error = new Error('stopped')
          error.name = 'AbortError'
          reject(error)
        })
      }),
  )
  wantNotesRead('a')
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(async () => {
  stopRoom()
  setKaraokeNotesReaderForTests(null)
  await micManager.forceReleaseAll()
  vi.unstubAllGlobals()
  info.mockRestore()
})

describe("the room's notes, read at rest", () => {
  it('are read while the room rests', async () => {
    stopRoom = room().stop

    await vi.waitFor(() => expect(reads).toHaveLength(1))
    expect(reads[0].aborted).toBe(false)
  })

  it.each([
    [
      'a song is playing',
      (r: ReturnType<typeof room>, busy: boolean) => r.setPlaying(busy),
    ],
    [
      'a song is loading',
      (r: ReturnType<typeof room>, busy: boolean) => r.setLoading(busy),
    ],
    [
      'the mixer is reading its own notes',
      (r: ReturnType<typeof room>, busy: boolean) => r.setFindingNotes(busy),
    ],
    [
      'the app is hidden',
      (r: ReturnType<typeof room>, busy: boolean) => r.setPageHidden(busy),
    ],
    [
      'the room is in the small window',
      (r: ReturnType<typeof room>, busy: boolean) => r.setInWindow(busy),
    ],
    [
      'Find by singing is listening',
      (r: ReturnType<typeof room>, busy: boolean) => r.setFindListening(busy),
    ],
  ])(
    'stop when %s, and read the song again from its start after',
    async (why, busy) => {
      const r = room()
      stopRoom = r.stop
      await vi.waitFor(() => expect(reads).toHaveLength(1))

      busy(r, true)

      expect(reads[0].aborted).toBe(true)
      expect(told()).toEqual([
        `[notes-read] stopped reading "Alpha": ${why}. It is read again from the start at the next rest`,
      ])
      busy(r, false)
      await vi.waitFor(() => expect(reads).toHaveLength(2))
      expect(reads[1].aborted).toBe(false)
    },
  )

  it('stop when a capture opens the microphone, and go on once it lets go', async () => {
    stopRoom = room().stop
    await vi.waitFor(() => expect(reads).toHaveLength(1))

    await micManager.acquire('stem-mixer')

    expect(reads[0].aborted).toBe(true)
    expect(told()).toEqual([
      '[notes-read] stopped reading "Alpha": the microphone is on. It is read again from the start at the next rest',
    ])
    micManager.release('stem-mixer')
    await vi.waitFor(() => expect(reads).toHaveLength(2))
  })

  it('go on beside a hold that keeps the device open and captures nothing', async () => {
    stopRoom = room().stop
    await vi.waitFor(() => expect(reads).toHaveLength(1))

    await micManager.acquire('routine')

    expect(reads[0].aborted).toBe(false)
  })

  it('wait for the examples to be in', async () => {
    const r = room({ seeded: false })
    stopRoom = r.stop
    await aMoment()
    expect(reads).toHaveLength(0)

    r.setSeeded(true)

    await vi.waitFor(() => expect(reads).toHaveLength(1))
  })

  it('wait for a song on the stage that has loaded', async () => {
    const r = room({ cueing: true, loading: true })
    stopRoom = r.stop
    await aMoment()
    r.setMixer(r.controls)
    await aMoment()
    expect(reads).toHaveLength(0)

    r.setLoading(false)

    await vi.waitFor(() => expect(reads).toHaveLength(1))
  })

  it('stop for good when the room goes', async () => {
    const r = room()
    await vi.waitFor(() => expect(reads).toHaveLength(1))

    r.stop()

    expect(reads[0].aborted).toBe(true)
    expect(told()).toEqual([
      '[notes-read] stopped reading "Alpha": the room closed. It is read again from the start at the next rest',
    ])
    await new Promise((resolve) => {
      setTimeout(resolve, 30)
    })
    expect(reads).toHaveLength(1)
  })
})
