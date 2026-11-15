// Studio recorder, each lane's monitor — every armed lane hears its own input through a monitor of its own, through the lane's chain: one channel of an input alone and never the whole input beside it, lanes armed on one input each once, a lane on a whole input once, and a MIDI lane its instrument's node alone; a lane disarmed while it is heard keeps its input until its monitor has glided out, and that late close ends only its own pick and hold; an instrument goes at once.
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

/** The recorder with the real monitor on a graph of fakes, every lane sounding as `sound` says. */
function monitored(
  over: Partial<StudioRecorderDeps> = {},
  sound: StudioMonitorSound = laneSound(true),
) {
  const graph = new FakeAudioContext()
  const scheduler = createManualScheduler()
  const h = harness({
    createMonitor: (_context, input) =>
      createStudioInputMonitor(graph.asContext, input, {
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

describe('a lane disarmed while its monitor is heard', () => {
  afterEach(() => releaseMicLock())

  it('keeps its input and its hold until the monitor has glided out, then lets them go, and shows the input gone', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')

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

  it('takes only its own channel off the split once its monitor has glided out, and the lane beside it plays on', async () => {
    // Arrange
    const input = oneInput(2, {
      'lane-1': { channel: 0, pair: false },
      'lane-2': { channel: 1, pair: false },
    })
    const { h, graph, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')
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

  it('still lets its input go once the Studio closes inside the glide', async () => {
    // Arrange
    const input = oneInput(undefined)
    const { h, scheduler } = monitored({ acquireMic: input.acquireMic })
    await h.recorder.arm('lane-1')

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
