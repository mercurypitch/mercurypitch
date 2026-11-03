// ============================================================
// Clock watchdog: a song's clock that stops is said, asked back, then let go
// ============================================================
//
// The clock is a fake the test moves by hand, as the audio thread would,
// and the watch's time is the fake timers' performance.now. "Running" moves
// the clock in real time; "standing" leaves it where it is, which is what
// the owner's song did on a TV over AirPlay (2 Nov 2026). Cases marked
// "review" are the probes of the review of 2 Nov that found a hole.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { audioDiagnosticEntries, audioReporter, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import type { SongClockWatch } from './clock-watchdog'
import { RESTART_LIMIT_MS, STALL_MS, streamFeed, watchSongClock, } from './clock-watchdog'

class FakeClock {
  state = 'running'
  currentTime = 0
}

const STEP_MS = 50

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Every watch a case starts, stopped after it whatever the case did. */
const started: SongClockWatch[] = []

interface WatchOptions {
  watching?: () => boolean
  /** What the try to get the clock going does; done at once by default. */
  recover?: () => Promise<unknown> | undefined
}

function watch(over: WatchOptions = {}) {
  let clock = new FakeClock()
  const recover = vi.fn(over.recover ?? (() => undefined))
  const giveUp = vi.fn()
  const watcher: SongClockWatch = watchSongClock({
    clock: () => clock as unknown as BaseAudioContext,
    watching: over.watching ?? (() => true),
    report: audioReporter('karaoke'),
    facts: () => ({ state: clock.state, route: 'airplay', feeding: 'yes' }),
    recover,
    giveUp: () => {
      giveUp()
      // What the room does: the song stops, and its watch with it.
      watcher.stop()
    },
  })
  started.push(watcher)
  /** Time passes; the clock moves `rate` seconds a second. */
  const pass = async (ms: number, rate: number): Promise<void> => {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
      clock.currentTime += (rate * STEP_MS) / 1000
      await vi.advanceTimersByTimeAsync(STEP_MS)
    }
  }
  return {
    clock: () => clock,
    newClock: () => {
      clock = new FakeClock()
    },
    recover,
    giveUp,
    watcher,
    running: async (ms: number) => pass(ms, 1),
    standing: async (ms: number) => pass(ms, 0),
  }
}

const said = (event: string): AudioDiagnosticEntry[] =>
  audioDiagnosticEntries().filter((entry) => entry.event === event)

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
  })
  resetAudioDiagnosticsForTests()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  setVisibility('visible')
})

afterEach(() => {
  for (const watcher of started.splice(0)) watcher.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
  setVisibility('visible')
})

describe('a song whose clock stops', () => {
  it('warns once it has stood for 1.5 s, with what the room says, and asks it back', async () => {
    const w = watch()
    await w.running(1000)

    await w.standing(STALL_MS + 300)

    const [stall] = said('clock-stall')
    expect(said('clock-stall')).toHaveLength(1)
    expect(stall.failed).toBe(true)
    expect(stall.detail).toMatchObject({
      state: 'running',
      route: 'airplay',
      feeding: 'yes',
    })
    expect(stall.detail.stoodMs).toBeGreaterThanOrEqual(STALL_MS)
    expect(w.recover).toHaveBeenCalledTimes(1)
    expect(w.giveUp).not.toHaveBeenCalled()
    w.watcher.stop()
  })

  it('says once more when the clock moves again, and how long it stood', async () => {
    const w = watch()
    await w.running(1000)
    await w.standing(STALL_MS + 300)

    await w.running(1000)

    const moving = said('clock-moving')
    expect(moving).toHaveLength(1)
    expect(moving[0].failed).toBe(false)
    expect(moving[0].detail.stoodMs).toBeGreaterThanOrEqual(STALL_MS)
    expect(w.giveUp).not.toHaveBeenCalled()
    w.watcher.stop()
  })

  it('stops the song when the clock still stands 1.5 s after it was asked back', async () => {
    const w = watch()
    await w.running(1000)
    await w.standing(STALL_MS + 300)

    await w.standing(STALL_MS + 300)

    expect(w.recover).toHaveBeenCalledTimes(1)
    expect(w.giveUp).toHaveBeenCalledTimes(1)
    expect(said('clock-stall-stop')).toHaveLength(1)
    expect(said('clock-stall-stop')[0].failed).toBe(true)
    // Stopped: nothing more is said however long it stands.
    await w.standing(10_000)
    expect(said('clock-stall')).toHaveLength(1)
    expect(w.giveUp).toHaveBeenCalledTimes(1)
  })

  it('stands again after a recovery as a new stall', async () => {
    const w = watch()
    await w.running(1000)
    await w.standing(STALL_MS + 300)
    await w.running(1000)

    await w.standing(STALL_MS + 300)

    expect(said('clock-stall')).toHaveLength(2)
    expect(w.recover).toHaveBeenCalledTimes(2)
    expect(w.giveUp).not.toHaveBeenCalled()
    w.watcher.stop()
  })

  it('catches a clock that ran a moment after play, then stood (review: probe A)', async () => {
    const w = watch()

    // Past the start check's line, short of the old watch's own.
    await w.running(450)
    await w.standing(STALL_MS + 500)

    expect(said('clock-stall')).toHaveLength(1)
    w.watcher.stop()
  })

  it('catches a clock that ran a moment after the page came back, then stood (review: probe B)', async () => {
    const w = watch()
    await w.running(2000)
    setVisibility('hidden')
    await w.running(3000)
    setVisibility('visible')

    await w.running(300)
    await w.standing(STALL_MS + 500)

    expect(said('clock-stall')).toHaveLength(1)
    w.watcher.stop()
  })
})

