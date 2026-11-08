// Channel meters tests — each input gets an analyser fed from its own channel, each aligned pair a mono mix at half each, readings come in order with a peak and a health of their own, the stop takes every node off the tap again, and a capture of one channel is tapped as it is.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChannelTap } from './channel-meters'
import { meterChannels, tapCapture } from './channel-meters'

interface FakeNode {
  readonly name: string
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  channelCount?: number
  channelCountMode?: ChannelCountMode
  channelInterpretation?: ChannelInterpretation
  gain?: { value: number }
  fftSize?: number
  smoothingTimeConstant?: number
  getFloatTimeDomainData?: (block: Float32Array) => void
}

/** A context whose analysers each read a steady level, the next one each time one is made. */
function fakeContext(levels: number[] = []) {
  const nodes: FakeNode[] = []
  const make = (name: string): FakeNode => {
    const node: FakeNode = { name, connect: vi.fn(), disconnect: vi.fn() }
    nodes.push(node)
    return node
  }
  let analysers = 0
  const context = {
    destination: make('destination'),
    createGain: () => ({ ...make('gain'), gain: { value: 1 } }),
    createAnalyser: () => {
      const level = levels[analysers++] ?? 0
      return {
        ...make('analyser'),
        fftSize: 2048,
        getFloatTimeDomainData: (block: Float32Array) => block.fill(level),
      }
    },
    createChannelSplitter: () => make('splitter'),
  }
  return { context: context as unknown as BaseAudioContext, nodes }
}

function fakeTap(context: BaseAudioContext) {
  const sent: [number, unknown][] = []
  const tap: ChannelTap = {
    context,
    send: vi.fn((channel: number, target: AudioNode) => {
      sent.push([channel, target])
    }),
    unsend: vi.fn(),
  }
  return { tap, sent }
}

afterEach(() => vi.useRealTimers())

describe('meterChannels', () => {
  it('feeds each input its own channel, and each pair a mono mix of both at half each', () => {
    const { context } = fakeContext()
    const { tap, sent } = fakeTap(context)

    const stop = meterChannels(
      tap,
      [
        { channel: 1, pair: false },
        { channel: 0, pair: true },
      ],
      vi.fn(),
    )
    stop()

    const [single, mix, mixAgain] = sent
    expect(single[0]).toBe(1)
    expect((single[1] as FakeNode).name).toBe('analyser')
    expect([mix[0], mixAgain[0]]).toEqual([0, 1])
    expect(mix[1]).toBe(mixAgain[1])
    expect(mix[1]).toMatchObject({
      name: 'gain',
      gain: { value: 0.5 },
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    })
  })

  it('reads each row in order, its peak and how it reads, on a timer', () => {
    vi.useFakeTimers()
    const { context } = fakeContext([0.5, 0.99, 0.85, 0.02, 0])
    const { tap } = fakeTap(context)
    const onRead = vi.fn()

    meterChannels(
      tap,
      [0, 1, 2, 3, 4].map((channel) => ({ channel, pair: false })),
      onRead,
      50,
    )
    vi.advanceTimersByTime(50)

    // From silence: a note already sounding as the meter opens is no noise.
    expect(onRead).toHaveBeenCalledExactlyOnceWith([
      { peak: 0.5, health: 'good' },
      { peak: expect.closeTo(0.99, 6), health: 'clipping' },
      { peak: expect.closeTo(0.85, 6), health: 'hot' },
      { peak: expect.closeTo(0.02, 6), health: 'quiet' },
      { peak: 0, health: 'silent' },
    ])
  })

  it('takes every node it added off the tap again, and stops reading', () => {
    vi.useFakeTimers()
    const { context, nodes } = fakeContext()
    const { tap, sent } = fakeTap(context)
    const onRead = vi.fn()
    const stop = meterChannels(
      tap,
      [
        { channel: 0, pair: false },
        { channel: 2, pair: true },
      ],
      onRead,
    )

    stop()
    vi.advanceTimersByTime(500)

    expect(vi.mocked(tap.unsend).mock.calls).toEqual(sent)
    for (const node of nodes.filter((each) => each.name !== 'destination'))
      expect(node.disconnect).toHaveBeenCalled()
    expect(onRead).not.toHaveBeenCalled()
  })
})

describe('tapCapture', () => {
  it('taps a capture of one channel as it is, with nothing split', () => {
    const { context, nodes } = fakeContext()
    const source = { connect: vi.fn(), disconnect: vi.fn() }
    const target = {} as AudioNode

    const { tap, close } = tapCapture(
      context,
      source as unknown as AudioNode,
      1,
    )
    tap.send(0, target)
    tap.unsend(0, target)
    close()

    expect(nodes.some((node) => node.name === 'splitter')).toBe(false)
    expect(source.connect).toHaveBeenCalledExactlyOnceWith(target)
    expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(target)
  })

  it('splits a wider capture, feeds it, and takes the split off again', () => {
    const { context, nodes } = fakeContext()
    const source = { connect: vi.fn(), disconnect: vi.fn() }
    const target = {} as AudioNode

    const { tap, close } = tapCapture(
      context,
      source as unknown as AudioNode,
      2,
    )
    tap.send(1, target)
    close()

    const splitter = nodes.find((node) => node.name === 'splitter')!
    expect(source.connect).toHaveBeenCalledExactlyOnceWith(splitter)
    expect(splitter.connect).toHaveBeenCalledExactlyOnceWith(target, 1, 0)
    expect(source.disconnect).toHaveBeenCalledExactlyOnceWith(splitter)
  })
})
