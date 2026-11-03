// ============================================================
// Who paused, stopped or played the song: a line for each, with its cause
// ============================================================
//
// The owner's song paused itself a second or two after Play, its sound on
// a TV over AirPlay, and no line said who paused it (3 Nov 2026). Here the
// whole controller plays a streamed song on a clock the test moves by hand
// (clock-stall.fixture.ts), and each way the song pauses, stops or plays
// writes one line to the audio record, shown in the console by default,
// naming who asked (playback-cause.ts).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DeviceTier from '@/lib/device-tier'

vi.mock('@/lib/device-tier', async (importOriginal) => {
  const actual = await importOriginal<typeof DeviceTier>()
  // A phone: the stems stream, which is what the room plays on one.
  return {
    ...actual,
    deviceClass: () => 'mobile',
    classifyDevice: () => 'mobile',
    readDeviceProbe: () => ({
      ...actual.readDeviceProbe(),
      deviceMemoryGb: null,
    }),
  }
})
vi.mock('./stream-switches', () => ({
  decodePastGuard: () => false,
  noStreamForced: () => false,
}))
vi.mock('@/lib/song-audio-cache', () => ({
  readCachedSongAudio: vi.fn(async () => null),
  writeCachedSongAudio: vi.fn(async () => undefined),
}))

const SONG_SECONDS = 246.3
const RATE = 48_000
/** Chunks the size of an AAC packet, as a real stream yields them. */
const CHUNK_SECONDS = 1024 / RATE

function chunkBuffer(seconds: number): AudioBuffer {
  const length = Math.max(1, Math.round(seconds * RATE))
  const channel = new Float32Array(length).fill(0.5)
  return {
    duration: seconds,
    length,
    numberOfChannels: 2,
    sampleRate: RATE,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

vi.mock('./stem-stream-source', () => ({
  canStreamStems: () => true,
  openStemStream: vi.fn(async () => ({
    sampleRate: RATE,
    channelCount: 2,
    durationSeconds: SONG_SECONDS,
    chunks: async function* (fromSeconds: number) {
      for (let t = fromSeconds; t < SONG_SECONDS; t += CHUNK_SECONDS) {
        yield { buffer: chunkBuffer(CHUNK_SECONDS), timestamp: t }
      }
    },
    dispose: () => undefined,
  })),
  readStemShape: vi.fn(async () => null),
}))

import type { MockInstance } from 'vitest'
import { resetAudioDiagnosticsForTests } from '@/lib/audio-diagnostics'
import { asPlaybackCause } from '@/lib/playback-cause'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { playingIn, recorded, setVisibility } from './clock-stall.fixture'
import { STALL_MS } from './clock-watchdog'
import { START_CHECK_MS } from './playback-return-watch'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const playing = async () => playingIn(useStemMixerAudioController)

/** Long enough for a stall's 1.5 s, and the looks either side of it. */
const PAST_A_STALL = STALL_MS + 250

/** Each line of `event`, as who asked and where the song was. */
const said = (event: string) =>
  recorded(event).map((entry) => ({
    by: entry.detail.by,
    position: entry.detail.position,
  }))

let info: MockInstance<(...data: unknown[]) => void>

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  setAudioRouteForTests('speaker', 'Speaker')
  // No frames: what moves the song here is the clock alone.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(4096))),
  )
  // The unlock clip a press of play starts (audio-unlock.ts).
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'log').mockImplementation(() => undefined)
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setAudioRouteForTests(null)
  setVisibility('visible')
})