describe('the try to get the clock going', () => {
  it('counts the stop from when the try is done, not when it was asked (review: probe C)', async () => {
    let finish: () => void = () => undefined
    const w = watch({
      recover: () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    })
    await w.running(1000)
    await w.standing(STALL_MS + 300)
    expect(w.recover).toHaveBeenCalledTimes(1)

    // A slow suspend: 2 s on, the try is still under way.
    await w.standing(2000)
    expect(w.giveUp).not.toHaveBeenCalled()
    finish()
    await w.standing(STALL_MS - 300)
    expect(w.giveUp).not.toHaveBeenCalled()

    await w.standing(600)

    expect(w.giveUp).toHaveBeenCalledTimes(1)
  })

  it('stops the song when the try never finishes', async () => {
    const w = watch({ recover: () => new Promise<void>(() => undefined) })
    await w.running(1000)
    await w.standing(STALL_MS + 300)

    await w.standing(RESTART_LIMIT_MS - 500)
    expect(w.giveUp).not.toHaveBeenCalled()
    await w.standing(800)

    expect(w.giveUp).toHaveBeenCalledTimes(1)
  })
})

describe('no false alarm', () => {
  it('while the song is paused', async () => {
    let playing = true
    const w = watch({ watching: () => playing })
    await w.running(1000)
    playing = false

    await w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    expect(w.recover).not.toHaveBeenCalled()
    w.watcher.stop()
  })

  it('at the song’s end, where the room stops watching', async () => {
    const w = watch({ watching: () => w.clock().currentTime < 2 })
    await w.running(2500)

    await w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.watcher.stop()
  })

  it('on a clock that moves in bursts, as one with large buffers does', async () => {
    const w = watch()
    await w.running(1000)

    for (let burst = 0; burst < 8; burst += 1) {
      await w.standing(1000)
      w.clock().currentTime += 1
    }

    expect(said('clock-stall')).toHaveLength(0)
    w.watcher.stop()
  })

  it('on a wall clock set forward while the song plays (review)', async () => {
    let wall = Date.now()
    vi.spyOn(Date, 'now').mockImplementation(() => wall)
    const w = watch()

    // Each look the clock has moved just short of the line at one look and
    // past it at the next, as an output that renders in chunks does.
    for (let look = 0; look < 8; look += 1) {
      wall += 250
      w.clock().currentTime += 0.25
      await vi.advanceTimersByTimeAsync(250)
    }
    // The system clock steps 1.3 s forward (network time, a hand on it).
    wall += 250 + 1300
    w.clock().currentTime += 0.24
    await vi.advanceTimersByTimeAsync(250)

    expect(w.recover).not.toHaveBeenCalled()
    expect(said('clock-stall')).toHaveLength(0)
    w.watcher.stop()
  })

  it('on a clock iOS interrupted, which is the system’s to give back', async () => {
    const w = watch()
    await w.running(1000)
    w.clock().state = 'interrupted'

    await w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    expect(w.recover).not.toHaveBeenCalled()
    w.watcher.stop()
  })

  it('while the page is hidden, where it stops looking', async () => {
    const w = watch()
    await w.running(1000)

    setVisibility('hidden')

    // Nothing left to look: the watch's timer is gone until the page is back.
    expect(vi.getTimerCount()).toBe(0)
    await w.standing(10_000)
    expect(said('clock-stall')).toHaveLength(0)
    setVisibility('visible')
    expect(vi.getTimerCount()).toBe(1)
    w.watcher.stop()
  })

  it('on a clock that never started, which the start check answers', async () => {
    const w = watch()

    await w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.watcher.stop()
  })

  it('on a clock made since the last look, which starts behind the old one', async () => {
    const w = watch()
    await w.running(5000)
    w.newClock()

    await w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.watcher.stop()
  })

  it('while a new route sets up, which starts the window over', async () => {
    const w = watch()
    await w.running(1000)
    await w.standing(1000)

    // AirPlay picked mid-song: a moment of silence while it sets up.
    w.watcher.fresh()
    await w.standing(1000)
    expect(said('clock-stall')).toHaveLength(0)

    // Armed as it was: a route on which the clock never comes back still is.
    await w.standing(800)
    expect(said('clock-stall')).toHaveLength(1)
    w.watcher.stop()
  })
})

describe('what a stall says of the stream', () => {
  it('says it was feeding while every stem has sound queued past the clock', () => {
    const feed = streamFeed([
      { queuedSeconds: () => 2.4134 },
      { queuedSeconds: () => 3 },
    ])

    expect(feed).toEqual({ feeding: 'yes', queued: 2.413 })
  })

  it('says it ran dry once one stem has nothing queued', () => {
    const feed = streamFeed([
      { queuedSeconds: () => 2 },
      { queuedSeconds: () => 0 },
    ])

    expect(feed).toEqual({ feeding: 'no', queued: 0 })
  })

  it('says buffered for a song decoded whole, where nothing streams', () => {
    expect(streamFeed([])).toEqual({ feeding: 'buffered' })
  })
})
