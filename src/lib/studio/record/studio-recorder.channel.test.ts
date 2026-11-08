// Studio recorder, a lane's channels — a lane records and monitors one input alone, or an aligned pair at half each, from one mono node, through every take of the arm; with no choice it takes both sides of a stereo input, input 1 of a wider one and one channel as it is; a pick the input lacks leaves it on that default and says so; an input that does not report its count goes as it is; the split goes with the arm.
import { describe, expect, it, vi } from 'vitest'
import type { ChannelPick } from '@/lib/audio-input/input-channels'
import type { FakeGraphNode } from './studio-recorder.test-fixtures'
import { fakeGraphNode, harness, settle } from './studio-recorder.test-fixtures'

/** An input whose track reports `channelCount` (undefined: it does not say), held for a lane asking for `pick`. */
function inputHold(channelCount: number | undefined, pick: ChannelPick | null) {
  const track = { getSettings: () => ({ channelCount }) }
  return {
    stream: { getAudioTracks: () => [track] } as unknown as MediaStream,
    pick,
    release: vi.fn(),
  }
}

/** The edges a node was connected along, as `[to, output, input]`. */
const edges = (node: FakeGraphNode) =>
  node.edges.map(([to, output, input]) => [to.name, output, input])

const single = (channel: number): ChannelPick => ({ channel, pair: false })
const pair = (channel: number): ChannelPick => ({ channel, pair: true })

describe("a lane's channels", () => {
  it('asks for the input of the lane being armed', async () => {
    const h = harness()

    await h.recorder.arm('lane-2')

    expect(h.deps.acquireMic).toHaveBeenCalledWith('lane-2')
  })

  it('records and monitors one input alone: the take and the monitor hear the same mono node', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, single(1))),
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
      gain: { value: 1 },
    })
    expect(h.captureInputs).toEqual([mono])
    expect(h.monitorInputs).toEqual([mono])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ channels: 2, pick: single(1), missing: null }),
    )
  })

  it('records an aligned pair as one mono node, the two at half each and the others left out', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(4, pair(2))),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    const [splitter] = h.splitters
    const [mono] = h.gains
    expect(edges(splitter)).toEqual([
      ['gain', 2, 0],
      ['gain', 3, 0],
    ])
    expect(mono.gain.value).toBe(0.5)
    expect(h.captureInputs).toEqual([mono])
    expect(h.monitorInputs).toEqual([mono])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ channels: 4, pick: pair(2), missing: null }),
    )
  })

  it.each([
    [2, pair(0), [0, 1], 0.5],
    [3, single(0), [0], 1],
    [4, single(0), [0], 1],
    [6, single(0), [0], 1],
    [8, single(0), [0], 1],
  ])(
    'takes by default, from %i channels, %o',
    async (count, taken, outputs, gain) => {
      const inputOpened = vi.fn()
      const h = harness({
        acquireMic: vi.fn(async () => inputHold(count, null)),
        inputOpened,
      })

      await h.recorder.arm('lane-1')

      const [splitter] = h.splitters
      const [mono] = h.gains
      expect(edges(splitter)).toEqual(
        outputs.map((output) => ['gain', output, 0]),
      )
      expect(mono.gain.value).toBe(gain)
      expect(h.captureInputs).toEqual([mono])
      expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          channels: count,
          pick: taken,
          missing: null,
        }),
      )
    },
  )

  it('records one channel as it is, with nothing split', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(1, null)),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    expect(h.ctx.createChannelSplitter).not.toHaveBeenCalled()
    expect(h.captureInputs).toEqual([h.source])
    expect(h.monitorInputs).toEqual([h.source])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ channels: 1, pick: single(0), missing: null }),
    )
  })

  it('listens on the same pick after a count-in is cancelled, ready for the next take', async () => {
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, single(1))),
    })
    await h.recorder.arm('lane-1')
    const [mono] = h.gains
    h.recorder.record()

    h.recorder.stop()
    await settle()

    expect(h.view().phase).toBe('armed')
    expect(h.captureInputs).toEqual([mono, mono])
  })

  it('records the default in place of an input or a pair the input does not have, and says so', async () => {
    const inputOpened = vi.fn()
    const mono = harness({
      acquireMic: vi.fn(async () => inputHold(1, single(1))),
      inputOpened,
    })
    await mono.recorder.arm('lane-1')
    const stereo = harness({
      acquireMic: vi.fn(async () => inputHold(2, pair(2))),
      inputOpened,
    })
    await stereo.recorder.arm('lane-1')

    expect(mono.captureInputs).toEqual([mono.source])
    expect(edges(stereo.splitters[0])).toEqual([
      ['gain', 0, 0],
      ['gain', 1, 0],
    ])
    expect(inputOpened.mock.calls.map(([opened]) => opened)).toEqual([
      expect.objectContaining({
        channels: 1,
        pick: single(0),
        missing: single(1),
      }),
      expect.objectContaining({ channels: 2, pick: pair(0), missing: pair(2) }),
    ])
  })

  it('records the input as it is when its track does not say how many channels it has, and says a pick was not taken', async () => {
    const inputOpened = vi.fn()
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(undefined, single(0))),
      inputOpened,
    })

    await h.recorder.arm('lane-1')

    expect(h.ctx.createChannelSplitter).not.toHaveBeenCalled()
    expect(h.captureInputs).toEqual([h.source])
    expect(inputOpened).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        channels: null,
        pick: null,
        missing: single(0),
      }),
    )
  })

  it('takes the split apart with the arm, its own edge from the source first', async () => {
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, single(0))),
    })
    await h.recorder.arm('lane-1')
    const [splitter] = h.splitters

    h.recorder.disarm()

    expect(h.source.disconnect).toHaveBeenCalledWith(splitter)
    expect(splitter.disconnect).toHaveBeenCalledOnce()
    expect(h.source.disconnect).toHaveBeenLastCalledWith()
    expect(h.capture.dispose).toHaveBeenCalledOnce()
  })

  it("offers meters the armed input on the arm's own split, and nothing while none is armed", async () => {
    const h = harness({
      acquireMic: vi.fn(async () => inputHold(2, single(1))),
    })
    expect(h.recorder.inputTap()).toBeNull()
    await h.recorder.arm('lane-1')
    const [splitter] = h.splitters
    const meter = fakeGraphNode('meter')

    const tap = h.recorder.inputTap()!
    tap.send(0, meter as unknown as AudioNode)

    expect(tap.channels).toBe(2)
    expect(edges(splitter)).toContainEqual(['meter', 0, 0])
    expect(h.ctx.createChannelSplitter).toHaveBeenCalledOnce()
    h.recorder.disarm()
    expect(h.recorder.inputTap()).toBeNull()
  })
})
