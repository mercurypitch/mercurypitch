// Guitar input monitor tests pin the opt-in wet branch and deterministic teardown.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { createGuitarInputMonitor } from './guitar-input-monitor'

const amp = vi.hoisted(() => ({
  createStage: vi.fn(),
}))

vi.mock('@/lib/guitar/guitar-amp-stage', () => ({
  createGuitarAmpStage: amp.createStage,
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
  const stages = [stage]
  amp.createStage.mockImplementation(() => {
    if (amp.createStage.mock.calls.length === 1) return stage
    const next = {
      ...stage,
      input: {},
      output: { connect: vi.fn() },
      dispose: vi.fn(),
    }
    stages.push(next)
    return next
  })

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
  const monos: (typeof output)[] = []
  const splitters: {
    connect: ReturnType<typeof vi.fn>
    disconnect: ReturnType<typeof vi.fn>
  }[] = []
  const events = new EventTarget()
  let gainCount = 0
  const raw = {
    currentTime: 2,
    state: 'running',
    createGain: vi.fn(() => {
      if (gainCount++ === 0) return output
      const mono = { gain: { ...gain }, connect: vi.fn(), disconnect: vi.fn() }
      monos.push(mono)
      return mono
    }),
    createChannelSplitter: vi.fn(() => {
      const splitter = { connect: vi.fn(), disconnect: vi.fn() }
      splitters.push(splitter)
      return splitter
    }),
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
  }
  const context = raw as unknown as AudioContext
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as MediaStreamAudioSourceNode
  const monitorBus = {} as AudioNode

  return {
    context,
    raw,
    events,
    monos,
    splitters,
    stages,
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
  afterEach(() => vi.useRealTimers())

  it('keeps the amp dormant until explicit monitor opt-in', () => {
    const harness = createHarness()

    const monitor = createGuitarInputMonitor({
      context: harness.context,
      source: harness.source,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
    })

    expect(amp.createStage).not.toHaveBeenCalled()
    expect(harness.source.connect).not.toHaveBeenCalled()
    expect(harness.gain.setValueAtTime).toHaveBeenCalledWith(0, 2)
    expect(harness.gain.setTargetAtTime).not.toHaveBeenCalled()
    const updated = {
      ...PARAMETERS,
      engine: 'studio' as const,
      character: 0.25,
    }
    monitor.setParameters(updated)
    expect(amp.createStage).not.toHaveBeenCalled()
    expect(monitor.setEnabled(true)).toBe(true)
    expect(amp.createStage).toHaveBeenCalledWith(harness.context, updated)
    expect(harness.source.connect).toHaveBeenCalledOnce()
    expect(harness.source.connect).toHaveBeenCalledWith(harness.splitters[0])
    expect(harness.splitters[0].connect).toHaveBeenCalledWith(
      harness.monos[0],
      0,
      0,
    )
    expect(harness.monos[0]).toMatchObject({
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'discrete',
    })
    expect(harness.monos[0].connect).toHaveBeenCalledWith(harness.input)
    expect(harness.output).toMatchObject({
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
    expect(harness.stageOutput.connect).toHaveBeenCalledWith(harness.output)
    expect(harness.output.connect).toHaveBeenCalledWith(harness.monitorBus)
    monitor.setEnabled(false)
    monitor.setEnabled(true)
    expect(amp.createStage).toHaveBeenCalledOnce()
    monitor.dispose()
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

    const changed = {
      ...PARAMETERS,
      engine: 'studio' as const,
      head: 'definition' as const,
      character: 0.4,
      drive: 0.8,
    }
    monitor.setParameters(changed)
    expect(harness.stage.setParameters).toHaveBeenCalledWith(changed, 2)

    expect(monitor.setEnabled(false)).toBe(false)
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.01)
    monitor.dispose()
    expect(harness.source.disconnect).toHaveBeenCalledWith(harness.splitters[0])
    expect(harness.splitters[0].disconnect).toHaveBeenCalledOnce()
    expect(harness.monos[0].disconnect).toHaveBeenCalledOnce()
    expect(harness.output.disconnect).toHaveBeenCalledOnce()
    expect(harness.stage.dispose).toHaveBeenCalledOnce()
    expect(harness.source.disconnect).toHaveBeenCalledTimes(1)
    expect(monitor.setEnabled(true)).toBe(false)
  })

  it('disposes an unopened monitor without touching the dry input connections', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      context: harness.context,
      source: harness.source,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
    })
    monitor.dispose()
    monitor.dispose()
    expect(amp.createStage).not.toHaveBeenCalled()
    expect(harness.source.disconnect).not.toHaveBeenCalled()
    expect(harness.output.disconnect).toHaveBeenCalledOnce()
    expect(monitor.setEnabled(true)).toBe(false)
  })

  it('selects only the requested physical channel, without preparing audio on selection', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
      inputChannelCount: 32,
    })

    expect(monitor.setInputChannel(31)).toBe(true)
    expect(amp.createStage).not.toHaveBeenCalled()
    expect(harness.raw.createChannelSplitter).not.toHaveBeenCalled()
    expect(monitor.setEnabled(true)).toBe(true)

    expect(harness.raw.createChannelSplitter).toHaveBeenCalledWith(32)
    expect(harness.splitters[0].connect).toHaveBeenCalledOnce()
    expect(harness.splitters[0].connect).toHaveBeenCalledWith(
      harness.monos[0],
      31,
      0,
    )
    monitor.dispose()
  })

  it('leaves a running same-channel selection untouched but mutes an invalid request', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
      inputChannelCount: 2,
    })
    monitor.setEnabled(true)
    expect(monitor.setInputChannel(0)).toBe(true)
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0.01)

    expect(monitor.setInputChannel(2)).toBe(false)

    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.01)
    expect(harness.source.disconnect).not.toHaveBeenCalled()
    expect(harness.raw.createChannelSplitter).toHaveBeenCalledOnce()
    monitor.dispose()
  })

  it('cleans partial route allocation without disconnecting unrelated dry branches', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
    })
    harness.stageOutput.connect.mockImplementation(() => {
      throw new Error('Output connection failed')
    })

    expect(monitor.setEnabled(true)).toBe(false)

    expect(harness.source.disconnect).toHaveBeenCalledExactlyOnceWith(
      harness.splitters[0],
    )
    expect(harness.splitters[0].disconnect).toHaveBeenCalledOnce()
    expect(harness.monos[0].disconnect).toHaveBeenCalledOnce()
    expect(harness.stage.dispose).toHaveBeenCalledOnce()
    monitor.dispose()
  })

  it.each([0, -1, 1.5, 33, NaN, Infinity])(
    'fails closed for invalid available channel count %s',
    (inputChannelCount) => {
      const harness = createHarness()
      const monitor = createGuitarInputMonitor({
        ...harness,
        destination: harness.monitorBus,
        parameters: PARAMETERS,
        inputChannelCount,
      })
      expect(monitor.setEnabled(true)).toBe(false)
      expect(monitor.setInputChannel(0)).toBe(false)
      expect(amp.createStage).not.toHaveBeenCalled()
      monitor.dispose()
    },
  )

  it.each([-1, 2, 1.5, NaN, Infinity])(
    'rejects invalid input %s without clamping to another source',
    (inputChannel) => {
      const harness = createHarness()
      const monitor = createGuitarInputMonitor({
        ...harness,
        destination: harness.monitorBus,
        parameters: PARAMETERS,
        inputChannel,
        inputChannelCount: 2,
      })
      expect(monitor.setEnabled(true)).toBe(false)
      expect(monitor.setInputChannel(inputChannel)).toBe(false)
      expect(amp.createStage).not.toHaveBeenCalled()
      monitor.dispose()
    },
  )

  it('fades the old route before accepting a queued enable on a clean new head', () => {
    vi.useFakeTimers()
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
      inputChannelCount: 2,
    })
    monitor.setEnabled(true)
    expect(monitor.setInputChannel(1)).toBe(true)
    expect(monitor.setEnabled(true)).toBe(true)
    expect(amp.createStage).toHaveBeenCalledOnce()
    expect(harness.stage.dispose).not.toHaveBeenCalled()
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.01)

    harness.raw.currentTime = 2.2
    vi.advanceTimersByTime(200)

    expect(harness.stage.dispose).toHaveBeenCalledOnce()
    expect(amp.createStage).toHaveBeenCalledTimes(2)
    expect(harness.splitters[1].connect).toHaveBeenCalledWith(
      harness.monos[1],
      1,
      0,
    )
    expect(harness.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2.23, 0.01)
    monitor.dispose()
    expect(harness.stages[1].dispose).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['off', 'another-channel', 'dispose'])(
    'cancels queued route re-enable on %s',
    (cancellation) => {
      vi.useFakeTimers()
      const harness = createHarness()
      const monitor = createGuitarInputMonitor({
        ...harness,
        destination: harness.monitorBus,
        parameters: PARAMETERS,
        inputChannelCount: 2,
      })
      monitor.setEnabled(true)
      monitor.setInputChannel(1)
      monitor.setEnabled(true)
      if (cancellation === 'off') monitor.setEnabled(false)
      else if (cancellation === 'another-channel') monitor.setInputChannel(0)
      else monitor.dispose()

      harness.raw.currentTime = 2.2
      vi.advanceTimersByTime(200)

      expect(amp.createStage).toHaveBeenCalledOnce()
      expect(harness.stage.dispose).toHaveBeenCalledOnce()
      monitor.dispose()
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('parks a suspended retirement without polling, then switches only after audio consumes the fade', () => {
    vi.useFakeTimers()
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
      inputChannelCount: 2,
    })
    monitor.setEnabled(true)
    harness.raw.state = 'suspended'
    monitor.setInputChannel(1)
    monitor.setEnabled(true)
    vi.advanceTimersByTime(1000)
    expect(vi.getTimerCount()).toBe(0)
    expect(harness.stage.dispose).not.toHaveBeenCalled()

    harness.raw.state = 'running'
    harness.events.dispatchEvent(new Event('statechange'))
    expect(harness.stage.dispose).not.toHaveBeenCalled()
    harness.raw.currentTime = 2.2
    vi.advanceTimersByTime(200)

    expect(amp.createStage).toHaveBeenCalledTimes(2)
    expect(harness.raw.removeEventListener).toHaveBeenCalledOnce()
    monitor.dispose()
  })

  it('removes a parked route listener on disposal without reviving its pending enable', () => {
    const harness = createHarness()
    const monitor = createGuitarInputMonitor({
      ...harness,
      destination: harness.monitorBus,
      parameters: PARAMETERS,
      inputChannelCount: 2,
    })
    monitor.setEnabled(true)
    harness.raw.state = 'suspended'
    monitor.setInputChannel(1)
    monitor.setEnabled(true)

    monitor.dispose()
    harness.raw.state = 'running'
    harness.events.dispatchEvent(new Event('statechange'))

    expect(harness.raw.removeEventListener).toHaveBeenCalledOnce()
    expect(amp.createStage).toHaveBeenCalledOnce()
    expect(harness.stage.dispose).toHaveBeenCalledOnce()
  })
})
