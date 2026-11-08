// Input channels tests — a split feeds nothing until it is opened, takes one channel alone or an aligned pair at half each, and takes away only its own edge; a channel or a pair is one the capture has; a capture nobody chose for takes both sides of a stereo input and the first channel of any other; the count falls back and clamps; the loudest channel is named only above the floor.

import { describe, expect, it, vi } from 'vitest'
import { captureChannelCount, channelPicks, defaultChannelPick, isAvailableChannel, isAvailablePick, loudestChannel, samePick, splitChannels, } from './input-channels'

class FakeNode {
  connect = vi.fn()
  disconnect = vi.fn()
}

class FakeGain extends FakeNode {
  channelCount = 2
  channelCountMode: ChannelCountMode = 'max'
  channelInterpretation: ChannelInterpretation = 'speakers'
  gain = { value: 1 }
}

/** A context that hands out nodes recording how they were wired. */
function fakeGraph() {
  const splitter = new FakeNode()
  const source = new FakeNode()
  const context = {
    createChannelSplitter: vi.fn((_count: number) => splitter),
    createGain: vi.fn(() => new FakeGain()),
  }
  return {
    context,
    splitter,
    source,
    split: (channelCount: number) =>
      splitChannels(
        context as unknown as BaseAudioContext,
        source as unknown as AudioNode,
        channelCount,
      ),
  }
}

describe('splitChannels', () => {
  it("splits into the capture's channels and feeds nothing until opened", () => {
    // Arrange
    const graph = fakeGraph()

    // Act
    graph.split(4)

    // Assert
    expect(graph.context.createChannelSplitter).toHaveBeenCalledWith(4)
    expect(graph.source.connect).not.toHaveBeenCalled()
  })

  it("sends the chosen channel alone into a target's first input once opened", () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(4)
    const target = new FakeNode()

    // Act
    split.open()
    split.send(2, target as unknown as AudioNode)

    // Assert
    expect(graph.source.connect).toHaveBeenCalledExactlyOnceWith(graph.splitter)
    expect(graph.splitter.connect).toHaveBeenCalledExactlyOnceWith(target, 2, 0)
  })

  it('takes one channel out as a mono node that mixes in none of the others', () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(2)

    // Act
    const mono = split.alone(1) as unknown as FakeGain

    // Assert
    expect(mono.channelCount).toBe(1)
    expect(mono.channelCountMode).toBe('explicit')
    expect(mono.channelInterpretation).toBe('discrete')
    expect(graph.splitter.connect).toHaveBeenCalledExactlyOnceWith(mono, 1, 0)
  })

  it('takes one channel exactly as it came, at its own level', () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(4)

    // Act
    const mono = split.take({ channel: 3, pair: false }) as unknown as FakeGain

    // Assert
    expect(mono.gain.value).toBe(1)
    expect(graph.splitter.connect).toHaveBeenCalledExactlyOnceWith(mono, 3, 0)
  })

  it('takes an aligned pair as one mono node, the two at half each and the others left out', () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(4)

    // Act
    const pair = split.pair(2) as unknown as FakeGain
    const taken = split.take({ channel: 0, pair: true }) as unknown as FakeGain

    // Assert
    for (const mono of [pair, taken]) {
      expect(mono.channelCount).toBe(1)
      expect(mono.channelCountMode).toBe('explicit')
      expect(mono.channelInterpretation).toBe('discrete')
      expect(mono.gain.value).toBe(0.5)
    }
    expect(graph.splitter.connect.mock.calls).toEqual([
      [pair, 2, 0],
      [pair, 3, 0],
      [taken, 0, 0],
      [taken, 1, 0],
    ])
  })

  it('takes away only its own edge from a source its owner already let go', () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(2)
    split.open()
    graph.source.disconnect.mockImplementation(() => {
      throw new DOMException('Not connected', 'InvalidAccessError')
    })

    // Act
    split.close()

    // Assert
    expect(graph.source.disconnect).toHaveBeenCalledExactlyOnceWith(
      graph.splitter,
    )
    expect(graph.splitter.disconnect).toHaveBeenCalledOnce()
  })

  it('leaves a source it never fed alone when closed', () => {
    // Arrange
    const graph = fakeGraph()
    const split = graph.split(2)

    // Act
    split.close()

    // Assert
    expect(graph.source.disconnect).not.toHaveBeenCalled()
    expect(graph.splitter.disconnect).toHaveBeenCalledOnce()
  })
})

