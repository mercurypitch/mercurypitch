// Studio click track — ticks open and close at zero, start on whole frames, go to the speakers alone, fade when stopped, and follow the song's beats.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStudioClickScheduler, createStudioClickTrack, renderStudioClick, STUDIO_CLICK_SECONDS, } from './click-track'

afterEach(() => vi.useRealTimers())

describe('renderStudioClick', () => {
  it('opens from silence and closes to exactly zero, so it never steps', () => {
    for (const accent of [true, false]) {
      const tick = renderStudioClick(48000, accent)
      expect(tick).toHaveLength(Math.round(STUDIO_CLICK_SECONDS * 48000))
      expect(tick[0]).toBe(0)
      expect(tick[tick.length - 1]).toBeCloseTo(0, 12)
      // The first and last samples move by far less than a step would.
      expect(Math.abs(tick[1] - tick[0])).toBeLessThan(0.002)
      expect(Math.abs(tick[tick.length - 2])).toBeLessThan(0.002)
    }
  })

  it('makes a bar start louder than the other beats, well under full scale', () => {
    const peak = (values: Float32Array) =>
      values.reduce((most, value) => Math.max(most, Math.abs(value)), 0)
    const accent = peak(renderStudioClick(48000, true))
    const beat = peak(renderStudioClick(48000, false))

    expect(accent).toBeGreaterThan(beat)
    expect(accent).toBeLessThan(0.5)
  })
})

/** A clock with just what the click track touches. */
function fakeContext(currentTime = 1) {
  const destination = { name: 'destination' }
  const gains: {
    connected: unknown[]
    targets: number[][]
    disconnect: ReturnType<typeof vi.fn>
  }[] = []
  const sources: {
    started: number[]
    stopped: number[]
    connected: unknown[]
  }[] = []
  const ctx = {
    currentTime,
    sampleRate: 48000,
    destination,
    createGain() {
      const gain = {
        connected: [] as unknown[],
        targets: [] as number[][],
        gain: {
          setTargetAtTime: (...args: number[]) => gain.targets.push(args),
        },
        connect: (node: unknown) => gain.connected.push(node),
        disconnect: vi.fn(),
      }
      gains.push(gain)
      return gain
    },
    createBuffer: (_channels: number, length: number) => {
      const data = new Float32Array(length)
      return { length, getChannelData: () => data }
    },
    createBufferSource() {
      const source = {
        buffer: null as unknown,
        started: [] as number[],
        stopped: [] as number[],
        connected: [] as unknown[],
        onended: null as null | (() => void),
        connect: (node: unknown) => source.connected.push(node),
        disconnect: vi.fn(),
        start: (time: number) => source.started.push(time),
        stop: (time: number) => source.stopped.push(time),
      }
      sources.push(source)
      return source
    },
  }
  return { ctx: ctx as unknown as BaseAudioContext, raw: ctx, gains, sources }
}

describe('createStudioClickTrack', () => {
  it('starts each tick on a whole frame, to the destination alone', () => {
    const f = fakeContext(1)
    const track = createStudioClickTrack(f.ctx)

    track.schedule([
      { time: 1.5000001, accent: true },
      { time: 2, accent: false },
    ])

    expect(f.sources.map((s) => s.started[0] * 48000)).toEqual([72000, 96000])
    expect(f.gains).toHaveLength(1)
    expect(f.gains[0].connected).toEqual([f.raw.destination])
    expect(f.sources.every((s) => s.connected[0] === f.gains[0])).toBe(true)
  })

  it('skips a tick due within two render quanta of now', () => {
    const f = fakeContext(1)
    const track = createStudioClickTrack(f.ctx)

    track.schedule([
      { time: 0.5, accent: true },
      { time: 1 + 128 / 48000, accent: false },
      { time: 1 + 512 / 48000, accent: false },
    ])

    expect(f.sources).toHaveLength(1)
  })

  it('fades the ticks out with the house release and stops them after it', () => {
    vi.useFakeTimers()
    const f = fakeContext(1)
    const track = createStudioClickTrack(f.ctx)
    track.schedule([
      { time: 1.01, accent: true },
      { time: 3, accent: false },
    ])

    track.stop()

    expect(f.gains[0].targets).toEqual([[0, 1, 0.004]])
    for (const source of f.sources)
      expect(source.stopped[0]).toBeCloseTo(1.03, 9)
    vi.advanceTimersByTime(200)
    expect(f.gains[0].disconnect).toHaveBeenCalled()

    // A later tick gets a fresh level, not the closed one.
    track.schedule([{ time: 4, accent: true }])
    expect(f.gains).toHaveLength(2)
  })
})

describe('createStudioClickScheduler', () => {
  it('ticks the beats from the playhead on, a little ahead, each once', () => {
    vi.useFakeTimers()
    const scheduled: { time: number; accent: boolean }[] = []
    let now = 10
    // Song frame 96000 (bar 2 at 120 bpm) leaves the graph at 10 s.
    const scheduler = createStudioClickScheduler({
      track: { schedule: (ticks) => scheduled.push(...ticks) },
      tempoBpm: 120,
      fromFrame: 96000,
      anchor: () => ({ frame: 96000, time: 10 }),
      now: () => now,
      lookaheadSeconds: 1,
      intervalMs: 250,
    })

    scheduler.start()
    expect(scheduled).toEqual([
      { time: 10, accent: true },
      { time: 10.5, accent: false },
    ])

    now = 10.6
    vi.advanceTimersByTime(250)
    now = 11.3
    vi.advanceTimersByTime(250)
    scheduler.stop()
    vi.advanceTimersByTime(1000)

    expect(scheduled.map((tick) => tick.time)).toEqual([10, 10.5, 11, 11.5, 12])
    expect(scheduled.map((tick) => tick.accent)).toEqual([
      true,
      false,
      false,
      false,
      true,
    ])
  })

  it('starts on the next beat when the playhead is between beats', () => {
    const scheduled: number[] = []
    const scheduler = createStudioClickScheduler({
      track: {
        schedule: (ticks) => scheduled.push(...ticks.map((t) => t.time)),
      },
      tempoBpm: 120,
      fromFrame: 10000,
      anchor: () => ({ frame: 10000, time: 5 }),
      now: () => 5,
      lookaheadSeconds: 0.6,
    })

    scheduler.start()
    scheduler.stop()

    expect(scheduled).toEqual([5 + 14000 / 48000])
  })
})
