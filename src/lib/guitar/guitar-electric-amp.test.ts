// Guitar electric amp tests pin its bounded DSP, fixed graph, and smooth controls.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { computeGuitarElectricAmpToneResponse, computeGuitarElectricAmpVoicing, createGuitarElectricAmpStage, createLegacyGuitarElectricAmpStage, DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, normalizeGuitarElectricAmpParameters, shapeGuitarElectricDrive, shapeGuitarElectricPowerAmp, shapeGuitarElectricPreamp, } from './guitar-electric-amp'

class FakeAudioParam {
  value = 0
  readonly cancelAndHoldAtTime = vi.fn()
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

class FakeAudioContext {
  currentTime = 2
  readonly gains: FakeGainNode[] = []
  readonly filters: FakeBiquadFilterNode[] = []
  readonly waveShapers: FakeWaveShaperNode[] = []

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

describe('createLegacyGuitarElectricAmpStage', () => {
  it('retains the exact lightweight per-voice drive and cabinet graph', () => {
    const context = new FakeAudioContext()
    const stage = createLegacyGuitarElectricAmpStage(
      context as unknown as BaseAudioContext,
    )

    expect(context.gains).toHaveLength(0)
    expect(context.waveShapers).toHaveLength(1)
    expect(context.filters).toHaveLength(2)
    const drive = context.waveShapers[0]
    const [presence, cabinet] = context.filters
    expect(stage.input).toBe(drive)
    expect(stage.output).toBe(cabinet)
    expect(stage.nodes).toEqual([drive, presence, cabinet])
    expect(drive.curve).toHaveLength(1024)
    expect(drive.curve?.[0]).toBeCloseTo(-1)
    expect(drive.curve?.at(-1)).toBeCloseTo(1)
    expect(drive.oversample).toBe('2x')
    expect(presence).toMatchObject({ type: 'peaking' })
    expect(presence.frequency.value).toBe(2800)
    expect(presence.Q.value).toBe(0.9)
    expect(presence.gain.value).toBe(4)
    expect(cabinet).toMatchObject({ type: 'lowpass' })
    expect(cabinet.frequency.value).toBe(5000)
    expect(cabinet.Q.value).toBe(0.7)
    expect(drive.connect).toHaveBeenCalledWith(presence)
    expect(presence.connect).toHaveBeenCalledWith(cabinet)
  })
})

describe('createGuitarElectricAmpStage', () => {
  it('keeps the configurable shared stage on its expanded default voicing', () => {
    const context = new FakeAudioContext()
    const stage = createGuitarElectricAmpStage(
      context as unknown as BaseAudioContext,
    )

    expect(stage.input).toBe(context.gains[0])
    expect(stage.output).toBe(context.gains[1])
    expect(stage.getParameters()).toEqual(
      DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS,
    )
    expect(context.waveShapers).toHaveLength(3)
    expect(context.waveShapers.every((node) => node.oversample === '2x')).toBe(
      true,
    )
    expect(context.filters).toHaveLength(9)
    expect(context.filters[0]).toMatchObject({ type: 'highpass' })
    expect(context.filters[0].frequency.value).toBe(45)
    expect(context.filters[1]).toMatchObject({ type: 'lowpass' })
    expect(context.filters[1].frequency.value).toBe(7200)
    expect(context.filters[5]).toMatchObject({ type: 'peaking' })
    expect(context.filters[5].frequency.value).toBe(3800)
    expect(context.filters[5].gain.value).toBeCloseTo(0.4)
    expect(context.filters[8]).toMatchObject({ type: 'lowpass' })
    expect(context.filters[8].frequency.value).toBe(5350)
  })

  it('keeps bypass and output endpoints stable while ramping live changes', () => {
    const context = new FakeAudioContext()
    const stage = createGuitarElectricAmpStage(
      context as unknown as BaseAudioContext,
    )
    const input = stage.input
    const output = stage.output
    const dry = context.gains[2]
    const preampDrive = context.gains[4]
    const outputLevel = context.gains[11]
    const wet = context.gains[12]

    const next = stage.setParameters(
      { enabled: false, drive: 2, output: 1 },
      12,
    )

    expect(stage.input).toBe(input)
    expect(stage.output).toBe(output)
    expect(next).toMatchObject({ enabled: false, drive: 1, output: 1 })
    expect(dry.gain.setTargetAtTime).toHaveBeenCalledWith(1, 12, 0.018)
    expect(wet.gain.setTargetAtTime).toHaveBeenCalledWith(0, 12, 0.018)
    expect(preampDrive.gain.setTargetAtTime).toHaveBeenCalled()
    expect(outputLevel.gain.setTargetAtTime).toHaveBeenCalled()
    expect(preampDrive.gain.cancelAndHoldAtTime).toHaveBeenCalledWith(12)

    stage.setBypassed(false, 14)
    expect(stage.getParameters().enabled).toBe(true)
    expect(dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 14, 0.018)
    expect(wet.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 14, 0.018)
  })

  it('disconnects its fixed graph once', () => {
    const context = new FakeAudioContext()
    const stage = createGuitarElectricAmpStage(
      context as unknown as BaseAudioContext,
    )

    stage.dispose()
    stage.dispose()

    for (const node of stage.nodes as unknown as readonly FakeAudioNode[]) {
      expect(node.disconnect).toHaveBeenCalledOnce()
    }
  })
})

describe('guitar electric amp controls', () => {
  it('clamps finite controls and rejects non-finite values', () => {
    const normalized = normalizeGuitarElectricAmpParameters({
      drive: 4,
      bass: -4,
      mid: Number.NaN,
      output: Number.POSITIVE_INFINITY,
      cabinet: 'dark',
    })

    expect(normalized).toMatchObject({
      drive: 1,
      bass: -1,
      mid: DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS.mid,
      output: DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS.output,
      cabinet: 'dark',
    })
  })

  it('moves tone and cabinet response in the named direction', () => {
    const cut = computeGuitarElectricAmpVoicing({
      bass: -1,
      mid: -1,
      treble: -1,
      presence: -1,
      cabinet: 'open',
    })
    const boost = computeGuitarElectricAmpVoicing({
      bass: 1,
      mid: 1,
      treble: 1,
      presence: 1,
      cabinet: 'dark',
    })

    expect(boost.bassGainDb).toBeGreaterThan(cut.bassGainDb)
    expect(boost.midGainDb).toBeGreaterThan(cut.midGainDb)
    expect(boost.trebleGainDb).toBeGreaterThan(cut.trebleGainDb)
    expect(boost.presenceGainDb).toBeGreaterThan(cut.presenceGainDb)
    expect(boost.cabinetLowpassHz).toBeLessThan(cut.cabinetLowpassHz)
    expect(boost.cabinetBodyGainDb).toBeGreaterThan(cut.cabinetBodyGainDb)
  })

  it('renders each tone control in its own useful frequency region', () => {
    const frequencies = [80, 750, 6000]
    const cut = computeGuitarElectricAmpToneResponse(
      { bass: -1, mid: -1, treble: -1 },
      frequencies,
    )
    const boost = computeGuitarElectricAmpToneResponse(
      { bass: 1, mid: 1, treble: 1 },
      frequencies,
    )

    expect(boost[0] - cut[0]).toBeGreaterThan(10)
    expect(boost[1] - cut[1]).toBeGreaterThan(10)
    expect(boost[2] - cut[2]).toBeGreaterThan(8)
  })

  it('makes the dark cabinet roll off the top without adding broadband level', () => {
    const open = computeGuitarElectricAmpToneResponse(
      { cabinet: 'open' },
      [750, 6000],
    )
    const dark = computeGuitarElectricAmpToneResponse(
      { cabinet: 'dark' },
      [750, 6000],
    )

    expect(Math.abs(dark[0] - open[0])).toBeLessThan(1.5)
    expect(dark[1]).toBeLessThan(open[1] - 4)
  })

  it('compensates higher drive and leaves output level independently useful', () => {
    const clean = computeGuitarElectricAmpVoicing({ drive: 0, output: 0 })
    const driven = computeGuitarElectricAmpVoicing({ drive: 1, output: 1 })

    expect(driven.preampDriveGain).toBeGreaterThan(clean.preampDriveGain)
    expect(driven.powerDriveGain).toBeGreaterThan(clean.powerDriveGain)
    expect(driven.preampCompensationGain).toBeLessThan(
      clean.preampCompensationGain,
    )
    expect(driven.powerCompensationGain).toBeLessThan(
      clean.powerCompensationGain,
    )
    expect(driven.outputGain).toBeGreaterThan(clean.outputGain)
  })
})

describe('guitar electric amp nonlinear stages', () => {
  it('increases harmonic density monotonically across the useful drive range', () => {
    const sampleRate = 8192
    const sampleCount = 8192
    const fundamental = 128
    const distortionRatios = [0.2, 0.4, 0.6, 0.8, 1].map((drive) => {
      const rendered = new Float32Array(sampleCount)
      for (let index = 0; index < sampleCount; index += 1) {
        const input =
          0.18 * Math.sin((2 * Math.PI * fundamental * index) / sampleRate)
        const preamp = shapeGuitarElectricPreamp(input, drive, 0.3)
        rendered[index] = shapeGuitarElectricPowerAmp(preamp, drive)
      }
      const fundamentalMagnitude = spectralMagnitude(
        rendered,
        fundamental,
        sampleRate,
      )
      const harmonicPower = [2, 3, 4, 5, 6, 7].reduce((sum, harmonic) => {
        const magnitude = spectralMagnitude(
          rendered,
          fundamental * harmonic,
          sampleRate,
        )
        return sum + magnitude ** 2
      }, 0)
      return Math.sqrt(harmonicPower) / fundamentalMagnitude
    })

    for (let index = 1; index < distortionRatios.length; index += 1) {
      expect(distortionRatios[index]).toBeGreaterThan(
        distortionRatios[index - 1],
      )
    }
    expect(distortionRatios.at(-1)).toBeGreaterThan(distortionRatios[0] * 3)
  })

  it('adds controllable even harmonics without destabilizing the signal', () => {
    const sampleRate = 8192
    const sampleCount = 8192
    const fundamental = 256
    const symmetric = new Float32Array(sampleCount)
    const asymmetric = new Float32Array(sampleCount)
    for (let index = 0; index < sampleCount; index += 1) {
      const input =
        0.55 * Math.sin((2 * Math.PI * fundamental * index) / sampleRate)
      symmetric[index] = shapeGuitarElectricPreamp(input, 0.75, 0)
      asymmetric[index] = shapeGuitarElectricPreamp(input, 0.75, 1)
    }

    const symmetricSecond = spectralMagnitude(
      symmetric,
      fundamental * 2,
      sampleRate,
    )
    const asymmetricSecond = spectralMagnitude(
      asymmetric,
      fundamental * 2,
      sampleRate,
    )
    expect(symmetricSecond).toBeLessThan(0.00001)
    expect(asymmetricSecond).toBeGreaterThan(0.005)
    expect(asymmetricSecond).toBeGreaterThan(symmetricSecond * 100)
    expect(Math.max(...asymmetric)).toBeLessThanOrEqual(1)
    expect(Math.min(...asymmetric)).toBeGreaterThanOrEqual(-1)
  })

  it('gives preamp and power stages distinct nonlinear responsibilities', () => {
    const input = 0.5
    const preampClean = shapeGuitarElectricPreamp(input, 0, 0)
    const preampDriven = shapeGuitarElectricPreamp(input, 1, 0)
    const powerClean = shapeGuitarElectricPowerAmp(input, 0)
    const powerDriven = shapeGuitarElectricPowerAmp(input, 1)

    expect(preampDriven).not.toBeCloseTo(preampClean, 2)
    expect(powerDriven).not.toBeCloseTo(powerClean, 2)
    expect(Number.isFinite(preampDriven)).toBe(true)
    expect(Number.isFinite(powerDriven)).toBe(true)
  })

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

    const intermodulationFrequency = 2 * firstFrequency - secondFrequency
    expect(
      spectralMagnitude(shared, intermodulationFrequency, sampleRate),
    ).toBeGreaterThan(0.04)
    expect(
      spectralMagnitude(separate, intermodulationFrequency, sampleRate),
    ).toBeLessThan(0.00001)
  })
})
