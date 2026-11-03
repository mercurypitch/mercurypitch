// ============================================================
// A song whose clock stops while it plays, in the room that hosts it
// ============================================================
//
// The owner's song stuck on a TV over AirPlay with no error (2 Nov 2026).
// Here the whole controller plays a streamed song on a clock the test
// moves by hand (clock-stall.fixture.ts): a clock that stops is warned of
// with the route and the stream, asked back once, and a song whose clock
// still stands is paused, its clock parked and the room told, where it
// used to sit "playing" at a fixed place. Cases marked "review" are the
// probes of the review of 2 Nov that found a hole. The watchdog's own
// rules are in clock-watchdog.test.ts.

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

import { resetAudioDiagnosticsForTests } from '@/lib/audio-diagnostics'
import { setAudioRouteForTests } from '@/stores/audio-route-store'
import { playingIn, recorded, setVisibility } from './clock-stall.fixture'
import { RESTART_LIMIT_MS, STALL_MS } from './clock-watchdog'
import { START_CHECK_MS } from './playback-return-watch'
import type { StemMixerAudioDeps } from './useStemMixerAudioController'
import { useStemMixerAudioController } from './useStemMixerAudioController'

const playing = async (
  inTheRoom = true,
  over: Partial<StemMixerAudioDeps> = {},
) => playingIn(useStemMixerAudioController, inTheRoom, over)

/** Long enough for a stall's 1.5 s, and the looks either side of it. */
const PAST_A_STALL = STALL_MS + 250

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  setAudioRouteForTests('airplay', 'LG C2')
  // No frames: what moves the song here is the clock alone.
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array(4096))),
  )
  // The unlock clip a press of play starts (audio-unlock.ts).
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
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

describe('a clock that stops while the song plays', () => {
  it('warns with the clock’s state, the route and the stream, and asks the clock back once', async () => {
    const h = await playing()
    await h.running(1000)

    await h.standing(PAST_A_STALL)

    const [stall] = recorded('clock-stall')
    expect(recorded('clock-stall')).toHaveLength(1)
    expect(stall).toMatchObject({
      source: 'karaoke',
      failed: true,
      detail: { state: 'running', route: 'airplay', feeding: 'yes' },
    })
    // The stream had its windows ready: the clock stopped on its own.
    expect(stall.detail.queued).toBeGreaterThan(0)
    expect(stall.detail.position).toBeCloseTo(1, 1)
    expect(recorded('clock-restart')).toHaveLength(1)
    expect(h.clock.suspend).toHaveBeenCalledTimes(1)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })

  it('says so in a warning line the console shows by default, naming no port', async () => {
    const h = await playing()
    await h.running(1000)

    await h.standing(PAST_A_STALL)

    const warned = vi.mocked(console.warn).mock.calls.map(([line]) => line)
    expect(warned).toContainEqual(
      expect.stringMatching(
        /^\[audio\] \d\d:\d\d:\d\d\.\d{3} karaoke clock-stall state=running route=airplay feeding=yes queued=[\d.]+ position=[\d.]+ clock=[\d.]+ stoodMs=\d+$/,
      ),
    )
    // The receiver's name ("LG C2", or someone's AirPods) is no log's.
    const everyLine = [console.warn, console.info, console.log].flatMap(
      (method) => vi.mocked(method).mock.calls.map((call) => String(call[0])),
    )
    expect(everyLine.filter((line) => line.includes('LG C2'))).toEqual([])
    h.dispose()
  })

  it('plays on, and says so once more, when the clock moves again', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(PAST_A_STALL)

    await h.running(1000)

    const moving = recorded('clock-moving')
    expect(moving).toHaveLength(1)
    expect(moving[0].failed).toBe(false)
    expect(moving[0].detail.stoodMs).toBeGreaterThanOrEqual(STALL_MS)
    expect(h.controller.playing()).toBe(true)
    expect(h.controller.stalled()).toBe(false)
    h.dispose()
  })

  it('stops the song where it was, parks the clock and marks it, when it still stands', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(PAST_A_STALL)

    await h.standing(PAST_A_STALL)

    expect(recorded('clock-stall-stop')).toHaveLength(1)
    expect(recorded('clock-stall-stop')[0].failed).toBe(true)
    // No more "playing" at a fixed time: the transport says paused.
    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    expect(h.controller.elapsed()).toBeCloseTo(1, 1)
    // Parked, so the next press of play starts the clock for real.
    expect(h.clock.state).toBe('suspended')
    // The room says why; no toast over it.
    expect(h.notifications).toEqual([])
    expect(recorded('clock-restart')).toHaveLength(1)
    h.dispose()
  })

  it('clears the mark on the next press of play', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(PAST_A_STALL * 2)
    expect(h.controller.stalled()).toBe(true)

    h.controller.handlePlay()

    expect(h.controller.stalled()).toBe(false)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })
})

