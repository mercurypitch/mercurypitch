// Guitar amp facade tests pin bounded transitions, fallback and independent resource lifetimes.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGuitarAmpStage } from './guitar-amp-stage'

class Param {
  value = 0
  readonly setValueAtTime = vi.fn((value: number, _at: number) => {
    this.value = value
  })
  readonly setTargetAtTime = vi.fn(
    (value: number, _at: number, _timeConstant: number) => {
      this.value = value
    },
  )
  readonly cancelAndHoldAtTime = vi.fn()
  readonly cancelScheduledValues = vi.fn()
}
class Node {
  gain = new Param()
  frequency = new Param()
  Q = new Param()
  offset = new Param()
  connections = new Set<unknown>()
  curve: Float32Array | null = null
  buffer: AudioBuffer | null = null
  normalize = true
  disconnected = false
  type = ''
  oversample = ''
  connect(destination: unknown): unknown {
    this.connections.add(destination)
    return destination
  }
  disconnect(destination?: unknown): void {
    if (destination === undefined) {
      this.connections.clear()
      this.disconnected = true
    } else this.connections.delete(destination)
  }
  start(): void {}
  stop(): void {}
}

function audioContext() {
  const all: Node[] = []
  const make = (): Node => {
    const node = new Node()
    all.push(node)
    return node
  }
  const events = new EventTarget()
  const raw = {
    currentTime: 0,
    sampleRate: 48_000,
    state: 'running',
    createGain: make,
    createBiquadFilter: make,
    createWaveShaper: make,
    createConstantSource: make,
    createConvolver: make,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  }
  return { raw, all, events, context: raw as unknown as BaseAudioContext }
}
const studio = {
  engine: 'studio' as const,
  head: 'definition' as const,
  character: 1,
  drive: 0.7,
  bass: 0,
  mid: 0,
  treble: 0,
  presence: 0,
  output: 0.6,
}
const kernel = {
  sampleRate: 48_000,
  duration: 1.19625,
  numberOfChannels: 1,
} as AudioBuffer
afterEach(() => {
  vi.useRealTimers()
})

