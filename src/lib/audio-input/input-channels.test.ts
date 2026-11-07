// Input channels tests — a split feeds nothing until it is opened, takes one channel alone and takes away only its own edge; a channel is one the capture has; the count falls back and clamps; the loudest channel is named only above the floor.

import { describe, expect, it, vi } from 'vitest'
import { captureChannelCount, isAvailableChannel, loudestChannel, splitChannels, } from './input-channels'

class FakeNode {
  connect = vi.fn()
  disconnect = vi.fn()
}

class FakeGain extends FakeNode {
  channelCount = 2
  channelCountMode: ChannelCountMode = 'max'
  channelInterpretation: ChannelInterpretation = 'speakers'
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
