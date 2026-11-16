// Studio recorder, each lane's monitor — every armed lane hears its own input through a monitor of its own, through the lane's chain: one channel of an input alone and never the whole input beside it, lanes armed on one input each once, a lane on a whole input once, and a MIDI lane its instrument's node alone; a lane's monitor rises a quarter of a second after its own capture first meters a sound, an instrument's at once; a lane disarmed while it is heard keeps its input until its monitor has glided out, and that late close ends only its own pick and hold, while one disarmed before its monitor rose lets its input go at once; an instrument goes at once.
import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { releaseMicLock } from '@/lib/mic-lock'
import { MicManager } from '@/lib/mic-manager'
import { createManualScheduler, FakeAudioContext, FakeGain, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioMonitorSound } from './input-monitor'
import { createStudioInputMonitor } from './input-monitor'
import type { StudioInstrumentHold, StudioMicHold, StudioRecorderDeps, } from './studio-recorder'
import type { FakeGraphNode } from './studio-recorder.test-fixtures'
import { fakeGraphNode, harness, laneSound, settle, } from './studio-recorder.test-fixtures'

/** The house release and its slack, in ms: when a released monitor path comes apart. */
const RELEASED_MS = 240
/** How long a lane's input sounds before its monitor rises, in ms. */
const SETTLE_MS = 250

/** The recorder with the real monitor on a graph of fakes, every lane sounding as `sound` says. */
function monitored(
  over: Partial<StudioRecorderDeps> = {},
  sound: StudioMonitorSound = laneSound(true),
) {
  const graph = new FakeAudioContext()
  const scheduler = createManualScheduler()
  const h = harness({
    createMonitor: (_context, input, options) =>
      createStudioInputMonitor(graph.asContext, input, {
        ...options,
        schedule: scheduler.schedule,
      }),
    monitorSound: () => sound,
    ...over,
  })
  return { h, graph, scheduler }
}

/** One input of `channels` channels (undefined: it does not say), handed to every lane on it with the lane's own pick and release. */
function oneInput(
  channels: number | undefined,
  picks: Record<string, ChannelPick | null> = {},
) {
  const track = {
    getSettings: () => ({ channelCount: channels }),
    readyState: 'live',
  }
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream
  const releases: Mock<() => void>[] = []
  const acquireMic = vi.fn(
    async (trackId: string | null): Promise<StudioMicHold> => {
      const release = vi.fn<() => void>()
      releases.push(release)
      return { stream, pick: picks[trackId ?? ''] ?? null, release }
    },
  )
  return { stream, acquireMic, releases }
}

/** The monitor folds `node` feeds: the monitor's own gains, on its graph. */
const foldsOf = (node: FakeGraphNode) =>
  node.edges.map(([to]) => to as unknown).filter((to) => to instanceof FakeGain)

/** Each heard monitor's level: the gains feeding the speakers. */
const levelsOf = (graph: FakeAudioContext) =>
  graph
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(graph.destination))

/** Whether `node` was taken apart whole, as an input's last lane leaves it. */
const disconnectedWhole = (node: FakeGraphNode) =>
  node.disconnect.mock.calls.some((call) => call.length === 0)

/** Every armed lane's input sounds, each capture metering a first level, and settles: each monitor rises. */
function hear(
  h: ReturnType<typeof harness>,
  scheduler: ReturnType<typeof createManualScheduler>,
): void {
  for (const worklet of h.worklets) worklet.level(0.3, 1536)
  scheduler.advance(SETTLE_MS)
}

