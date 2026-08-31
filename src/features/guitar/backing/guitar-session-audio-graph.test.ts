// ============================================================
// Guitar session audio graph tests — isolated room buses and shared electric amp colour
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import { createGuitarSessionAudioGraph } from './guitar-session-audio-graph'

class FakeAudioParam {
  value = 0
  readonly cancelScheduledValues = vi.fn()
  readonly setValueAtTime = vi.fn((value: number) => {
    this.value = value
  })
  readonly setTargetAtTime = vi.fn(
    (value: number, _at: number, _timeConstant: number) => {
      this.value = value
    },
  )
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

    const electricInput = graph.guideInputs.electric as unknown as FakeGainNode
    const guide = graph.buses.guide as unknown as FakeGainNode
    const master = graph.master as unknown as FakeGainNode
    const ampOutputs = context.gains.filter((gain) =>
      gain.connect.mock.calls.some(([destination]) => destination === guide),
    )

    // The shared route keeps the expanded staged amp; the lightweight legacy
    // factory is reserved for synth voices outside Guitar Night.
    expect(context.waveShapers).toHaveLength(3)
    expect(context.filters).toHaveLength(8)
    expect(graph.guideInputs.clean).toBe(graph.buses.guide)
    expect(electricInput).not.toBe(guide)
    expect(ampOutputs).toHaveLength(1)
    expect(electricInput.connect).not.toHaveBeenCalledWith(guide)
    expect(guide.connect).toHaveBeenCalledWith(master)
    for (const bus of ['drums', 'bass', 'stems', 'monitor'] as const) {
      expect(
        (graph.buses[bus] as unknown as FakeGainNode).connect,
      ).toHaveBeenCalledWith(master)
    }
  })

  it('seeds its dormant stage and updates the same nodes on the audio clock', () => {
    const context = new FakeAudioContext()
    const initial = {
      ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
      drive: 0.23,
      mid: -0.3,
    }
    const graph = createGuitarSessionAudioGraph(
      context as unknown as AudioContext,
      { electricAmpParameters: initial },
    )
    const nodeCount =
      context.gains.length + context.filters.length + context.waveShapers.length

    expect(graph.getElectricAmpParameters()).toEqual(initial)
    context.currentTime = 7
    graph.setElectricAmpParameters({ drive: 0.81, enabled: false })

    expect(graph.getElectricAmpParameters()).toMatchObject({
      drive: 0.81,
      enabled: false,
      mid: -0.3,
    })
    expect(
      [...context.gains, ...context.filters].some((node) =>
        node.gain.setTargetAtTime.mock.calls.some((call) => call[1] === 7),
      ),
    ).toBe(true)
    expect(
      context.gains.length +
        context.filters.length +
        context.waveShapers.length,
    ).toBe(nodeCount)
  })

  it('disconnects the shared amp stage with the graph', () => {
    const context = new FakeAudioContext()
    const graph = createGuitarSessionAudioGraph(
      context as unknown as AudioContext,
    )

    graph.dispose()
    graph.dispose()

    for (const gain of context.gains) {
      expect(gain.disconnect).toHaveBeenCalledOnce()
    }
    for (const shaper of context.waveShapers) {
      expect(shaper.disconnect).toHaveBeenCalledOnce()
    }
    for (const filter of context.filters) {
      expect(filter.disconnect).toHaveBeenCalledOnce()
    }
  })
})