describe('isAvailableChannel', () => {
  it('accepts each whole channel the capture has', () => {
    expect(isAvailableChannel(0, 2)).toBe(true)
    expect(isAvailableChannel(1, 2)).toBe(true)
    expect(isAvailableChannel(31, 32)).toBe(true)
  })

  it('refuses a channel the capture does not have, or one that is not whole', () => {
    expect(isAvailableChannel(-1, 2)).toBe(false)
    expect(isAvailableChannel(2, 2)).toBe(false)
    expect(isAvailableChannel(0.5, 2)).toBe(false)
  })

  it('refuses every channel of a capture wider than a split can address', () => {
    expect(isAvailableChannel(0, 33)).toBe(false)
  })
})

describe('defaultChannelPick', () => {
  it('takes both sides of a stereo input at half each, and the first channel of any other', () => {
    // A DAW mixes no interface's inputs unasked: input 1 of three or more.
    const table = [1, 2, 3, 4, 5, 6, 7, 8].map((count) => [
      count,
      defaultChannelPick(count),
    ])

    expect(table).toEqual([
      [1, { channel: 0, pair: false }],
      [2, { channel: 0, pair: true }],
      [3, { channel: 0, pair: false }],
      [4, { channel: 0, pair: false }],
      [5, { channel: 0, pair: false }],
      [6, { channel: 0, pair: false }],
      [7, { channel: 0, pair: false }],
      [8, { channel: 0, pair: false }],
    ])
  })
})

describe('isAvailablePick', () => {
  it('accepts a channel the capture has, and an aligned pair it has both of', () => {
    expect(isAvailablePick({ channel: 1, pair: false }, 2)).toBe(true)
    expect(isAvailablePick({ channel: 0, pair: true }, 2)).toBe(true)
    expect(isAvailablePick({ channel: 2, pair: true }, 4)).toBe(true)
    expect(isAvailablePick({ channel: 30, pair: true }, 32)).toBe(true)
  })

  it('refuses a pair past the count, one that is not aligned, and a channel it does not have', () => {
    expect(isAvailablePick({ channel: 0, pair: true }, 1)).toBe(false)
    expect(isAvailablePick({ channel: 2, pair: true }, 3)).toBe(false)
    expect(isAvailablePick({ channel: 1, pair: true }, 4)).toBe(false)
    expect(isAvailablePick({ channel: 2, pair: false }, 2)).toBe(false)
    expect(isAvailablePick({ channel: 0, pair: true }, 33)).toBe(false)
  })
})

describe('channelPicks', () => {
  it('offers each channel, then each aligned pair the capture has', () => {
    const named = (count: number) =>
      channelPicks(count).map(
        ({ channel, pair }) => `${channel}${pair ? '+' : ''}`,
      )

    expect(named(0)).toEqual([])
    expect(named(1)).toEqual(['0'])
    expect(named(2)).toEqual(['0', '1', '0+'])
    expect(named(3)).toEqual(['0', '1', '2', '0+'])
    expect(named(4)).toEqual(['0', '1', '2', '3', '0+', '2+'])
  })
})

describe('samePick', () => {
  it('matches the same channels, and nobody’s choice only to itself', () => {
    expect(
      samePick({ channel: 0, pair: true }, { channel: 0, pair: true }),
    ).toBe(true)
    expect(
      samePick({ channel: 0, pair: true }, { channel: 0, pair: false }),
    ).toBe(false)
    expect(samePick(null, null)).toBe(true)
    expect(samePick(null, { channel: 0, pair: false })).toBe(false)
  })
})

describe('captureChannelCount', () => {
  it('takes what the track reports', () => {
    expect(captureChannelCount(4, 2)).toBe(4)
  })

  it('falls back to the source when the track will not say', () => {
    // Safari omits most of the settings block.
    expect(captureChannelCount(undefined, 2)).toBe(2)
    expect(captureChannelCount(0, 6)).toBe(6)
  })

  it('is one channel when nothing says otherwise, never zero', () => {
    expect(captureChannelCount(undefined, undefined)).toBe(1)
    expect(captureChannelCount(Number.NaN, -1)).toBe(1)
  })

  it('clamps rather than throwing on an absurd count', () => {
    // Guitar Night throws here because a missing channel is a wrong pitch
    // answer. A monitor losing a channel it cannot address is worth much
    // less than a room that will not open.
    expect(captureChannelCount(64, 1)).toBe(32)
  })
})

describe('loudestChannel', () => {
  it('names the channel the signal is actually on', () => {
    // The whole question a guitarist has: which input am I plugged into.
    expect(loudestChannel([0.001, 0.4, 0.002])).toBe(1)
  })

  it('says nothing rather than guessing when everything is silent', () => {
    // A guess here points somebody at the wrong cable.
    expect(loudestChannel([0, 0, 0])).toBeNull()
    expect(loudestChannel([0.001, 0.002])).toBeNull()
    expect(loudestChannel([])).toBeNull()
  })
})
