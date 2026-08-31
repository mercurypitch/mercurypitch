// Guitar input monitor tests pin the opt-in wet branch and deterministic teardown.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { createGuitarInputMonitor } from './guitar-input-monitor'

const amp = vi.hoisted(() => ({
  createStage: vi.fn(),
}))

vi.mock('@/lib/guitar/guitar-electric-amp', () => ({
  createGuitarElectricAmpStage: amp.createStage,
}))

const PARAMETERS: GuitarElectricAmpParameters = {
  enabled: true,
  drive: 0.5,
  bass: 0,
  mid: 0,
  treble: 0,
  presence: 0,
  output: 0.5,
  cabinet: 'balanced',
  asymmetry: 0,
}

function createHarness() {
  const input = {}
  const stageOutput = { connect: vi.fn() }
  const stage = {
    input,
    output: stageOutput,
    nodes: [],
    getParameters: vi.fn(() => PARAMETERS),
    setParameters: vi.fn(() => PARAMETERS),
    setBypassed: vi.fn(),
    dispose: vi.fn(),
  }
  amp.createStage.mockReturnValue(stage)

  const gain = {
    value: 0,
    cancelAndHoldAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  }
  const output = {
    gain,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const context = {
    currentTime: 2,
    createGain: vi.fn(() => output),
  } as unknown as AudioContext
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MediaStreamAudioSourceNode
  const monitorBus = {} as AudioNode

  return {
    context,
    gain,
    input,
    monitorBus,
    output,
    source,
    stage,
    stageOutput,
  }
}

describe('createGuitarInputMonitor', () => {
  beforeEach(() => vi.clearAllMocks())

  it('adds one initially silent wet branch to the supplied monitor bus', () => {
    const harness = createHarness()

    createGuitarInputMonitor({
      context: harness.context,
      source: harness.source,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
    })

    expect(amp.createStage).toHaveBeenCalledWith(harness.context, PARAMETERS)
    expect(harness.source.connect).toHaveBeenCalledOnce()
    expect(harness.source.connect).toHaveBeenCalledWith(harness.input)
    expect(harness.stageOutput.connect).toHaveBeenCalledWith(harness.output)
    expect(harness.output.connect).toHaveBeenCalledWith(harness.monitorBus)
    expect(harness.gain.setValueAtTime).toHaveBeenCalledWith(0, 2)
    expect(harness.gain.setTargetAtTime).not.toHaveBeenCalled()
  })

  it('ramps live toggles, forwards amp changes, and disposes synchronously', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      context: harness.context,
      source: harness.source,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
    })

    expect(monitor.setEnabled(true)).toBe(true)
    expect(harness.gain.cancelAndHoldAtTime).toHaveBeenCalledWith(2)
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0.01)

    const changed = { ...PARAMETERS, drive: 0.8 }
    monitor.setParameters(changed)
    expect(harness.stage.setParameters).toHaveBeenCalledWith(changed, 2)

    expect(monitor.setEnabled(false)).toBe(false)
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.01)
    monitor.dispose()
    expect(harness.source.disconnect).toHaveBeenCalledWith(harness.input)
    expect(harness.output.disconnect).toHaveBeenCalledOnce()
    expect(harness.stage.dispose).toHaveBeenCalledOnce()
    expect(monitor.setEnabled(true)).toBe(false)
  })
})
