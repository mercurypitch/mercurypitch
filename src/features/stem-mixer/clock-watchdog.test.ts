// ============================================================
// Clock watchdog: a song's clock that stops is said, asked back, then let go
// ============================================================
//
// The clock is a fake the test moves by hand, as the audio thread would,
// and the wall clock is the fake timers'. "Running" moves it in real time;
// "standing" leaves it where it is, which is what the owner's song did on a
// TV over AirPlay (2 Nov 2026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AudioDiagnosticEntry } from '@/lib/audio-diagnostics'
import { audioDiagnosticEntries, audioReporter, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import { STALL_MS, streamFeed, watchSongClock } from './clock-watchdog'

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
}

function watch(over: { watching?: () => boolean } = {}) {
  let clock = new FakeClock()
  const recover = vi.fn()
  const giveUp = vi.fn()
  const stop = watchSongClock({
    clock: () => clock as unknown as BaseAudioContext,
    watching: over.watching ?? (() => true),
    report: audioReporter('karaoke'),
    facts: () => ({ state: clock.state, route: 'airplay', feeding: 'yes' }),
    recover,
    giveUp: () => {
      giveUp()
      // What the room does: the song stops, and its watch with it.
      stop()
    },
  })
  /** Wall time passes; the clock moves `rate` seconds a second. */
  const pass = (ms: number, rate: number): void => {
    for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
      clock.currentTime += (rate * STEP_MS) / 1000
      vi.advanceTimersByTime(STEP_MS)
    }
  }
  return {
    clock: () => clock,
    newClock: () => {
      clock = new FakeClock()
    },
    recover,
    giveUp,
    stop,
    running: (ms: number) => pass(ms, 1),
    standing: (ms: number) => pass(ms, 0),
  }
}

const said = (event: string): AudioDiagnosticEntry[] =>
  audioDiagnosticEntries().filter((entry) => entry.event === event)

beforeEach(() => {
  vi.useFakeTimers()
  resetAudioDiagnosticsForTests()
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  setVisibility('visible')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setVisibility('visible')
})

describe('a song whose clock stops', () => {
  it('warns once it has stood for 1.5 s, with what the room says, and asks it back', () => {
    const w = watch()
    w.running(1000)

    w.standing(STALL_MS + 300)

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
    w.stop()
  })

  it('says once more when the clock moves again, and how long it stood', () => {
    const w = watch()
    w.running(1000)
    w.standing(STALL_MS + 300)

    w.running(1000)

    const moving = said('clock-moving')
    expect(moving).toHaveLength(1)
    expect(moving[0].failed).toBe(false)
    expect(moving[0].detail.stoodMs).toBeGreaterThanOrEqual(STALL_MS)
    expect(w.giveUp).not.toHaveBeenCalled()
    w.stop()
  })

  it('stops the song when the clock still stands after it was asked back', () => {
    const w = watch()
    w.running(1000)
    w.standing(STALL_MS + 300)

    w.standing(STALL_MS + 300)

    expect(w.recover).toHaveBeenCalledTimes(1)
    expect(w.giveUp).toHaveBeenCalledTimes(1)
    expect(said('clock-stall-stop')).toHaveLength(1)
    expect(said('clock-stall-stop')[0].failed).toBe(true)
    // Stopped: nothing more is said however long it stands.
    w.standing(10_000)
    expect(said('clock-stall')).toHaveLength(1)
    expect(w.giveUp).toHaveBeenCalledTimes(1)
  })

  it('stands again after a recovery as a new stall', () => {
    const w = watch()
    w.running(1000)
    w.standing(STALL_MS + 300)
    w.running(1000)

    w.standing(STALL_MS + 300)

    expect(said('clock-stall')).toHaveLength(2)
    expect(w.recover).toHaveBeenCalledTimes(2)
    expect(w.giveUp).not.toHaveBeenCalled()
    w.stop()
  })
})

describe('no false alarm', () => {
  it('while the song is paused', () => {
    let playing = true
    const w = watch({ watching: () => playing })
    w.running(1000)
    playing = false

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    expect(w.recover).not.toHaveBeenCalled()
    w.stop()
  })

  it('at the song’s end, where the room stops watching', () => {
    const w = watch({ watching: () => w.clock().currentTime < 2 })
    w.running(2500)

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.stop()
  })

  it('on a clock that moves in bursts, as one with large buffers does', () => {
    const w = watch()
    w.running(1000)

    for (let burst = 0; burst < 8; burst += 1) {
      w.standing(1000)
      w.clock().currentTime += 1
    }

    expect(said('clock-stall')).toHaveLength(0)
    w.stop()
  })

  it('on a clock iOS interrupted, which is the system’s to give back', () => {
    const w = watch()
    w.running(1000)
    w.clock().state = 'interrupted'

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    expect(w.recover).not.toHaveBeenCalled()
    w.stop()
  })

  it('while the page is hidden', () => {
    const w = watch()
    w.running(1000)
    setVisibility('hidden')

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.stop()
  })

  it('on a clock that never started, which the start check answers', () => {
    const w = watch()

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.stop()
  })

  it('on a clock made since the last look, which starts behind the old one', () => {
    const w = watch()
    w.running(5000)
    w.newClock()

    w.standing(10_000)

    expect(said('clock-stall')).toHaveLength(0)
    w.stop()
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