describe('owned guitar amp facade', () => {
  it('keeps Lite and bypass asset-free, without creating a context or source', () => {
    const { context, all } = audioContext()
    const load = vi.fn()
    const lite = createGuitarAmpStage(context, {}, { loadCabinet: load })
    const bypass = createGuitarAmpStage(
      context,
      { ...studio, enabled: false },
      { loadCabinet: load },
    )

    expect(load).not.toHaveBeenCalled()
    expect(lite.getStatus()).toBe('lite')
    expect(bypass.getStatus()).toBe('bypassed')
    expect(bypass.nodes).toHaveLength(3)
    lite.dispose()
    bypass.dispose()
    expect(all.every((node) => node.disconnected)).toBe(true)
  })

  it('keeps working Lite after asset failure and never revives a disposed owner', async () => {
    const first = audioContext()
    const fallback = createGuitarAmpStage(first.context, studio, {
      loadCabinet: () => Promise.reject(new Error('offline')),
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(fallback.getStatus()).toBe('fallback')
    expect(fallback.nodes.length).toBeGreaterThan(3)

    const second = audioContext()
    let finish!: (buffer: AudioBuffer) => void
    const pending = createGuitarAmpStage(second.context, studio, {
      loadCabinet: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    pending.dispose()
    const count = second.all.length
    finish(kernel)
    await Promise.resolve()
    expect(second.all).toHaveLength(count)
    expect(second.all.every((node) => node.disconnected)).toBe(true)
    fallback.dispose()
  })

  it('coalesces held character drags into at most two prepared processors and settles on the latest choice', () => {
    vi.useFakeTimers()
    const { context, raw, all } = audioContext()
    const stage = createGuitarAmpStage(context, studio, {
      cabinetBuffer: kernel,
    })
    const ports = [stage.input, stage.output]
    const initialSize = stage.nodes.length
    stage.setParameters({ character: 0.2 })
    const pairSize = stage.nodes.length
    for (let value = 0; value <= 1; value += 0.01)
      stage.setParameters({ character: value })
    stage.setParameters({ character: 0.8 })
    expect(stage.nodes.length).toBe(pairSize)
    expect(pairSize).toBeLessThan(initialSize * 2)

    raw.currentTime = 1
    vi.advanceTimersByTime(25)
    raw.currentTime = 2
    vi.advanceTimersByTime(25)
    expect(stage.nodes).toHaveLength(initialSize)
    expect(stage.getParameters().character).toBe(0.8)
    expect([stage.input, stage.output]).toEqual(ports)
    stage.dispose()
    stage.dispose()
    expect(all.every((node) => node.disconnected)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps a working wet path when re-enabled during a pending character transition', () => {
    vi.useFakeTimers()
    const { context } = audioContext()
    const stage = createGuitarAmpStage(context, studio, {
      cabinetBuffer: kernel,
    })
    stage.setParameters({ character: 0 })
    stage.setBypassed(true)
    stage.setParameters({ character: 0.7 })
    stage.setBypassed(false)

    // Current slot is first in the facade list; its final node is its wet gate.
    const wetGates = (stage.nodes as unknown as Node[]).filter((node) =>
      node.connections.has(stage.output),
    )
    expect(wetGates.map((node) => node.gain.value)).toContain(1)
    expect(stage.getParameters().enabled).toBe(true)
    stage.dispose()
  })

  it.each(['suspended', 'interrupted'])(
    'parks an unfinished fade in %s without polling and disposes its resume listener',
    (state) => {
      vi.useFakeTimers()
      const { context, raw, events, all } = audioContext()
      const stage = createGuitarAmpStage(context, studio, {
        cabinetBuffer: kernel,
      })
      stage.setParameters({ character: 0 })
      const count = stage.nodes.length
      raw.state = state
      vi.advanceTimersByTime(25)
      expect(stage.nodes).toHaveLength(count)
      expect(vi.getTimerCount()).toBe(0)
      raw.state = state === 'suspended' ? 'interrupted' : 'suspended'
      events.dispatchEvent(new Event('statechange'))
      expect(vi.getTimerCount()).toBe(0)
      raw.currentTime = 1
      raw.state = 'running'
      events.dispatchEvent(new Event('statechange'))
      expect(stage.nodes.length).toBeLessThan(count)
      stage.dispose()
      events.dispatchEvent(new Event('statechange'))
      expect(all.every((node) => node.disconnected)).toBe(true)
      expect(vi.getTimerCount()).toBe(0)
    },
  )

  it('retains full kernel and fixed trim, with drive before the head and output after the cabinet', () => {
    const { context, all } = audioContext()
    const stage = createGuitarAmpStage(context, studio, {
      cabinetBuffer: kernel,
    })
    const convolver = all.find((node) => node.buffer === kernel)
    expect(convolver).toBeDefined()
    expect(convolver!.normalize).toBe(false)
    const output = [...convolver!.connections][0] as Node
    expect(output.gain.value).toBeCloseTo(10 ** (-18 / 20), 12)
    stage.setParameters({ output: 1 })
    expect(output.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      10 ** (-10 / 20),
      0,
      0.012,
    )
    stage.dispose()
    expect(convolver!.buffer).toBeNull()
  })

  it('keeps dry audible until a newly enabled head warms, and honors future transition times', () => {
    vi.useFakeTimers()
    const { context } = audioContext()
    const stage = createGuitarAmpStage(
      context,
      { ...studio, enabled: false },
      { cabinetBuffer: kernel },
    )
    const dry = stage.nodes[2] as unknown as Node
    stage.setParameters({ enabled: true }, 2)
    const gate = stage.nodes.at(-1) as unknown as Node
    expect(dry.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 2, 0.012)
    expect(gate.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 2, 0.012)
    expect(dry.gain.setTargetAtTime.mock.calls.every(([, at]) => at >= 2)).toBe(
      true,
    )
    stage.dispose()
  })

  it('disposes a prepared processor if its gate allocation fails before falling back', () => {
    vi.useFakeTimers()
    const { context, raw, all } = audioContext()
    const stage = createGuitarAmpStage(context, studio, {
      cabinetBuffer: kernel,
    })
    const before = all.length
    const processorSize = stage.nodes.length - 4
    const originalGain = raw.createGain
    let injected = false
    raw.createGain = () => {
      if (!injected && all.length === before + processorSize) {
        injected = true
        throw new Error('Gate allocation failed')
      }
      return originalGain()
    }
    stage.setParameters({ character: 0 })
    expect(injected).toBe(true)
    expect(stage.getStatus()).toBe('fallback')
    expect(
      all
        .slice(before, before + processorSize)
        .every((node) => node.disconnected),
    ).toBe(true)
    stage.dispose()
    expect(all.every((node) => node.disconnected)).toBe(true)
  })

  it('releases already allocated ports if the output port cannot be created', () => {
    const { context, raw, all } = audioContext()
    const originalGain = raw.createGain
    raw.createGain = () => {
      if (all.length === 1) throw new Error('Output port failed')
      return originalGain()
    }
    expect(() => createGuitarAmpStage(context, studio)).toThrow(
      'Output port failed',
    )
    expect(all).toHaveLength(1)
    expect(all[0]?.disconnected).toBe(true)
  })
})