describe("each armed lane's monitor", () => {
  it('hears each lane on one input through its own channel and a path of its own, and the whole input through none', async () => {
    const { h, graph } = monitored({
      acquireMic: oneInput(2, {
        'lane-1': { channel: 0, pair: false },
        'lane-2': { channel: 1, pair: false },
      }).acquireMic,
    })

    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')

    const [left, right] = h.gains
    expect(h.source.edges.map(([to]) => to.name)).toEqual(['splitter:2'])
    expect(foldsOf(left)).toHaveLength(1)
    expect(foldsOf(right)).toHaveLength(1)
    expect(foldsOf(left)[0]).not.toBe(foldsOf(right)[0])
    expect(levelsOf(graph)).toHaveLength(2)
  })

  it('hears two lanes on one channel each once, through two paths', async () => {
    const { h, graph } = monitored({
      acquireMic: oneInput(2, {
        'lane-1': { channel: 1, pair: false },
        'lane-2': { channel: 1, pair: false },
      }).acquireMic,
    })

    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')

    // Each lane takes a node of its own off the split, and folds it once.
    expect(h.gains).toHaveLength(2)
    for (const node of h.gains) expect(foldsOf(node)).toHaveLength(1)
    expect(levelsOf(graph)).toHaveLength(2)
  })

  it('hears a lane on a whole input once, folded as its take is', async () => {
    const { h, graph } = monitored({
      acquireMic: oneInput(undefined).acquireMic,
    })

    await h.recorder.arm('lane-1')

    const [fold] = foldsOf(h.source) as FakeGain[]
    expect(foldsOf(h.source)).toHaveLength(1)
    expect(fold).toMatchObject({
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    expect(levelsOf(graph)).toHaveLength(1)
  })

  it("hears a MIDI lane's instrument through its node alone, once", async () => {
    const node = fakeGraphNode('instrument')
    const hold: StudioInstrumentHold = {
      kind: 'instrument',
      play: () => node as unknown as AudioNode,
      connected: () => true,
      release: vi.fn(),
    }
    const { h, graph } = monitored({
      acquireInstrument: (trackId) =>
        trackId === 'keys' ? Promise.resolve(hold) : null,
    })

    await h.recorder.arm('keys')

    expect(h.deps.acquireMic).not.toHaveBeenCalled()
    expect(node.edges).toHaveLength(1)
    expect(foldsOf(node)).toHaveLength(1)
    expect(levelsOf(graph)).toHaveLength(1)
  })
})

describe("a lane's monitor rising", () => {
  it('stays silent until its input has sounded a quarter of a second, then rises from silence', async () => {
    // Arrange
    const { h, graph, scheduler } = monitored()
    await h.recorder.arm('lane-1')
    const [level] = levelsOf(graph)

    // Act
    h.worklet.level(0, 1536)
    scheduler.advance(SETTLE_MS)
    const beforeSound = level.gain.destination
    h.worklet.level(0.3, 3584)
    scheduler.advance(SETTLE_MS - 1)
    const settling = level.gain.destination
    scheduler.advance(1)

    // Assert
    expect(beforeSound).toBe(0)
    expect(settling).toBe(0)
    expect(level.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
  })

  it("rises on its own capture's sound alone: a lane beside it on another input waits for its own", async () => {
    // Arrange
    const inputs = [oneInput(undefined), oneInput(undefined)]
    const sources: FakeGraphNode[] = []
    const { h, graph, scheduler } = monitored({
      acquireMic: (trackId) =>
        inputs[trackId === 'lane-1' ? 0 : 1].acquireMic(trackId),
      createSource: () => {
        sources.push(fakeGraphNode('source'))
        return sources.at(-1) as unknown as AudioNode
      },
    })
    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')
    const [first, second] = levelsOf(graph)

    // Act
    h.worklets[1].level(0.3, 1536)
    scheduler.advance(SETTLE_MS)

    // Assert
    expect(second.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
    expect(first.gain.destination).toBe(0)
  })

  it("rises a MIDI lane's monitor at once: an instrument plays cleanly from its first note", async () => {
    // Arrange
    const hold: StudioInstrumentHold = {
      kind: 'instrument',
      play: () => fakeGraphNode('instrument') as unknown as AudioNode,
      connected: () => true,
      release: vi.fn(),
    }
    const { h, graph, scheduler } = monitored({
      acquireInstrument: () => Promise.resolve(hold),
    })

    // Act
    await h.recorder.arm('keys')

    // Assert
    expect(levelsOf(graph)[0].gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
    expect(scheduler.pendingCount).toBe(0)
  })

  it("rises at once for a lane that joins an input another lane's monitor heard settle: it is flowing, with no onset left", async () => {
    // Arrange
    const input = oneInput(2, {
      'lane-1': { channel: 0, pair: false },
      'lane-2': { channel: 1, pair: false },
    })
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)

    // Act
    await h.recorder.arm('lane-2')

    // Assert
    const [, joined] = levelsOf(graph)
    expect(joined.gain.lastWrite).toMatchObject({
      kind: 'target',
      value: 1,
      timeConstant: 0.036,
    })
    expect(scheduler.pendingCount).toBe(0)
  })

  it('waits out its own settle when it joins an input still in its first moments', async () => {
    // Arrange
    const input = oneInput(2, {
      'lane-1': { channel: 0, pair: false },
      'lane-2': { channel: 1, pair: false },
    })
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    h.worklet.level(0.3, 1536)
    scheduler.advance(100)

    // Act
    await h.recorder.arm('lane-2')
    h.worklet.level(0.3, 6336)

    // Assert
    const [first, joined] = levelsOf(graph)
    expect(joined.gain.lastWrite).toBeUndefined()
    scheduler.advance(SETTLE_MS - 100)
    expect(first.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
    expect(joined.gain.lastWrite).toBeUndefined()
    scheduler.advance(100)
    expect(joined.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })

  it('waits out the settle again on an input opened afresh, once the lanes on the last one have all gone', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    h.recorder.disarm()
    scheduler.advance(RELEASED_MS)

    // Act
    await h.recorder.arm('lane-1')

    // Assert
    expect(input.releases[0]).toHaveBeenCalledOnce()
    const [again] = levelsOf(graph)
    expect(again.gain.lastWrite).toBeUndefined()
    h.worklet.level(0.3, 1536)
    scheduler.advance(SETTLE_MS)
    expect(again.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
  })
})

describe('a lane disarmed while its monitor is heard', () => {
  afterEach(() => releaseMicLock())

  it('keeps its input and its hold until the monitor has glided out, then lets them go, and shows the input gone', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)

    // Act
    h.recorder.disarm()

    // Assert
    expect(h.view().phase).toBe('idle')
    expect(h.capture.dispose).toHaveBeenCalled()
    scheduler.advance(RELEASED_MS - 1)
    expect(disconnectedWhole(h.source)).toBe(false)
    expect(input.releases[0]).not.toHaveBeenCalled()
    expect(h.view().capture).not.toBeNull()
    scheduler.advance(1)
    expect(disconnectedWhole(h.source)).toBe(true)
    expect(input.releases[0]).toHaveBeenCalledOnce()
    expect(h.view().capture).toBeNull()
  })

  it('lets them go at once when the monitor was not heard: monitoring off, or the lane muted', async () => {
    for (const sound of [laneSound(false), laneSound(true, 0)]) {
      // Arrange
      const input = oneInput(undefined)
      const { h } = monitored({ acquireMic: input.acquireMic }, sound)
      await h.recorder.arm('lane-1')

      // Act
      h.recorder.disarm()

      // Assert
      expect(disconnectedWhole(h.source)).toBe(true)
      expect(input.releases[0]).toHaveBeenCalledOnce()
      expect(h.view().capture).toBeNull()
    }
  })

  it('lets them go at once when the lane is disarmed before its monitor rose, in the settle or the wait for a first sound', async () => {
    for (const sounded of [true, false]) {
      // Arrange
      const input = oneInput(undefined)
      const { h, graph, scheduler } = monitored({
        acquireMic: input.acquireMic,
      })
      await h.recorder.arm('lane-1')
      if (sounded) h.worklet.level(0.3, 1536)
      scheduler.advance(SETTLE_MS - 1)

      // Act
      h.recorder.disarm()

      // Assert
      expect(disconnectedWhole(h.source)).toBe(true)
      expect(input.releases[0]).toHaveBeenCalledOnce()
      expect(levelsOf(graph)).toEqual([])
      expect(h.view()).toMatchObject({ phase: 'idle', capture: null })
      expect(scheduler.pendingCount).toBe(0)
    }
  })

  it('takes only its own channel off the split once its monitor has glided out, and the lane beside it plays on', async () => {
    // Arrange
    const input = oneInput(2, {
      'lane-1': { channel: 0, pair: false },
      'lane-2': { channel: 1, pair: false },
    })
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')
    hear(h, scheduler)
    const [splitter] = h.splitters
    const [left, right] = h.gains

    // Act
    h.recorder.disarm('lane-1')

    // Assert
    scheduler.advance(RELEASED_MS - 1)
    expect(splitter.disconnect).not.toHaveBeenCalled()
    expect(input.releases[0]).not.toHaveBeenCalled()
    scheduler.advance(1)
    expect(splitter.disconnect.mock.calls).toEqual([[left]])
    expect(input.releases[0]).toHaveBeenCalledOnce()
    expect(input.releases[1]).not.toHaveBeenCalled()
    expect(disconnectedWhole(h.source)).toBe(false)
    expect(foldsOf(right)).toHaveLength(1)
    expect(levelsOf(graph)).toHaveLength(1)
    expect(h.view().lanes?.map((lane) => lane.trackId)).toEqual(['lane-2'])
  })

  it("keeps a re-arm's own input and hold when the lane before it closes late, on the same input", async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    h.recorder.disarm()
    scheduler.advance(100)

    // Act
    expect(await h.recorder.arm('lane-1')).toBe(true)
    scheduler.advance(RELEASED_MS - 100)

    // Assert
    const [first, second] = foldsOf(h.source)
    expect(input.releases[0]).toHaveBeenCalledOnce()
    expect(input.releases[1]).not.toHaveBeenCalled()
    expect(disconnectedWhole(h.source)).toBe(false)
    expect(h.source.disconnect.mock.calls).toEqual([[first]])
    expect(second).toBeDefined()
    expect(h.view()).toMatchObject({ phase: 'armed', error: null })
    expect(h.view().capture).not.toBeNull()
  })

  it("keeps a re-arm's own input and hold when the lane before it closes late, on another input", async () => {
    // Arrange
    const before = oneInput(undefined)
    const after = oneInput(undefined)
    const sources: FakeGraphNode[] = []
    let acquireMic = before.acquireMic
    const { h, scheduler } = monitored({
      acquireMic: (trackId) => acquireMic(trackId),
      createSource: () => {
        sources.push(fakeGraphNode('source'))
        return sources.at(-1) as unknown as AudioNode
      },
    })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    h.recorder.disarm()
    scheduler.advance(100)

    // Act
    acquireMic = after.acquireMic
    expect(await h.recorder.arm('lane-1')).toBe(true)
    scheduler.advance(RELEASED_MS - 100)

    // Assert
    expect(disconnectedWhole(sources[0])).toBe(true)
    expect(before.releases[0]).toHaveBeenCalledOnce()
    expect(disconnectedWhole(sources[1])).toBe(false)
    expect(after.releases[0]).not.toHaveBeenCalled()
    expect(foldsOf(sources[1])).toHaveLength(1)
    expect(h.view()).toMatchObject({ phase: 'armed', error: null })
  })

  it('closes cleanly after every hold is let go inside the glide, as another tab or a hidden page asks, and the next arm opens its input as ever', async () => {
    // Arrange
    const stops: Mock[] = []
    ;(
      globalThis.navigator as unknown as { mediaDevices: unknown }
    ).mediaDevices = {
      getUserMedia: vi.fn(async () => {
        const track = {
          stop: vi.fn(),
          addEventListener: vi.fn(),
          getSettings: () => ({ deviceId: 'usb-1' }),
          readyState: 'live',
        }
        stops.push(track.stop)
        return { getTracks: () => [track], getAudioTracks: () => [track] }
      }),
    }
    const mic = new MicManager()
    await mic.setPreferredDevice('app-in')
    const { h, scheduler } = monitored({
      acquireMic: () => mic.acquireFrom('studio-record', 'usb-1'),
    })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    h.recorder.disarm()
    scheduler.advance(100)

    // Act
    await mic.forceReleaseAll()
    scheduler.advance(RELEASED_MS - 100)
    await settle()

    // Assert
    expect(stops[0]).toHaveBeenCalledOnce()
    expect(disconnectedWhole(h.source)).toBe(true)
    expect(mic.getScopedHold()).toBeNull()
    expect(await h.recorder.arm('lane-1')).toBe(true)
    await settle()
    expect(stops[1]).not.toHaveBeenCalled()
    expect(mic.getScopedHold()).not.toBeNull()
  })

  it('rises a re-arm inside the release at once on the input still flowing, while the lane before it glides out and closes late', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    const [first] = levelsOf(graph)
    h.recorder.disarm()
    scheduler.advance(100)

    // Act
    expect(await h.recorder.arm('lane-1')).toBe(true)
    const [, second] = levelsOf(graph)
    const atArm = second.gain.lastWrite
    scheduler.advance(RELEASED_MS - 100)

    // Assert
    expect(atArm).toMatchObject({ kind: 'target', value: 1 })
    expect(first.gain.lastWrite).toMatchObject({ kind: 'target', value: 0 })
    expect(input.releases[0]).toHaveBeenCalledOnce()
    expect(levelsOf(graph)).toEqual([second])
    expect(input.releases[1]).not.toHaveBeenCalled()
    expect(disconnectedWhole(h.source)).toBe(false)
    expect(scheduler.pendingCount).toBe(0)
  })

  it('rises a lane re-armed on another channel of its live input at once, its new channel off the same split', async () => {
    // Arrange: the lane's channel changes while it is heard.
    const picks: Record<string, ChannelPick> = {
      'lane-1': { channel: 0, pair: false },
    }
    const input = oneInput(2, picks)
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)
    h.recorder.disarm()
    picks['lane-1'] = { channel: 1, pair: false }

    // Act
    expect(await h.recorder.arm('lane-1')).toBe(true)

    // Assert
    const [splitter] = h.splitters
    const [, second] = levelsOf(graph)
    expect(h.splitters).toHaveLength(1)
    expect(splitter.edges.map(([, output]) => output)).toEqual([0, 1])
    expect(second.gain.lastWrite).toMatchObject({ kind: 'target', value: 1 })
    expect(scheduler.pendingCount).toBe(1)
  })

  it('still lets its input go once the Studio closes inside the glide', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    hear(h, scheduler)

    // Act
    h.recorder.disarm()
    h.recorder.dispose()
    scheduler.advance(RELEASED_MS)

    // Assert
    expect(disconnectedWhole(h.source)).toBe(true)
    expect(input.releases[0]).toHaveBeenCalledOnce()
  })

  it("lets a MIDI lane's instrument go at once, its port free for the next lane, while its monitor glides out", async () => {
    // Arrange
    const release = vi.fn()
    const hold: StudioInstrumentHold = {
      kind: 'instrument',
      play: () => fakeGraphNode('instrument') as unknown as AudioNode,
      connected: () => true,
      release,
    }
    const { h, graph, scheduler } = monitored({
      acquireInstrument: () => Promise.resolve(hold),
    })
    await h.recorder.arm('keys')
    const [level] = levelsOf(graph)

    // Act
    h.recorder.disarm()

    // Assert
    expect(release).toHaveBeenCalledOnce()
    expect(level.gain.lastWrite).toMatchObject({ kind: 'target', value: 0 })
    scheduler.advance(RELEASED_MS)
    expect(levelsOf(graph)).toEqual([])
    expect(release).toHaveBeenCalledOnce()
  })
})
