// The pitch-shift wrapper loads our own worklet and drives the engine node.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canShiftPitch, createPitchShifter, PITCH_SHIFT_NODE_OPTIONS, presetConfig, startChange, } from './pitch-shift-node'

vi.mock('@/workers/pitch-shift.worklet.ts?worker&url', () => ({
  default: '/assets/pitch-shift-worklet.js',
}))

const engine = vi.hoisted(() => {
  class FakeStretchNode {
    readonly calls: Array<[string, unknown]> = []
    readonly port = { close: vi.fn() }
    disconnected = false
    latencyReply: unknown = 0.085
    schedule(change: unknown) {
      this.calls.push(['schedule', change])
      return Promise.resolve()
    }
    configure(config: unknown) {
      this.calls.push(['configure', config])
      return Promise.resolve()
    }
    latency() {
      this.calls.push(['latency', undefined])
      return Promise.resolve(this.latencyReply)
    }
    stop() {
      this.calls.push(['stop', undefined])
      return Promise.resolve()
    }
    disconnect() {
      this.disconnected = true
    }
  }

  const state = {
    nodes: [] as FakeStretchNode[],
    moduleUrlAtCreate: [] as Array<string | undefined>,
    nextLatency: 0.085 as unknown,
    hang: false,
  }

  const factory = Object.assign(
    vi.fn((_context: unknown, _options: unknown) => {
      state.moduleUrlAtCreate.push(factory.moduleUrl)
      if (state.hang) return new Promise<FakeStretchNode>(() => {})
      const node = new FakeStretchNode()
      node.latencyReply = state.nextLatency
      state.nodes.push(node)
      return Promise.resolve(node)
    }),
    { moduleUrl: undefined as string | undefined },
  )

  return { state, factory }
})

vi.mock('signalsmith-stretch', () => ({ default: engine.factory }))

function fakeContext(
  addModule = vi.fn(() => Promise.resolve()),
  state: AudioContextState = 'running',
) {
  const context = Object.assign(new EventTarget(), {
    audioWorklet: { addModule },
    state,
  })
  return {
    context: context as unknown as BaseAudioContext,
    addModule,
    setState(next: AudioContextState) {
      context.state = next
      context.dispatchEvent(new Event('statechange'))
    },
  }
}