describe('every way a song stops for its clock, marked for the room (review)', () => {
  it('stops a song whose clock ran a moment after play, then stood (probe A)', async () => {
    const h = await playing()

    await h.running(450)
    await h.standing(20_000)

    expect(recorded('clock-stall')).toHaveLength(1)
    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    h.dispose()
  })

  it('stops a song whose clock ran a moment after the way back, then stood (probe B)', async () => {
    const h = await playing()
    await h.running(2000)
    setVisibility('hidden')
    await h.running(3000)
    setVisibility('visible')
    // The way back cycles the clock (installAudioUnlock): let it settle.
    await vi.advanceTimersByTimeAsync(0)
    await h.running(300)

    await h.standing(20_000)

    expect(recorded('clock-stall')).toHaveLength(1)
    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    h.dispose()
  })

  it('marks a song whose clock never moved after the way back, with no toast', async () => {
    const h = await playing()
    await h.running(2000)
    setVisibility('hidden')
    await h.running(3000)
    setVisibility('visible')
    await vi.advanceTimersByTimeAsync(0)

    await h.standing(10_000)

    expect(recorded('clock-stuck').length).toBeGreaterThan(0)
    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    expect(h.notifications).toEqual([])
    h.dispose()
  })

  it('marks a press of play that never starts the clock, so the room names AirPlay (probe E)', async () => {
    const h = await playing()
    await h.running(1000)
    await h.standing(PAST_A_STALL * 2)
    expect(h.controller.stalled()).toBe(true)

    // Play again, from the transport, with the sound still going to the TV.
    h.controller.handlePlay()
    await h.standing(START_CHECK_MS * 2 + 200)

    expect(h.controller.playing()).toBe(false)
    expect(h.controller.stalled()).toBe(true)
    expect(h.notifications).toEqual([])
    h.dispose()
  })
})

describe('a try to get the clock going that comes late (review)', () => {
  it('counts the stop from the try done, as a slow suspend finishes it (probe C)', async () => {
    const h = await playing()
    await h.running(1000)
    h.clock.slowSuspendMs = 2000
    await h.standing(PAST_A_STALL)
    expect(recorded('clock-stall')).toHaveLength(1)

    // Where the stop used to come, the try is still under way.
    await h.standing(PAST_A_STALL)
    expect(recorded('clock-stall-stop')).toHaveLength(0)
    expect(h.controller.playing()).toBe(true)

    await h.standing(PAST_A_STALL)

    expect(recorded('clock-stall-stop')).toHaveLength(1)
    expect(h.controller.stalled()).toBe(true)
    // Parked, and nothing after the stop runs it again.
    await h.standing(3000)
    expect(h.clock.state).toBe('suspended')
    expect(h.clock.log.at(-1)).toBe('suspend done -> suspended')
  })

  it('never runs a clock the song parked when a try given up on finishes late', async () => {
    const h = await playing()
    await h.running(1000)
    h.clock.slowSuspendMs = RESTART_LIMIT_MS + 1000
    await h.standing(PAST_A_STALL)

    await h.standing(RESTART_LIMIT_MS + 3000)

    expect(recorded('clock-stall-stop')).toHaveLength(1)
    expect(h.controller.playing()).toBe(false)
    // The slow suspend landed after the stop: no resume followed it.
    expect(h.clock.log.filter((step) => step === 'resume asked')).toEqual([])
    expect(h.clock.state).toBe('suspended')
  })

  it('never runs the clock again once the room has let it go (probe D)', async () => {
    const h = await playing()
    await h.running(1000)
    h.clock.slowSuspendMs = 300
    await h.standing(PAST_A_STALL)
    expect(recorded('clock-stall')).toHaveLength(1)

    // The singer leaves the room while the restart is under way.
    h.dispose()
    await h.standing(10_000)

    expect(h.clock.state).toBe('suspended')
    expect(h.clock.log.filter((step) => step === 'resume asked')).toEqual([])
  })

  it('never restarts a clock iOS interrupted, which is the system’s to give back', async () => {
    const h = await playing(true, { keepsPlayingHidden: () => true })
    const resumes = h.clock.resume.mock.calls.length

    // Another app takes the sound as the song starts; the room waits a
    // moment to see whether the app is on its way behind it.
    h.clock.goes('interrupted')
    await h.standing(START_CHECK_MS + 200)

    expect(recorded('clock-stuck').length).toBeGreaterThan(0)
    expect(recorded('clock-restart')).toEqual([])
    expect(h.clock.resume).toHaveBeenCalledTimes(resumes)
    h.dispose()
  })
})

describe('no false alarm', () => {
  it('across a seek while the song plays', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.seekTo(120)
    await h.running(5000)

    expect(recorded('clock-stall')).toHaveLength(0)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })

  it('across a change of speed (review: probe F)', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.setSpeed(0.5)
    await h.running(5000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('across a main thread that stood 4 s while the clock ran (review: probe F)', async () => {
    const h = await playing()
    await h.running(1000)

    // No timer runs during a block; the clock and the wall both move on.
    h.clock.currentTime += 4
    vi.setSystemTime(Date.now() + 4000)
    await h.running(2000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('across the page hidden with the clock parked, then a slow start back (review: probe F)', async () => {
    const h = await playing()
    await h.running(2000)
    setVisibility('hidden')
    await h.standing(5000)
    setVisibility('visible')

    await h.standing(1000)
    await h.running(4000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('while a new route sets up, which starts the window over', async () => {
    setAudioRouteForTests('speaker', 'Speaker')
    const h = await playing()
    await h.running(1000)
    await h.standing(1000)

    // AirPlay picked mid-song: a moment of silence while it sets up.
    setAudioRouteForTests('airplay', 'LG C2')
    await h.standing(1000)
    expect(recorded('clock-stall')).toHaveLength(0)

    // A route on which the clock never comes back is still said.
    await h.standing(800)
    expect(recorded('clock-stall')).toHaveLength(1)
    h.dispose()
  })

  it('while the song is paused', async () => {
    const h = await playing()
    await h.running(1000)

    h.controller.handlePause()
    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('at the song’s end', async () => {
    const h = await playing()
    await h.running(1000)

    h.clock.currentTime += SONG_SECONDS
    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    h.dispose()
  })

  it('outside a room that hosts the mixer, where nothing watches', async () => {
    const h = await playing(false)
    await h.running(1000)

    await h.standing(10_000)

    expect(recorded('clock-stall')).toHaveLength(0)
    expect(h.controller.playing()).toBe(true)
    h.dispose()
  })
})