describe('a pause, and who asked', () => {
  it('says a press of the lock screen paused the song, and where, in a line shown by default', async () => {
    const h = await playing()
    await h.running(2200)

    asPlaybackCause('media-session(pause)', h.controller.handlePause)

    expect(said('pause')).toEqual([
      { by: 'media-session(pause)', position: expect.closeTo(2.2, 1) },
    ])
    const line = info.mock.calls
      .map((call) => String(call[0]))
      .find((text) => text.includes('karaoke pause'))
    expect(line).toMatch(
      /^\[audio\] \d\d:\d\d:\d\d\.\d{3} karaoke pause by=media-session\(pause\) position=2\.\d+$/,
    )
    h.dispose()
  })

  it('writes nothing for a pause of a song already paused', async () => {
    const h = await playing()
    await h.running(1000)
    asPlaybackCause('button', h.controller.handlePause)

    asPlaybackCause('park', h.controller.handlePause)

    expect(said('pause').map((line) => line.by)).toEqual(['button'])
    h.dispose()
  })

  it('says unknown for a pause nobody named, rather than pass it off as another', async () => {
    const h = await playing()

    h.controller.handlePause()

    expect(said('pause').map((line) => line.by)).toEqual(['unknown'])
    h.dispose()
  })

  it('says iOS interrupted the clock', async () => {
    const h = await playing()
    await h.running(1000)

    h.clock.goes('interrupted')

    expect(said('pause').map((line) => line.by)).toEqual(['interruption'])
    h.dispose()
  })

  it('says the clock was about to stop, as the app left with nothing to keep it', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.prepareToSuspend()

    expect(recorded('suspend-fade')).toHaveLength(1)
    expect(said('pause').map((line) => line.by)).toEqual(['suspend'])
    h.dispose()
  })
})

describe('a pause for a clock that stopped, by the watch that gave up', () => {
  it('says the song’s watchdog stopped it', async () => {
    const h = await playing()
    await h.running(1000)

    await h.standing(PAST_A_STALL * 2)

    expect(recorded('clock-stall-stop')).toHaveLength(1)
    expect(said('pause').map((line) => line.by)).toEqual(['watchdog'])
    h.dispose()
  })

  it('says the check after a press of play stopped it', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(PAST_A_STALL * 2)

    asPlaybackCause('notice', h.controller.handlePlay)
    await h.standing(START_CHECK_MS * 2 + 200)

    expect(said('pause').map((line) => line.by)).toEqual([
      'watchdog',
      'start-check',
    ])
    h.dispose()
  })

  it('says the check on the way back stopped it', async () => {
    const h = await playing()
    await h.running(2000)
    setVisibility('hidden')
    await h.running(3000)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)

    await h.standing(10_000)

    expect(said('pause').map((line) => line.by)).toEqual(['return-check'])
    h.dispose()
  })
})

describe('a play, and a stop', () => {
  it('says who played, with the clock as it was and where', async () => {
    const h = await playing()
    await h.running(1000)
    asPlaybackCause('media-session(pause)', h.controller.handlePause)

    asPlaybackCause('media-session(play)', h.controller.handlePlay)

    const plays = recorded('play')
    expect(plays.at(-1)?.detail).toMatchObject({
      by: 'media-session(play)',
      clockWas: 'running',
    })
    // The first play here was named by nobody.
    expect(plays[0]?.detail.by).toBe('unknown')
    h.dispose()
  })

  it('says the song came to its end', async () => {
    const h = await playing()
    await h.running(1000)
    setVisibility('hidden')

    h.clock.currentTime += SONG_SECONDS
    await vi.advanceTimersByTimeAsync(1100)

    expect(said('stop').map((line) => line.by)).toEqual(['end'])
    expect(h.controller.playing()).toBe(false)
    h.dispose()
  })

  it('says the song changed, or the room closed, as its mixer goes while it plays', async () => {
    const changed = await playing()
    await changed.running(1000)
    asPlaybackCause('song-change', changed.dispose)
    expect(said('stop').map((line) => line.by)).toEqual(['song-change'])

    const closed = await playing()
    await closed.running(1000)
    closed.dispose()

    expect(said('stop').map((line) => line.by)).toEqual([
      'song-change',
      'leave',
    ])
  })

  it('writes no stop for a mixer that goes with its song paused', async () => {
    const h = await playing()
    asPlaybackCause('button', h.controller.handlePause)

    h.dispose()

    expect(recorded('stop')).toHaveLength(0)
  })
})
