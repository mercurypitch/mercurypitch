// Studio recorder — arming opens the clock and the microphone in the press, the arm moves between lanes and stays after a take, a take counts in on the song's grid, stops cleanly, survives a lost microphone, and is journaled until kept.
import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseMicLock } from '@/lib/mic-lock'
import { MicManager } from '@/lib/mic-manager'
import type { StudioCaptureEvents } from './capture-node'
import type { StudioRecordSettings } from './record-settings'
import { DEFAULT_STUDIO_RECORD_SETTINGS } from './record-settings'
import type { StudioCapturedTake, StudioRecorderDeps, StudioRecorderView, } from './studio-recorder'
import { createStudioRecorder, MIC_LOST_ARMED, MIC_LOST_BEFORE_TAKE, MIC_LOST_MID_TAKE, } from './studio-recorder'

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
  /** The hold's own release: the one way the recorder gives the microphone back. */
  const releaseMic = vi.fn()
  const deps: StudioRecorderDeps = {
    unlock: vi.fn(async () => true),
    clock: () => ctx as unknown as AudioContext,
    acquireMic: vi.fn(async () => ({
      stream: {} as MediaStream,
      release: releaseMic,
    })),
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
      ...DEFAULT_STUDIO_RECORD_SETTINGS,
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
    releaseMic,
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

describe('another input picked on an armed lane', () => {
  afterEach(() => releaseMicLock())

  /** A browser that opens a stream on whichever input is asked for; the inputs it opened. */
  function fakeInputs(): string[] {
    const opened: string[] = []
    ;(
      globalThis.navigator as unknown as { mediaDevices: unknown }
    ).mediaDevices = {
      getUserMedia: vi.fn(async (constraints: MediaStreamConstraints) => {
        const asked = (constraints.audio as MediaTrackConstraints).deviceId
        const device = (asked as { exact?: string } | undefined)?.exact
        const id = device ?? 'default'
        opened.push(id)
        const track = {
          stop: vi.fn(),
          addEventListener: vi.fn(),
          getSettings: () => ({ deviceId: id }),
        }
        return { getTracks: () => [track], getAudioTracks: () => [track] }
      }),
    }
    return opened
  }

  it("re-arms on the input picked: the capture hears that input, not the one before nor the app's", async () => {
    const opened = fakeInputs()
    const mic = new MicManager()
    await mic.setPreferredDevice('app-in')
    let input = 'usb-1'
    const heard: MediaStream[] = []
    const h = harness({
      acquireMic: () => mic.acquireFrom('studio-record', input),
      createSource: (_context, stream) => {
        heard.push(stream)
        return { disconnect: vi.fn() } as unknown as AudioNode
      },
    })
    expect(await h.recorder.arm('lane-1')).toBe(true)

    // As chooseInput does (useStudioRecorder.ts): the setting first, then
    // disarm and arm in the same task.
    input = 'usb-2'
    h.recorder.disarm()
    expect(await h.recorder.arm('lane-1')).toBe(true)
    await settle()

    const track = heard.at(-1)!.getAudioTracks()[0] as unknown as {
      stop: Mock
      getSettings(): MediaTrackSettings
    }
    expect(track.getSettings().deviceId).toBe('usb-2')
    expect(track.stop).not.toHaveBeenCalled()
    expect(opened).toEqual(['usb-1', 'usb-2'])
    expect(h.view().phase).toBe('armed')
  })

  it("keeps the newer arm's input open when an arm Escape left lets go late", async () => {
    const opened = fakeInputs()
    const mic = new MicManager()
    await mic.setPreferredDevice('app-in')
    let input = 'usb-1'
    let worklets = 0
    let firstWorklet!: () => void
    const heard: MediaStream[] = []
    const h = harness({
      acquireMic: () => mic.acquireFrom('studio-record', input),
      // The first arm's worklet is slow; the next arm's is ready at once.
      prepareWorklet: vi.fn(() =>
        ++worklets === 1
          ? new Promise<void>((resolve) => (firstWorklet = resolve))
          : Promise.resolve(),
      ),
      createSource: (_context, stream) => {
        heard.push(stream)
        return { disconnect: vi.fn() } as unknown as AudioNode
      },
    })

    // R: its input opens while it waits for its worklet. Escape, then R
    // again on another input, before that wait ends.
    const first = h.recorder.arm('lane-1')
    await settle()
    h.recorder.disarm()
    input = 'usb-2'
    const second = h.recorder.arm('lane-1')
    firstWorklet()
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    await settle()

    const track = heard.at(-1)!.getAudioTracks()[0] as unknown as {
      stop: Mock
      getSettings(): MediaTrackSettings
    }
    expect(track.getSettings().deviceId).toBe('usb-2')
    expect(track.stop).not.toHaveBeenCalled()
    expect(mic.getScopedHold()?.stream).toBe(heard.at(-1))
    expect(opened).toEqual(['usb-1', 'usb-2'])
    expect(h.view().phase).toBe('armed')
  })
})

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
    expect(h.releaseMic).not.toHaveBeenCalled()
  })

  it('gives the microphone back when the clock does not start', async () => {
    const h = harness({ unlock: vi.fn(async () => false) })

    expect(await h.recorder.arm(null)).toBe(false)

    expect(h.view().phase).toBe('idle')
    expect(h.view().error).toMatch(/audio didn't start/)
    expect(h.releaseMic).toHaveBeenCalledOnce()
  })

  it('lets go of an arm disarmed before it finished opening', async () => {
    const h = harness()
    const arming = h.recorder.arm(null)

    h.recorder.disarm()

    expect(await arming).toBe(false)
    expect(h.view()).toMatchObject({ phase: 'idle', error: null })
    expect(h.releaseMic).toHaveBeenCalledOnce()
    expect(h.deps.openCapture).not.toHaveBeenCalled()
  })

  it('moves the arm to the lane pressed while the microphone opens, metering that lane', async () => {
    const h = harness({
      monitorLevel: (trackId) => ({
        on: true,
        gain: trackId === 'lane-2' ? 0.5 : 1,
        pan: 0,
      }),
    })
    const arming = h.recorder.arm('lane-1')

    h.recorder.retarget('lane-2')

    expect(h.view()).toMatchObject({ phase: 'arming', targetTrackId: 'lane-2' })
    expect(await arming).toBe(true)
    expect(h.view()).toMatchObject({ phase: 'armed', targetTrackId: 'lane-2' })
    expect(h.monitor.set).toHaveBeenLastCalledWith({
      on: true,
      gain: 0.5,
      pan: 0,
    })
  })

  it('closes the capture and gives the microphone back on disarm', async () => {
    const h = harness()
    await h.recorder.arm(null)

    h.recorder.disarm()

    expect(h.capture.dispose).toHaveBeenCalled()
    expect(h.monitor.dispose).toHaveBeenCalled()
    expect(h.releaseMic).toHaveBeenCalledOnce()
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
    expect(h.transport.play).toHaveBeenCalledWith(3.1, 96000)
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
    expect(h.transport.play).toHaveBeenCalledWith(1.1, 96000)
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
      title: 'Take 1',
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
    expect(h.releaseMic).not.toHaveBeenCalled()
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
    expect(h.view()).toMatchObject({ phase: 'armed', live: null, notice: null })
    expect(h.releaseMemory).toHaveBeenCalled()
    await settle()
    expect(h.journal.discard).toHaveBeenCalledWith('take-1')
  })

  it('stays armed on its lane after a take, the microphone open, so the next Record starts the next take', async () => {
    const h = await recording()
    const first = h.capture
    h.chunk(0, 4096)
    h.recorder.stop()

    h.worklet.stopped(4096, 'stopped')
    await settle()

    expect(h.view()).toMatchObject({
      phase: 'armed',
      targetTrackId: 'lane-1',
      level: 0,
    })
    expect(h.releaseMic).not.toHaveBeenCalled()
    expect(h.monitor.dispose).not.toHaveBeenCalled()
    // A capture takes one start: the armed lane listens through a fresh one.
    expect(first.dispose).toHaveBeenCalled()
    expect(h.captures).toHaveLength(2)
    h.worklet.level(0.3, 1536)
    expect(h.view().level).toBe(0.3)

    expect(h.recorder.record()).toBe(true)
    expect(h.capture.start).toHaveBeenCalledOnce()
    expect(h.view().phase).toBe('recording')
  })

  it('disarms after a take when the clock stopped before it was kept', async () => {
    const h = await recording()
    h.chunk(0, 4096)
    h.recorder.stop()
    h.ctx.state = 'suspended'

    h.worklet.stopped(4096, 'stopped')
    await settle()

    expect(h.kept).toHaveLength(1)
    expect(h.view()).toMatchObject({ phase: 'idle', targetTrackId: null })
    expect(h.releaseMic).toHaveBeenCalledOnce()
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
    h.chunk(0, 4096)
    h.chunk(4096, 4096)

    h.recorder.micLost()

    expect(h.capture.stop).toHaveBeenCalledWith(null, 'input-lost')
    h.worklet.stopped(8192, 'input-lost')
    await settle()
    expect(h.kept[0].samples).toHaveLength(8192)
    expect(h.view()).toMatchObject({
      phase: 'idle',
      notice: MIC_LOST_MID_TAKE,
    })
    expect(h.releaseMic).toHaveBeenCalledOnce()
  })

  it('keeps a take the worklet ended on its own, naming why', async () => {
    const h = await recording()
    h.chunk(0, 4096)

    h.worklet.stopped(4096, 'limit')
    await settle()

    expect(h.kept).toHaveLength(1)
    expect(h.view().notice).toMatch(/five minutes/)
    expect(h.transport.pause).toHaveBeenCalled()
  })

  it('says nothing was recorded when a take ends before the song reaches it', async () => {
    // Audio stopped in the count-in: the capture holds only the count-in.
    const counting = harness()
    await counting.recorder.arm('lane-1')
    counting.recorder.record()
    counting.worklet.started(1.1 * RATE)
    counting.chunk(0, 4096)
    counting.worklet.stopped(4096, 'interrupted')
    await settle()
    await settle()

    expect(counting.deps.keep).not.toHaveBeenCalled()
    expect(counting.view()).toMatchObject({
      phase: 'idle',
      notice:
        'Audio stopped for a moment before the take began, so nothing was recorded. Press Record to try again.',
    })
    expect(counting.journal.discard).toHaveBeenCalledWith('take-1')

    // The microphone gone inside the round trip the take's start drops.
    const early = await recording()
    early.chunk(0, 2048)
    early.recorder.micLost()
    early.worklet.stopped(2048, 'input-lost')
    await settle()

    expect(early.deps.keep).not.toHaveBeenCalled()
    expect(early.view().notice).toBe(MIC_LOST_BEFORE_TAKE)
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
    expect(h.view().phase).toBe('armed')
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
    expect(h.releaseMic).toHaveBeenCalledOnce()
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
    expect(h.releaseMic).toHaveBeenCalledOnce()
  })

  it('drops a count-in and disarms when the clock stops', async () => {
    const h = harness()
    await h.recorder.arm(null)
    h.recorder.record()

    h.recorder.clockStopped()

    expect(h.view().phase).toBe('idle')
    expect(h.deps.keep).not.toHaveBeenCalled()
    expect(h.releaseMic).toHaveBeenCalledOnce()
  })
})

