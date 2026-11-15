// Studio recorder, each lane's monitor — every armed lane hears its own input through a monitor of its own, through the lane's chain: one channel of an input alone and never the whole input beside it, lanes armed on one input each once, a lane on a whole input once, and a MIDI lane its instrument's node alone.
import { describe, expect, it, vi } from 'vitest'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import { createManualScheduler, FakeAudioContext, FakeGain, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createStudioInputMonitor } from './input-monitor'
import type { StudioInstrumentHold, StudioRecorderDeps, } from './studio-recorder'
import type { FakeGraphNode } from './studio-recorder.test-fixtures'
import { fakeGraphNode, harness, laneSound, } from './studio-recorder.test-fixtures'

/** The recorder with the real monitor on a graph of fakes, every lane heard. */
function monitored(over: Partial<StudioRecorderDeps> = {}) {
  const graph = new FakeAudioContext()
  const scheduler = createManualScheduler()
  const h = harness({
    createMonitor: (_context, input) =>
      createStudioInputMonitor(graph.asContext, input, {
        schedule: scheduler.schedule,
      }),
    monitorSound: () => laneSound(true),
    ...over,
  })
  return { h, graph, scheduler }
}

/** One input of `channels` channels, held for each lane asking with its own pick. */
function oneInput(
  channels: number | undefined,
  picks: Record<string, ChannelPick | null> = {},
) {
  const track = { getSettings: () => ({ channelCount: channels }) }
  const stream = { getAudioTracks: () => [track] } as unknown as MediaStream
  return vi.fn(async (trackId: string | null) => ({
    stream,
    pick: picks[trackId ?? ''] ?? null,
    release: vi.fn(),
  }))
}

/** The monitor folds `node` feeds: the monitor's own gains, on its graph. */
const foldsOf = (node: FakeGraphNode) =>
  node.edges.map(([to]) => to as unknown).filter((to) => to instanceof FakeGain)

/** Each heard monitor's level: the gains feeding the speakers. */
const levelsOf = (graph: FakeAudioContext) =>
  graph
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(graph.destination))

describe("each armed lane's monitor", () => {
  it('hears each lane on one input through its own channel and a path of its own, and the whole input through none', async () => {
    const { h, graph } = monitored({
      acquireMic: oneInput(2, {
        'lane-1': { channel: 0, pair: false },
        'lane-2': { channel: 1, pair: false },
      }),
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
      }),
    })

    await h.recorder.arm('lane-1')
    await h.recorder.arm('lane-2')

    // Each lane takes a node of its own off the split, and folds it once.
    expect(h.gains).toHaveLength(2)
    for (const node of h.gains) expect(foldsOf(node)).toHaveLength(1)
    expect(levelsOf(graph)).toHaveLength(2)
  })

  it('hears a lane on a whole input once, folded as its take is', async () => {
    const { h, graph } = monitored({ acquireMic: oneInput(undefined) })

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
