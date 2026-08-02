import { describe, expect, it } from 'vitest'
import { createFxRack, FX_PRESETS, normalizeFxSettings, presetNameFor, } from './voice-fx-rack'

function createParam(initial = 0) {
  return {
    value: initial,
    targets: [] as number[],
    setTargetAtTime(value: number) {
      this.targets.push(value)
    },
  }
}

class FakeNode {
  connected: FakeNode[] = []
  disconnectCount = 0

  connect(target: FakeNode): FakeNode {
    this.connected.push(target)
    return target
  }

  disconnect(): void {
    this.disconnectCount += 1
  }
}

class FakeGain extends FakeNode {
  gain = createParam()
}

class FakeContext {
  sampleRate = 100
  currentTime = 2
  destination = new FakeNode()
  gains: FakeGain[] = []
  bufferCreates = 0

  createGain(): FakeGain {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain
  }

  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: createParam(),
      knee: createParam(),
      ratio: createParam(),
      attack: createParam(),
      release: createParam(),
    })
  }

  createDelay() {
    return Object.assign(new FakeNode(), { delayTime: createParam() })
  }

  createBiquadFilter() {
    return Object.assign(new FakeNode(), {
      type: 'lowpass',
      frequency: createParam(),
    })
  }

  createConvolver() {
    return Object.assign(new FakeNode(), { buffer: null as AudioBuffer | null })
  }

  createBuffer(channels: number, length: number) {
    this.bufferCreates += 1
    const channelData = Array.from(
      { length: channels },
      () => new Float32Array(length),
    )
    return {
      getChannelData: (channel: number) => channelData[channel]!,
    }
  }
}

describe('voice FX settings', () => {
  it('recognises the shared listening-room presets', () => {
    for (const preset of FX_PRESETS) {
      expect(presetNameFor({ ...preset.settings })).toBe(preset.name)
    }
    expect(presetNameFor({ echo: 11, reverb: 25, hall: 0 })).toBeNull()
  })

  it('keeps every send inside the safe zero-to-one-hundred range', () => {
    expect(
      normalizeFxSettings({
        echo: -20,
        reverb: Number.NaN,
        hall: 140,
      }),
    ).toEqual({ echo: 0, reverb: 0, hall: 100 })
  })

  it('routes bounded sends through one cached room environment', () => {
    const context = new FakeContext()
    const rack = createFxRack(context as unknown as AudioContext, {
      safetyLimiter: true,
    })

    rack.setSettings({ echo: 100, reverb: 50, hall: 25 })

    expect(context.gains[4]!.gain.targets).toEqual([1])
    expect(context.gains[6]!.gain.targets).toEqual([0.45])
    expect(context.gains[7]!.gain.targets).toEqual([0.2])
    expect(context.bufferCreates).toBe(2)

    const secondRack = createFxRack(context as unknown as AudioContext)
    expect(context.bufferCreates).toBe(2)

    rack.dispose()
    rack.dispose()
    expect(context.gains[0]!.disconnectCount).toBe(1)
    secondRack.dispose()
  })
})
