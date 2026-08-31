// ============================================================
// Guitar session audio graph tests — isolated room buses and shared electric amp colour
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

class FakeAudioParam {
  value = 0
  readonly cancelScheduledValues = vi.fn()
  readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly setTargetAtTime = vi.fn((value: number) => {
    this.value = value
  })
}

class FakeAudioNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam()
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam()
  readonly Q = new FakeAudioParam()
  readonly gain = new FakeAudioParam()
}

class FakeWaveShaperNode extends FakeAudioNode {
  curve: Float32Array<ArrayBuffer> | null = null
  oversample: OverSampleType = 'none'
}

class FakeDynamicsCompressorNode extends FakeAudioNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

class FakeAudioContext {
  currentTime = 0
  readonly destination = new FakeAudioNode()
  readonly gains: FakeGainNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly waveShapers: FakeWaveShaperNode[] = []
  readonly compressors: FakeDynamicsCompressorNode[] = []

  createGain(): GainNode {
    const node = new FakeGainNode()
    this.gains.push(node)
    return node as unknown as GainNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const node = new FakeBiquadFilterNode()
    this.filters.push(node)
    return node as unknown as BiquadFilterNode
  }

  createWaveShaper(): WaveShaperNode {
    const node = new FakeWaveShaperNode()
    this.waveShapers.push(node)
    return node as unknown as WaveShaperNode
  }

  createDynamicsCompressor(): DynamicsCompressorNode {
    const node = new FakeDynamicsCompressorNode()
    this.compressors.push(node)
    return node as unknown as DynamicsCompressorNode
  }
}

describe('createGuitarSessionAudioGraph', () => {
  it('routes only the electric guide input through one summed amp stage', () => {
    const context = new FakeAudioContext()
    const graph = createGuitarSessionAudioGraph(
      context as unknown as AudioContext,
    )

    const drive = context.waveShapers[0]
    const [presence, cabinet] = context.filters
    const guide = graph.buses.guide as unknown as FakeGainNode
    const master = graph.master as unknown as FakeGainNode

    expect(context.waveShapers).toHaveLength(1)
    expect(context.filters).toHaveLength(2)
    expect(graph.guideInputs.clean).toBe(graph.buses.guide)
    expect(graph.guideInputs.electric).toBe(drive)
    expect(drive.connect).toHaveBeenCalledWith(presence)
    expect(presence.connect).toHaveBeenCalledWith(cabinet)
    expect(cabinet.connect).toHaveBeenCalledWith(guide)
    expect(guide.connect).toHaveBeenCalledWith(master)
    for (const bus of ['drums', 'bass', 'stems', 'monitor'] as const) {
      expect(
        (graph.buses[bus] as unknown as FakeGainNode).connect,
      ).toHaveBeenCalledWith(master)
    }
  })

  it('disconnects the shared amp stage with the graph', () => {
    const context = new FakeAudioContext()
    const graph = createGuitarSessionAudioGraph(
      context as unknown as AudioContext,
    )

    graph.dispose()
    graph.dispose()

    expect(context.waveShapers[0].disconnect).toHaveBeenCalledOnce()
    for (const filter of context.filters) {
      expect(filter.disconnect).toHaveBeenCalledOnce()
    }
  })
})