describe('pitch-shift node', () => {
  beforeEach(() => {
    engine.state.nodes = []
    engine.state.moduleUrlAtCreate = []
    engine.state.nextLatency = 0.085
    engine.state.hang = false
    engine.factory.moduleUrl = undefined
    engine.factory.mockClear()
    vi.stubGlobal('AudioWorkletNode', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads our own worklet once per context and never leaves the library to build a blob', async () => {
    const { context, addModule } = fakeContext()

    await createPitchShifter(context, { formantCompensation: false })
    await createPitchShifter(context, { formantCompensation: true })

    expect(addModule).toHaveBeenCalledTimes(1)
    expect(addModule).toHaveBeenCalledWith('/assets/pitch-shift-worklet.js')
    expect(engine.state.moduleUrlAtCreate).toEqual([
      '/assets/pitch-shift-worklet.js',
      '/assets/pitch-shift-worklet.js',
    ])
    expect(engine.factory).toHaveBeenCalledWith(
      context,
      PITCH_SHIFT_NODE_OPTIONS,
    )
  })

  it('starts the engine active at 0 semitones with the requested preset and formants', async () => {
    const { context } = fakeContext()

    const shifter = await createPitchShifter(context, {
      formantCompensation: true,
      formantBaseHz: 180,
      preset: 'cheaper',
    })

    expect(engine.state.nodes[0].calls).toEqual([
      ['configure', { blockMs: null, preset: 'cheaper' }],
      [
        'schedule',
        {
          active: true,
          semitones: 0,
          formantCompensation: true,
          formantBaseHz: 180,
        },
      ],
      ['latency', undefined],
    ])
    expect(shifter.latencySec).toBe(0.085)
    expect(shifter.node).toBe(engine.state.nodes[0])
  })

  it('keeps the library preset when none is asked for', async () => {
    const { context } = fakeContext()

    await createPitchShifter(context, { formantCompensation: false })

    expect(engine.state.nodes[0].calls.map(([method]) => method)).toEqual([
      'schedule',
      'latency',
    ])
    expect(engine.state.nodes[0].calls[0][1]).toEqual({
      active: true,
      semitones: 0,
      formantCompensation: false,
      formantBaseHz: 0,
    })
  })

  it('reads a latency the engine cannot report as zero', async () => {
    const { context } = fakeContext()
    engine.state.nextLatency = undefined

    const shifter = await createPitchShifter(context, {
      formantCompensation: false,
    })

    expect(shifter.latencySec).toBe(0)
  })

  it('schedules a semitone change now, or at the context time it is given', async () => {
    const { context } = fakeContext()
    const shifter = await createPitchShifter(context, {
      formantCompensation: false,
    })

    shifter.setSemitones(3, 12.5)
    shifter.setSemitones(-2)

    expect(engine.state.nodes[0].calls.slice(-2)).toEqual([
      ['schedule', { semitones: 3, output: 12.5 }],
      ['schedule', { semitones: -2 }],
    ])
  })

  it('stops and disconnects the engine on dispose, keeping it for the next shifter', async () => {
    const { context } = fakeContext()
    const shifter = await createPitchShifter(context, {
      formantCompensation: false,
    })

    shifter.dispose()

    const node = engine.state.nodes[0]
    expect(node.calls.at(-1)).toEqual(['stop', undefined])
    expect(node.disconnected).toBe(true)
    expect(node.port.close).not.toHaveBeenCalled()
  })

  it('hands a released node to the next shifter on the same context', async () => {
    // The engine never tells Web Audio it has finished, so a node lives as
    // long as its context. The Jam context lives as long as the tab, and a
    // stage is built again on every visit to the tab: without reuse, each
    // visit would leave two more engines behind.
    const { context } = fakeContext()
    const first = await createPitchShifter(context, {
      formantCompensation: false,
      preset: 'cheaper',
    })
    first.dispose()

    const second = await createPitchShifter(context, {
      formantCompensation: true,
      formantBaseHz: 180,
      preset: 'cheaper',
    })

    expect(engine.factory).toHaveBeenCalledTimes(1)
    expect(second.node).toBe(first.node)
    expect(second.latencySec).toBe(0.085)
    // Started afresh with the new shifter's settings, not the old one's.
    expect(engine.state.nodes[0].calls.slice(-3)).toEqual([
      ['configure', presetConfig('cheaper')],
      [
        'schedule',
        startChange({ formantCompensation: true, formantBaseHz: 180 }),
      ],
      ['latency', undefined],
    ])
  })

  it('never hands one context’s node to another', async () => {
    const one = fakeContext()
    const two = fakeContext()
    const first = await createPitchShifter(one.context, {
      formantCompensation: false,
    })
    first.dispose()

    const second = await createPitchShifter(two.context, {
      formantCompensation: false,
    })

    expect(engine.factory).toHaveBeenCalledTimes(2)
    expect(second.node).not.toBe(first.node)
  })

  it('no longer drives an engine it has given back', async () => {
    // Given back, the engine may already be the next shifter's.
    const { context } = fakeContext()
    const shifter = await createPitchShifter(context, {
      formantCompensation: false,
    })
    shifter.dispose()
    const node = engine.state.nodes[0]
    const before = node.calls.length

    shifter.setSemitones(4)

    expect(node.calls).toHaveLength(before)
  })

  it('takes a node back once, however often it is disposed', async () => {
    const { context } = fakeContext()
    const shifter = await createPitchShifter(context, {
      formantCompensation: false,
    })
    shifter.dispose()
    shifter.dispose()

    const a = await createPitchShifter(context, { formantCompensation: false })
    const b = await createPitchShifter(context, { formantCompensation: false })

    expect(a.node).not.toBe(b.node)
    expect(engine.factory).toHaveBeenCalledTimes(2)
  })

  it('tries the worklet load again after a failed attempt', async () => {
    const addModule = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined)
    const { context } = fakeContext(addModule)

    await expect(
      createPitchShifter(context, { formantCompensation: false }),
    ).rejects.toThrow('network down')
    await expect(
      createPitchShifter(context, { formantCompensation: false }),
    ).resolves.toBeDefined()
    expect(addModule).toHaveBeenCalledTimes(2)
  })

  it('gives up on an engine that never reports ready', async () => {
    // Resolve the lazy import first, so only the engine is left pending.
    await import('signalsmith-stretch')
    vi.useFakeTimers()
    const { context } = fakeContext()
    engine.state.hang = true

    const pending = createPitchShifter(context, { formantCompensation: false })
    const settled = expect(pending).rejects.toThrow(/did not start/)
    await vi.advanceTimersByTimeAsync(10_000)

    await settled
  })

  it('counts the start deadline only while the context runs', async () => {
    // A suspended context does not run the audio thread the engine starts on,
    // and a song is loaded well before anyone presses play.
    await import('signalsmith-stretch')
    vi.useFakeTimers()
    const { context, setState } = fakeContext(undefined, 'suspended')
    engine.state.hang = true
    let outcome = 'pending'
    createPitchShifter(context, { formantCompensation: false }).catch(() => {
      outcome = 'gave up'
    })

    await vi.advanceTimersByTimeAsync(60_000)
    expect(outcome).toBe('pending')

    setState('running')
    await vi.advanceTimersByTimeAsync(9_000)
    expect(outcome).toBe('pending')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(outcome).toBe('gave up')
  })

  it('reports no support without AudioWorklet', async () => {
    const context = {} as BaseAudioContext

    expect(canShiftPitch(context)).toBe(false)
    await expect(
      createPitchShifter(context, { formantCompensation: false }),
    ).rejects.toThrow(/AudioWorklet/)
    expect(engine.factory).not.toHaveBeenCalled()
  })

  it('reports support when the context has a worklet and the node class exists', () => {
    expect(canShiftPitch(fakeContext().context)).toBe(true)
    vi.stubGlobal('AudioWorkletNode', undefined)
    expect(canShiftPitch(fakeContext().context)).toBe(false)
  })
})
