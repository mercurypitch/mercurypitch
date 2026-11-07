// ============================================================
// Which player a run plays its songs on: Web Audio in the app wherever the
// phone streams, elements elsewhere
// ============================================================
//
// Over AirPlay alone an element plays nothing, routed through Web Audio or
// not (the AirPlay sound check's button 6, 7 Nov 2026), and Web Audio alone
// plays on the TV. So a run in the app plays through Web Audio wherever the
// phone can stream a stem, on every route; the web, and a phone that cannot
// stream, keep the elements. The run is the room's own controller, its mic
// and clock stood in for. What plays a round is told by what the run asks
// for: the stems' streams, or <audio> elements.

import { createRoot } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SpeechModule from '@/components/room-kit/merc-speech'
import type * as CaptureModule from '@/components/room-kit/useExerciseCapture'
import { createStreamingStemVoice } from '@/features/stem-mixer/streaming-stem-voice'
import type { NativeDeviceApi } from '@/stores/native-shell-store'
import { registerNativeDevice } from '@/stores/native-shell-store'
import type { FirstNoteEntry } from './first-note-songs'
import { useFirstNoteController } from './useFirstNoteController'
import type { SongStreams } from './web-audio-song-player'
import type { FakeSongFiles } from './web-audio-song-player.fixture'
import { BAND_LEVEL, FakeClock, fakeSong, fakeStreams, stubFrames, } from './web-audio-song-player.fixture'

const room = vi.hoisted(() => ({ clock: null as AudioContext | null }))

vi.mock('@/components/room-kit/useExerciseCapture', async () => ({
  ...(await vi.importActual<typeof CaptureModule>(
    '@/components/room-kit/useExerciseCapture',
  )),
  useExerciseCapture: () => ({
    acquire: () => Promise.resolve(),
    release: () => undefined,
    held: () => true,
    startWindow: () => undefined,
    peekFrames: () => [],
    takeFrames: () => [],
    playTone: () => Promise.resolve(),
    audio: () => Promise.resolve(room.clock),
    runningAudio: () => room.clock,
  }),
}))

vi.mock('@/components/room-kit/merc-speech', async () => ({
  ...(await vi.importActual<typeof SpeechModule>(
    '@/components/room-kit/merc-speech',
  )),
  createMercSpeech: () => ({
    say: () => undefined,
    hush: () => undefined,
    speaking: () => false,
    dispose: () => undefined,
  }),
}))

/** An <audio> element, counted: the element player makes one a stem. */
class FakeAudio extends EventTarget {
  static made = 0
  src = ''
  preload = ''
  readyState = 0
  currentTime = 0
  disableRemotePlayback = false
  constructor() {
    super()
    FakeAudio.made += 1
  }
  setAttribute(): void {}
  getAttribute(): string | null {
    return null
  }
  removeAttribute(): void {}
  load(): void {}
  pause(): void {}
  play(): Promise<void> {
    return Promise.resolve()
  }
}

const ENTRY: FirstNoteEntry = {
  from: 10,
  at: 18,
  until: 23,
  midi: 60,
  beats: [],
}

let clock: FakeClock
let files: FakeSongFiles
let unregister: () => void = () => undefined
let disposeRoom: () => void = () => undefined

/** The app: its device registered, as main.tsx does before the first render. */
function inTheApp(): void {
  unregister = registerNativeDevice({
    keepAwake: () => undefined,
  } as unknown as NativeDeviceApi)
}

/** A run of one entry, started: the mic opens and the lead-in begins. */
async function startRun(streams: SongStreams): Promise<void> {
  createRoot((dispose) => {
    disposeRoom = dispose
    useFirstNoteController({
      streams,
      songs: [files.song],
      rounds: 1,
      random: () => 0,
    }).start()
  })
  await vi.advanceTimersByTimeAsync(1)
}

beforeEach(() => {
  vi.useFakeTimers()
  stubFrames()
  FakeAudio.made = 0
  vi.stubGlobal('Audio', FakeAudio)
  clock = new FakeClock()
  room.clock = clock.context
  files = fakeSong('josephine', [ENTRY])
})

afterEach(() => {
  disposeRoom()
  unregister()
  unregister = () => undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the player a run plays on', () => {
  it('plays through Web Audio in the app wherever the phone can stream', async () => {
    inTheApp()
    const streams = fakeStreams([files], createStreamingStemVoice, true)

    await startRun(streams)

    expect(FakeAudio.made).toBe(0)
    expect(files.band.asked).toEqual([ENTRY.from])
    expect(clock.windowsOf(BAND_LEVEL)).not.toEqual([])
  })

  it('plays from elements in the app where the phone cannot stream', async () => {
    inTheApp()
    const streams = fakeStreams([files], createStreamingStemVoice, false)

    await startRun(streams)

    expect(FakeAudio.made).toBe(2)
    expect(streams.opened).toEqual([])
    expect(files.band.asked).toEqual([])
  })

  it('plays from elements on the web, though the browser could stream', async () => {
    const streams = fakeStreams([files], createStreamingStemVoice, true)

    await startRun(streams)

    expect(FakeAudio.made).toBe(2)
    expect(streams.opened).toEqual([])
    expect(files.band.asked).toEqual([])
  })
})
