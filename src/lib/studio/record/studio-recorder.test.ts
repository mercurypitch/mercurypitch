// Studio recorder — arming opens the clock and the microphone in the press, a take counts in on the song's grid, stops cleanly, survives a lost microphone, and is journaled until kept.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StudioCaptureEvents } from './capture-node'
import type { StudioRecordSettings } from './record-settings'
import type { StudioCapturedTake, StudioRecorderDeps, StudioRecorderView, } from './studio-recorder'
import { createStudioRecorder, MIC_LOST_ARMED, MIC_LOST_MID_TAKE, } from './studio-recorder'

afterEach(() => vi.useRealTimers())

const RATE = 48000

function harness(
  over: Partial<StudioRecorderDeps> = {},
  settings: Partial<StudioRecordSettings> = {},
) {
  const ctx = {
    currentTime: 1,
    sampleRate: RATE,
    state: 'running',
    baseLatency: 0.01,
    outputLatency: 0.02,
  }
  const events: StudioCaptureEvents[] = []
  const captures: {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }[] = []
  const clicks = { schedule: vi.fn(), stop: vi.fn() }
  const monitor = { set: vi.fn(), dispose: vi.fn() }
  const transport = {
    playing: vi.fn(() => false),
    playheadFrame: vi.fn(() => 96000),
    canPlay: vi.fn(() => true),
    play: vi.fn(async () => true),
    pause: vi.fn(),
    anchor: vi.fn((): { frame: number; time: number } | null => null),
  }
  const journal = {
    begin: vi.fn(async () => undefined),
    place: vi.fn(async () => undefined),
    append: vi.fn(
      async (
        _id: string,
        _sequence: number,
        _firstFrame: number,
        _pcm: Int16Array,
      ) => undefined,
    ),
    discard: vi.fn(async () => undefined),
  }
  const views: StudioRecorderView[] = []
  const kept: StudioCapturedTake[] = []
  const releaseMemory = vi.fn()
  const source = { disconnect: vi.fn() }
  const deps: StudioRecorderDeps = {
    unlock: vi.fn(async () => true),
    clock: () => ctx as unknown as AudioContext,
    acquireMic: vi.fn(async () => ({}) as MediaStream),
    releaseMic: vi.fn(),
    prepareWorklet: vi.fn(async () => undefined),
    openCapture: vi.fn((_context, _input, handlers) => {
      events.push(handlers)
      const capture = { start: vi.fn(), stop: vi.fn(), dispose: vi.fn() }
      captures.push(capture)
      return capture
    }),
    createSource: () => source as unknown as AudioNode,
    createClicks: () => clicks,
    createMonitor: () => monitor,
    monitorLevel: () => ({ on: false, gain: 1, pan: 0 }),
    transport,
    settings: () => ({
      countInBars: 1,
      click: false,
      monitor: false,
      offsetMs: 0,
      ...settings,
    }),
    tempoBpm: () => 120,
    roundTrip: () => 0.05,
    reserveMemory: vi.fn(() => releaseMemory),
    journal,
    keep: vi.fn(async (take: StudioCapturedTake) => {
      kept.push(take)
      return true
    }),
    title: () => 'Take 1',
    createId: () => 'take-1',
    describeError: (error) =>
      `described ${(error as { kind?: string }).kind ?? String(error)}`,
    onChange: (view) => views.push(view),
    ...over,
  }
  const recorder = createStudioRecorder(deps)
  return {
    ctx,
    deps,
    recorder,
    transport,
    clicks,
    monitor,
    journal,
    kept,
    releaseMemory,
    captures,
    /** The newest capture's worklet messages. */
    get worklet() {
      return events[events.length - 1]
    },
    get capture() {
      return captures[captures.length - 1]
    },
    view: () => recorder.view(),
    /** A pooled buffer holding `frames` samples of `value`. */
    chunk(firstFrame: number, frames: number, value = 0.25) {
      const buffer = new ArrayBuffer(4096 * 4)
      new Float32Array(buffer, 0, frames).fill(value)
      this.worklet.chunk(firstFrame, frames, buffer)
    },
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('arming', () => {
  it('opens the clock and the microphone inside the press, then meters the lane', async () => {
    const h = harness()

    const arming = h.recorder.arm('lane-1')

    // Both asked for before the first await gives the press away.
    expect(h.deps.unlock).toHaveBeenCalledOnce()
    expect(h.deps.acquireMic).toHaveBeenCalledOnce()
    expect(h.view().phase).toBe('arming')
    expect(await arming).toBe(true)
    expect(h.view()).toMatchObject({ phase: 'armed', targetTrackId: 'lane-1' })
    expect(h.deps.openCapture).toHaveBeenCalledOnce()
    expect(h.monitor.set).toHaveBeenCalledWith({ on: false, gain: 1, pan: 0 })

    h.worklet.level(0.4, 1536)
    expect(h.view().level).toBe(0.4)
  })

  it('says why when the microphone is refused, and holds nothing', async () => {
    const h = harness({
      acquireMic: vi.fn(async () => {
        throw Object.assign(new Error('denied'), { kind: 'permission-denied' })
      }),
    })

    expect(await h.recorder.arm(null)).toBe(false)

    expect(h.view()).toMatchObject({
      phase: 'idle',
      error: 'described permission-denied',
    })
    expect(h.deps.openCapture).not.toHaveBeenCalled()
    expect(h.deps.releaseMic).not.toHaveBeenCalled()
  })

  it('gives the microphone back when the clock does not start', async () => {
    const h = harness({ unlock: vi.fn(async () => false) })

    expect(await h.recorder.arm(null)).toBe(false)

    expect(h.view().phase).toBe('idle')
    expect(h.view().error).toMatch(/audio didn't start/)
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
  })

  it('lets go of an arm disarmed before it finished opening', async () => {
    const h = harness()
    const arming = h.recorder.arm(null)

    h.recorder.disarm()

    expect(await arming).toBe(false)
    expect(h.view()).toMatchObject({ phase: 'idle', error: null })
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
    expect(h.deps.openCapture).not.toHaveBeenCalled()
  })

  it('closes the capture and gives the microphone back on disarm', async () => {
    const h = harness()
    await h.recorder.arm(null)

    h.recorder.disarm()

    expect(h.capture.dispose).toHaveBeenCalled()
    expect(h.monitor.dispose).toHaveBeenCalled()
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
    expect(h.view().phase).toBe('idle')
  })
})

describe('the count-in', () => {
  it('ticks the bar before the playhead and starts the song on its last frame', async () => {
    vi.useFakeTimers()
    const h = harness()
    await h.recorder.arm('lane-1')

    expect(h.recorder.record()).toBe(true)

    // Pressed at 1 s: capture from 1.1 s, a bar of 120 bpm, song at 3.1 s.
    expect(h.capture.start).toHaveBeenCalledWith(52800, expect.any(Number))
    expect(h.transport.play).toHaveBeenCalledWith(3.1)
    const ticks = h.clicks.schedule.mock.calls[0][0] as {
      time: number
      accent: boolean
    }[]
    expect(ticks.map((tick) => +tick.time.toFixed(6))).toEqual([
      1.1, 1.6, 2.1, 2.6,
    ])
    expect(ticks.map((tick) => tick.accent)).toEqual([
      true,
      false,
      false,
      false,
    ])
    expect(h.view().phase).toBe('counting')

    // The beats left, as heard: 30 ms of output path after each tick.
    await vi.advanceTimersByTimeAsync(140)
    expect(h.view().countBeat).toBe(4)
    await vi.advanceTimersByTimeAsync(1500)
    expect(h.view().countBeat).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(h.view()).toMatchObject({ phase: 'recording', countBeat: null })
  })

  it('records at once with no count-in, the song asked to start then', async () => {
    const h = harness({}, { countInBars: 0 })
    await h.recorder.arm(null)

    h.recorder.record()

    expect(h.view().phase).toBe('recording')
    expect(h.transport.play).toHaveBeenCalledWith(1.1)
    expect(h.clicks.schedule).not.toHaveBeenCalled()
  })

  it('follows a song already playing, keeping all of the take', async () => {
    const h = harness()
    h.transport.playing.mockReturnValue(true)
    h.transport.anchor.mockReturnValue({ frame: 48000, time: 0.9 })
    await h.recorder.arm(null)

    h.recorder.record()

    expect(h.view().phase).toBe('recording')
    expect(h.transport.play).not.toHaveBeenCalled()
    // Song frame at 1.1 s is 48000 + 0.2 s; the round trip comes off.
    expect(h.view().live).toMatchObject({
      heardFirst: 48000 + 0.2 * RATE - 0.05 * RATE,
      fromFrame: null,
    })
  })

  it('cancels on Stop during the count-in, keeping nothing and the lane armed', async () => {
    const h = harness()
    await h.recorder.arm('lane-1')
    h.recorder.record()
    const first = h.capture

    h.recorder.stop()
    await settle()

    expect(h.view()).toMatchObject({ phase: 'armed', live: null })
    expect(h.transport.pause).toHaveBeenCalled()
    expect(h.clicks.stop).toHaveBeenCalled()
    expect(first.dispose).toHaveBeenCalled()
    expect(h.captures).toHaveLength(2)
    expect(h.deps.keep).not.toHaveBeenCalled()
    expect(h.journal.discard).toHaveBeenCalledWith('take-1')
    expect(h.releaseMemory).toHaveBeenCalled()
    expect(h.deps.releaseMic).not.toHaveBeenCalled()
  })

  it('stays armed when the memory for a take is refused', async () => {
    const h = harness({
      reserveMemory: vi.fn(() => {
        throw new Error('no room')
      }),
    })
    await h.recorder.arm(null)

    expect(h.recorder.record()).toBe(false)

    expect(h.view()).toMatchObject({ phase: 'armed' })
    expect(h.view().error).toMatch(/no room/)
    expect(h.capture.start).not.toHaveBeenCalled()
  })
})

describe('a take', () => {
  async function recording(over: Partial<StudioRecorderDeps> = {}) {
    const h = harness(over, { countInBars: 0 })
    await h.recorder.arm('lane-1')
    h.recorder.record()
    // The song started 20 ms later than asked.
    h.transport.anchor.mockReturnValue({ frame: 96000, time: 1.12 })
    await settle()
    h.worklet.started(1.1 * RATE)
    return h
  }

  it('stops one round trip past Stop and hands over the whole capture, placed by the song', async () => {
    const h = await recording()
    h.chunk(0, 4096)
    h.chunk(4096, 1000)
    h.ctx.currentTime = 1.2

    h.recorder.stop()

    expect(h.capture.stop).toHaveBeenCalledWith(
      Math.round((1.2 + 0.05) * RATE),
      'stopped',
    )
    expect(h.transport.pause).toHaveBeenCalled()
    expect(h.view().phase).toBe('finishing')

    h.worklet.stopped(5096, 'stopped')
    await settle()

    expect(h.kept).toHaveLength(1)
    const take = h.kept[0]
    expect(take).toMatchObject({
      id: 'take-1',
      title: 'Take 1',
      trackId: 'lane-1',
      sampleRate: RATE,
      fromFrame: 96000,
      // Frame 96000 left the graph at 1.12 s; the capture began at 1.1 s.
      heardFirst: 96000 - 0.02 * RATE - 0.05 * RATE,
    })
    expect(take.samples).toHaveLength(5096)
    expect(take.samples[5095]).toBe(0.25)
    expect(h.view()).toMatchObject({ phase: 'idle', live: null, notice: null })
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
    expect(h.releaseMemory).toHaveBeenCalled()
    await settle()
    expect(h.journal.discard).toHaveBeenCalledWith('take-1')
  })

  it('journals about a second at a time, in order, once the take is placed', async () => {
    const h = await recording()
    for (let at = 0; at < 3 * 4096 * 4; at += 4096) h.chunk(at, 4096)
    await settle()

    expect(h.journal.begin).toHaveBeenCalledOnce()
    expect(h.journal.place).toHaveBeenCalledWith(
      'take-1',
      96000 - 0.02 * RATE - 0.05 * RATE,
    )
    const rows = h.journal.append.mock.calls.map(
      ([, sequence, firstFrame, pcm]) => [sequence, firstFrame, pcm.length],
    )
    expect(rows).toEqual([[0, 0, 49152]])
    expect(h.journal.begin.mock.invocationCallOrder[0]).toBeLessThan(
      h.journal.append.mock.invocationCallOrder[0],
    )
  })

  it('keeps what it heard when the microphone goes away mid-take, and says so', async () => {
    const h = await recording()
    h.chunk(0, 2048)

    h.recorder.micLost()

    expect(h.capture.stop).toHaveBeenCalledWith(null, 'input-lost')
    h.worklet.stopped(2048, 'input-lost')
    await settle()
    expect(h.kept[0].samples).toHaveLength(2048)
    expect(h.view()).toMatchObject({
      phase: 'idle',
      notice: MIC_LOST_MID_TAKE,
    })
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
  })

  it('keeps a take the worklet ended on its own, naming why', async () => {
    const h = await recording()
    h.chunk(0, 1024)

    h.worklet.stopped(1024, 'limit')
    await settle()

    expect(h.kept).toHaveLength(1)
    expect(h.view().notice).toMatch(/five minutes/)
    expect(h.transport.pause).toHaveBeenCalled()
  })

  it('writes the journal out when the take could not be kept', async () => {
    const h = await recording({ keep: vi.fn(async () => false) })
    h.chunk(0, 4096)
    h.recorder.stop()

    h.worklet.stopped(4096, 'stopped')
    await settle()
    await settle()

    expect(h.journal.append).toHaveBeenCalledOnce()
    expect(h.journal.discard).not.toHaveBeenCalled()
    expect(h.view().phase).toBe('idle')
  })

  it('finishes with what arrived when the worklet never reports its stop', async () => {
    vi.useFakeTimers()
    const h = harness({}, { countInBars: 0 })
    await h.recorder.arm(null)
    h.recorder.record()
    h.worklet.started(1.1 * RATE)
    h.chunk(0, 3000)

    h.recorder.stop()
    await vi.advanceTimersByTimeAsync(2100)

    expect(h.kept).toHaveLength(1)
    expect(h.kept[0].samples).toHaveLength(3000)
  })

  it('does not let a song still starting begin after Stop', async () => {
    let started: (value: boolean) => void = () => undefined
    const h = harness({}, { countInBars: 0 })
    h.transport.play.mockImplementation(
      () => new Promise<boolean>((resolve) => (started = resolve)),
    )
    await h.recorder.arm(null)
    h.recorder.record()
    h.worklet.started(1.1 * RATE)
    h.recorder.stop()
    const pausesAtStop = h.transport.pause.mock.calls.length

    started(true)
    await settle()

    expect(h.transport.pause.mock.calls.length).toBe(pausesAtStop + 1)
  })

  it('leaves a take recording when the Studio closes to the journal', async () => {
    const h = await recording()
    h.chunk(0, 4096)

    h.recorder.dispose()
    await settle()

    expect(h.journal.append).toHaveBeenCalledOnce()
    expect(h.journal.discard).not.toHaveBeenCalled()
    expect(h.deps.keep).not.toHaveBeenCalled()
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
  })

  it('reports a take stopped before its first sample as too short', async () => {
    const h = harness({}, { countInBars: 0 })
    await h.recorder.arm(null)
    h.recorder.record()

    h.worklet.stopped(0, 'stopped')
    await settle()

    expect(h.deps.keep).not.toHaveBeenCalled()
    expect(h.view().notice).toMatch(/too short/)
  })
})

describe('losses while armed', () => {
  it('disarms with a way back when the microphone goes away', async () => {
    const h = harness()
    await h.recorder.arm(null)

    h.recorder.micLost()

    expect(h.view()).toMatchObject({ phase: 'idle', error: MIC_LOST_ARMED })
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
  })

  it('drops a count-in and disarms when the clock stops', async () => {
    const h = harness()
    await h.recorder.arm(null)
    h.recorder.record()

    h.recorder.clockStopped()

    expect(h.view().phase).toBe('idle')
    expect(h.deps.keep).not.toHaveBeenCalled()
    expect(h.deps.releaseMic).toHaveBeenCalledOnce()
  })
})
