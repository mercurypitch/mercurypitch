// Studio recorder, one channel — a lane set to one channel of its input records and monitors that channel alone, from one mono node, through every take of the arm; a channel the input lacks, or does not report, records all of it, mixed, and says so; the split goes with the arm.
import { describe, expect, it, vi } from 'vitest'
import type { FakeGraphNode } from './studio-recorder.test-fixtures'
import { harness, settle } from './studio-recorder.test-fixtures'

/** An input whose track reports `channelCount` (undefined: it does not say), held for a lane asking for `channel`. */
function inputHold(channelCount: number | undefined, channel: number | null) {
  const track = { getSettings: () => ({ channelCount }) }
  return {
    stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
    channel,
    release: vi.fn(),
  }
}

/** The edges a node was connected along, as `[to, output, input]`. */
const edges = (node: FakeGraphNode) =>
  node.edges.map(([to, output, input]) => [to.name, output, input])

describe("a lane's one channel", () => {
  it('asks for the input of the lane being armed', async () => {
    const h = harness()

    await h.recorder.arm('lane-2')

    expect(h.deps.acquireMic).toHaveBeenCalledWith('lane-2')
  })

  it('records and monitors that channel alone: the take and the monitor hear the same mono node', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, 1)),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    const [splitter] = h.splitters
    const [mono] = h.gains
    expect(h.ctx.createChannelSplitter).toHaveBeenCalledExactlyOnceWith(2)
    expect(edges(h.source)).toEqual([['splitter:2', undefined, undefined]])
    expect(edges(splitter)).toEqual([['gain', 1, 0]])
    expect(mono).toMatchObject({
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    })
    expect(h.captureInputs).toEqual([mono])
    expect(h.monitorInputs).toEqual([mono])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        channels: 2,
        channel: 1,
        missingChannel: null,
      }),
    )
  })

  it('listens on the same channel after a count-in is cancelled, ready for the next take', async () => {
    const h = harness({ acquireMic: vi.fn(async () => inputHold(2, 1)) })
    await h.recorder.arm('lane-1')
    const [mono] = h.gains
    h.recorder.record()

    h.recorder.stop()
    await settle()

    expect(h.view().phase).toBe('armed')
    expect(h.captureInputs).toEqual([mono, mono])
  })

  it('records all of the input, mixed, when it has no such channel, and says so', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(1, 1)),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    expect(h.ctx.createChannelSplitter).not.toHaveBeenCalled()
    expect(h.captureInputs).toEqual([h.source])
    expect(h.monitorInputs).toEqual([h.source])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        channels: 1,
        channel: null,
        missingChannel: 1,
      }),
    )
  })

  it('records all of the input, mixed, when its track does not say how many channels it has', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(undefined, 0)),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    expect(h.captureInputs).toEqual([h.source])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        channels: null,
        channel: null,
        missingChannel: 0,
      }),
    )
  })

  it('records the whole source, as before, for a lane on all its inputs', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, null)),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    expect(h.ctx.createChannelSplitter).not.toHaveBeenCalled()
    expect(h.captureInputs).toEqual([h.source])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        channels: 2,
        channel: null,
        missingChannel: null,
      }),
    )
  })

  it('takes the split apart with the arm, its own edge from the source first', async () => {
    const h = harness({ acquireMic: vi.fn(async () => inputHold(2, 0)) })
    await h.recorder.arm('lane-1')
    const [splitter] = h.splitters

    h.recorder.disarm()

    expect(h.source.disconnect).toHaveBeenCalledWith(splitter)
    expect(splitter.disconnect).toHaveBeenCalledOnce()
    expect(h.source.disconnect).toHaveBeenLastCalledWith()
    expect(h.capture.dispose).toHaveBeenCalledOnce()
  })
})
