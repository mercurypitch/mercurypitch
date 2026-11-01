// ============================================================
// The room's notes read at rest: what stops it, and what lets it go on
// ============================================================
//
// The hook over the room's parts as plain signals, the real microphone
// manager over a device stood in for, the shell's real covered flag, and
// the real notes reader over a read the test holds open: a read that is
// stopped rejects as the real one does, so what is under test is when the
// room asks for a read and when it lets go of one. The room's clock is
// faked, for the rest it waits before a read.

import { createRoot, createSignal } from 'solid-js'
import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMixerControls } from '@/components/stem-mixer-hosting'
import { micManager } from '@/lib/mic-manager'
import { setTabCoveredByShell } from '@/stores/native-shell-store'
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

const {
  karaokeNotesHold,
  resetKaraokeNotesForTests,
  setKaraokeNotesReaderForTests,
} = await import('./karaoke-notes-reader')
const { reloadNotesWantedForTests, wantNotesRead } =
  await import('./karaoke-notes-wanted')
const { resetSongReadLockForTests } = await import('@/lib/song-read-lock')
const { REST_DELAY_MS, useKaraokeNotesReading } =
  await import('./useKaraokeNotesReading')

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

/** The room rests long enough for a read to start, a stopped one unwound. */
const rest = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(REST_DELAY_MS)
}

let info: MockInstance<typeof console.info>
let stopRoom: () => void = () => undefined
const told = (): string[] =>
  info.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith('[notes-read] stopped'))

beforeEach(() => {
  // A phone that streams, so the room reads at all.
  vi.stubGlobal('AudioDecoder', vi.fn())
  vi.useFakeTimers()
  deviceThatOpens()
  localStorage.clear()
  reloadNotesWantedForTests()
  resetKaraokeNotesForTests()
  resetSongReadLockForTests()
  setTabCoveredByShell(false)
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
  setTabCoveredByShell(false)
  await micManager.forceReleaseAll()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  info.mockRestore()
})

describe("the room's notes, read at rest", () => {
  it('are read once the room has rested a while, and not before', async () => {
    stopRoom = room().stop

    await vi.advanceTimersByTimeAsync(REST_DELAY_MS - 1)
    expect(reads).toHaveLength(0)
    expect(karaokeNotesHold()).toBe('settling')
    await vi.advanceTimersByTimeAsync(1)

    expect(reads).toHaveLength(1)
    expect(reads[0].aborted).toBe(false)
  })

  it('are not read for a pause shorter than the rest', async () => {
    const r = room()
    stopRoom = r.stop
    r.setPlaying(true)

    r.setPlaying(false)
    await vi.advanceTimersByTimeAsync(REST_DELAY_MS - 1)
    r.setPlaying(true)
    await rest()

    expect(reads).toHaveLength(0)
  })

  it.each([
    [
      'a song is playing',
      'playing',
      (r: ReturnType<typeof room>, busy: boolean) => r.setPlaying(busy),
    ],
    [
      'a song is loading',
      'loading',
      (r: ReturnType<typeof room>, busy: boolean) => r.setLoading(busy),
    ],
    [
      'the mixer is reading its own notes',
      'mixer',
      (r: ReturnType<typeof room>, busy: boolean) => r.setFindingNotes(busy),
    ],
    [
      'the app is hidden',
      'hidden',
      (r: ReturnType<typeof room>, busy: boolean) => r.setPageHidden(busy),
    ],
    [
      'the room is in the small window',
      'window',
      (r: ReturnType<typeof room>, busy: boolean) => r.setInWindow(busy),
    ],
    [
      'a screen is over the room',
      'covered',
      (_r: ReturnType<typeof room>, busy: boolean) => {
        setTabCoveredByShell(busy)
      },
    ],
    [
      'Find by singing is listening',
      'find',
      (r: ReturnType<typeof room>, busy: boolean) => r.setFindListening(busy),
    ],
  ])(
    'stop when %s, and read the song again from its start after a rest',
    async (why, hold, busy) => {
      const r = room()
      stopRoom = r.stop
      await rest()
      expect(reads).toHaveLength(1)

      busy(r, true)

      expect(reads[0].aborted).toBe(true)
      expect(karaokeNotesHold()).toBe(hold)
      expect(told()).toEqual([
        `[notes-read] stopped reading "Alpha": ${why}. It is read again from the start at the next rest`,
      ])
      busy(r, false)
      await rest()
      expect(reads).toHaveLength(2)
      expect(reads[1].aborted).toBe(false)
    },
  )

  it('stop when a take or another room captures from the microphone, and go on once it lets go', async () => {
    stopRoom = room().stop
    await rest()

    await micManager.acquire('audio-engine-7')

    expect(reads[0].aborted).toBe(true)
    expect(karaokeNotesHold()).toBe('capture')
    micManager.release('audio-engine-7')
    await vi.waitFor(() => expect(karaokeNotesHold()).toBe('settling'))
    await rest()
    expect(reads).toHaveLength(2)
  })

  it("go on beside the stage's own mic, voice control's, and a hold that captures nothing", async () => {
    stopRoom = room().stop
    await rest()

    await micManager.acquire('stem-mixer')
    await micManager.acquire('voice-control#3')
    await micManager.acquire('routine')

    expect(reads).toHaveLength(1)
    expect(reads[0].aborted).toBe(false)
  })

  it('wait for the examples to be in', async () => {
    const r = room({ seeded: false })
    stopRoom = r.stop
    await rest()
    expect(reads).toHaveLength(0)
    expect(karaokeNotesHold()).toBe('seeding')

    r.setSeeded(true)
    await rest()

    expect(reads).toHaveLength(1)
  })

  it('wait for a song on the stage that has loaded', async () => {
    const r = room({ cueing: true, loading: true })
    stopRoom = r.stop
    await rest()
    r.setMixer(r.controls)
    await rest()
    expect(reads).toHaveLength(0)

    r.setLoading(false)
    await rest()

    expect(reads).toHaveLength(1)
  })

  it('stop for good when the room goes', async () => {
    const r = room()
    await rest()
    expect(reads).toHaveLength(1)

    r.stop()

    expect(reads[0].aborted).toBe(true)
    expect(told()).toEqual([
      '[notes-read] stopped reading "Alpha": the room closed. It is read again from the start at the next rest',
    ])
    await rest()
    expect(reads).toHaveLength(1)
  })
})