describe('punch and loop takes', () => {
  const RANGE = { startFrame: 480000, endFrame: 576000 }

  it('starts a punch a bar before its range, stops the capture at the out point, and keeps the range', async () => {
    const h = harness(
      { takeCut: () => ({ mode: 'punch', range: RANGE }) },
      {
        countInBars: 0,
      },
    )
    // The song plays on when Record is pressed: a punch starts it over.
    h.transport.playing.mockReturnValue(true)
    h.transport.anchor.mockReturnValue({ frame: 1000, time: 0.5 })
    await h.recorder.arm('lane-1')
    h.transport.anchor.mockReturnValue(null)

    h.recorder.record()
    expect(h.transport.pause).toHaveBeenCalled()
    // One bar at 120 bpm before the in point; no count-in: heard at 1.1 s.
    expect(h.transport.play).toHaveBeenCalledWith(1.1, 480000 - 96000)
    expect(h.view().live).toMatchObject({
      fromFrame: 480000,
      cut: { mode: 'punch' },
    })
    // The song starts where it was asked to.
    h.transport.anchor.mockReturnValue({ frame: 384000, time: 1.1 })
    await settle()
    // The out point leaves the graph 4 s after 1.1 s; the capture runs on for the round trip.
    expect(h.capture.stop).toHaveBeenCalledWith(
      Math.round((1.1 + 4 + 0.05) * RATE),
      'out-point',
    )

    // Through the out point and the round trip after it: 200704 frames.
    h.worklet.started(52800)
    for (let chunk = 0; chunk < 49; chunk++) h.chunk(chunk * 4096, 4096)
    await h.worklet.stopped(49 * 4096, 'out-point')
    await settle()
    expect(h.kept).toHaveLength(1)
    expect(h.kept[0].cut).toEqual({ mode: 'punch', range: RANGE })
    // The lane stays armed for the next pass at the range.
    expect(h.view()).toMatchObject({ phase: 'armed', notice: null })
  })

  it('says a punch stopped in its pre-roll kept nothing', async () => {
    const h = harness({ takeCut: () => ({ mode: 'punch', range: RANGE }) })
    await h.recorder.arm('lane-1')
    h.recorder.record()
    h.transport.anchor.mockReturnValue({ frame: 288000, time: 1.1 })
    await settle()
    h.worklet.started(52800)
    h.chunk(0, 4096)
    await h.worklet.stopped(4096, 'stopped')
    await settle()
    expect(h.kept).toHaveLength(0)
    expect(h.view().notice).toBe(
      'Stopped before the range began, so nothing was recorded.',
    )
  })

  it('says a punch stopped too soon into its range kept nothing, rather than nothing at all', async () => {
    const h = harness({ takeCut: () => ({ mode: 'punch', range: RANGE }) })
    await h.recorder.arm('lane-1')
    h.recorder.record()
    // A bar of pre-roll from 384000, heard at 1.1 s: the first sample lands on 381600.
    h.transport.anchor.mockReturnValue({ frame: 384000, time: 1.1 })
    await settle()
    h.worklet.started(52800)
    // Stop 0.04 s into the range, short of the tenth of a second a punch keeps.
    for (let chunk = 0; chunk < 24; chunk++) h.chunk(chunk * 4096, 4096)
    h.chunk(24 * 4096, 2016)
    await h.worklet.stopped(98400 + 1920, 'stopped')
    await settle()
    expect(h.kept).toHaveLength(0)
    expect(h.journal.discard).toHaveBeenCalled()
    expect(h.view()).toMatchObject({
      phase: 'armed',
      notice:
        'Stopped just after the range began, so the take was too short to keep.',
    })
  })

  it('says a loop stopped before its first pass held a second kept nothing', async () => {
    const h = harness({ takeCut: () => ({ mode: 'loop', range: RANGE }) })
    await h.recorder.arm('lane-1')
    h.recorder.record()
    // A bar of count-in, the range from 3.1 s: the first sample lands on 381600.
    h.transport.anchor.mockReturnValue({ frame: 480000, time: 3.1 })
    await settle()
    h.worklet.started(52800)
    // Half a second into the two-second range.
    for (let chunk = 0; chunk < 29; chunk++) h.chunk(chunk * 4096, 4096)
    h.chunk(29 * 4096, 3616)
    await h.worklet.stopped(98400 + 24000, 'stopped')
    await settle()
    expect(h.kept).toHaveLength(0)
    expect(h.view().notice).toBe(
      'Stopped just after the range began, so the take was too short to keep.',
    )
  })

  it('loops from the range start after the count-in, ticking each pass, and stops just after the last pass a clip keeps', async () => {
    vi.useFakeTimers()
    const h = harness(
      { takeCut: () => ({ mode: 'loop', range: RANGE }) },
      { click: true },
    )
    await h.recorder.arm('lane-1')
    h.recorder.record()
    // A bar of count-in before the range, then the song from its start.
    expect(h.transport.play).toHaveBeenCalledWith(3.1, 480000)
    h.transport.anchor.mockReturnValue({ frame: 480000, time: 3.1 })
    await vi.advanceTimersByTimeAsync(0)
    h.ctx.currentTime = 4.5
    await vi.advanceTimersByTimeAsync(250)
    // A hundredth of a second past the last pass, so it is whole however the frames round.
    const passes = 32 * 96000 + 480
    expect(h.capture.stop).toHaveBeenCalledWith(
      Math.round((3.1 + passes / RATE + 0.05) * RATE),
      'last-pass',
    )
    // The click ticks the range's first beat again on the next pass.
    const ticked = h.clicks.schedule.mock.calls
      .flatMap((call) => call[0] as { time: number }[])
      .map((tick) => +tick.time.toFixed(6))
    expect(ticked).toContain(5.1)
    expect(h.view().live?.cut).toEqual({ mode: 'loop', range: RANGE })
    h.recorder.dispose()
  })

  it('journals what a take keeps, so a closed tab keeps a punch or a loop as recorded', async () => {
    const h = harness({ takeCut: () => ({ mode: 'loop', range: RANGE }) })
    await h.recorder.arm('lane-1')
    h.recorder.record()
    await settle()
    expect(h.journal.begin).toHaveBeenCalledWith(
      expect.objectContaining({ cut: { mode: 'loop', range: RANGE } }),
    )
    h.recorder.dispose()
  })
})
