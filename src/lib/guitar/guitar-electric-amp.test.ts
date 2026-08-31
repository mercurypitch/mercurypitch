// Guitar electric amp tests pin the shared voicing and its summed-signal behaviour.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { createGuitarElectricAmpStage, shapeGuitarElectricDrive, } from './guitar-electric-amp'

class FakeAudioParam {
  value = 0
}

class FakeAudioNode {
  readonly connect = vi.fn((destination: unknown) => destination)
  readonly disconnect = vi.fn()
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

class FakeAudioContext {
  readonly filters: FakeBiquadFilterNode[] = []
  readonly waveShapers: FakeWaveShaperNode[] = []

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
}

function spectralMagnitude(
  samples: Float32Array,
  frequency: number,
  sampleRate: number,
): number {
  let real = 0
  let imaginary = 0
  for (let index = 0; index < samples.length; index += 1) {
    const phase = (2 * Math.PI * frequency * index) / sampleRate
    real += samples[index] * Math.cos(phase)
    imaginary -= samples[index] * Math.sin(phase)
  }
  return Math.hypot(real, imaginary) / (samples.length / 2)
}

describe('createGuitarElectricAmpStage', () => {
  it('keeps the established drive, presence, and asset-free cabinet voicing', () => {
    const context = new FakeAudioContext()
    const stage = createGuitarElectricAmpStage(
      context as unknown as BaseAudioContext,
    )

    const drive = context.waveShapers[0]
    const [presence, cabinet] = context.filters
    expect(stage.input).toBe(drive)
    expect(stage.output).toBe(cabinet)
    expect(stage.nodes).toEqual([drive, presence, cabinet])
    expect(drive.connect).toHaveBeenCalledWith(presence)
    expect(presence.connect).toHaveBeenCalledWith(cabinet)
    expect(drive.oversample).toBe('2x')
    expect(drive.curve).toHaveLength(1024)
    expect(drive.curve?.[0]).toBeCloseTo(-1)
    expect(drive.curve?.at(-1)).toBeCloseTo(1)
    expect(presence).toMatchObject({ type: 'peaking' })
    expect(presence.frequency.value).toBe(2800)
    expect(presence.Q.value).toBe(0.9)
    expect(presence.gain.value).toBe(4)
    expect(cabinet).toMatchObject({ type: 'lowpass' })
    expect(cabinet.frequency.value).toBe(5000)
    expect(cabinet.Q.value).toBe(0.7)
  })
})

describe('shapeGuitarElectricDrive', () => {
  it('creates intermodulation only after simultaneous strings meet', () => {
    const sampleRate = 8192
    const sampleCount = 8192
    const firstFrequency = 512
    const secondFrequency = 768
    const shared = new Float32Array(sampleCount)
    const separate = new Float32Array(sampleCount)
    for (let index = 0; index < sampleCount; index += 1) {
      const first =
        0.3 * Math.sin((2 * Math.PI * firstFrequency * index) / sampleRate)
      const second =
        0.3 * Math.sin((2 * Math.PI * secondFrequency * index) / sampleRate)
      shared[index] = shapeGuitarElectricDrive(first + second)
      separate[index] =
        shapeGuitarElectricDrive(first) + shapeGuitarElectricDrive(second)
    }

    // 2*f1-f2 is absent when each voice is shaped alone, but appears when the
    // same non-linearity receives their sum: conventional mono-pickup routing.
    const intermodulationFrequency = 2 * firstFrequency - secondFrequency
    expect(
      spectralMagnitude(shared, intermodulationFrequency, sampleRate),
    ).toBeGreaterThan(0.04)
    expect(
      spectralMagnitude(separate, intermodulationFrequency, sampleRate),
    ).toBeLessThan(0.00001)
  })
})
