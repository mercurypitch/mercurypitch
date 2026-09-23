// The key shift graph routes each bus through the shifter, or straight past it.
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftGraph, KeyShiftState } from './key-shift-graph'
import { createKeyShiftGraph } from './key-shift-graph'
import type { PitchShifter, PitchShifterOptions } from './pitch-shift-node'

// ── Stateful fakes: nodes remember their edges, params their automation ──

type ParamEvent =
  | ['set', number, number]
  | ['ramp', number, number]
  | ['cancel', number]

class FakeParam {
  readonly events: ParamEvent[] = []
  constructor(public value: number) {}
  setValueAtTime(value: number, time: number) {
    this.events.push(['set', value, time])
    return this
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.events.push(['ramp', value, time])
    return this
  }
  cancelScheduledValues(time: number) {
    this.events.push(['cancel', time])
    return this
  }
  /** The value the automation settles on once every event has run. */
  settled(): number {
    let value = this.value
    for (const event of this.events) if (event[0] !== 'cancel') value = event[1]
    return value
  }
}

class FakeNode {
  readonly outputs = new Set<FakeNode>()
  constructor(readonly name: string) {}
  connect(target: FakeNode) {
    this.outputs.add(target)
    return target
  }
  disconnect(target?: FakeNode) {
    if (target === undefined) {
      this.outputs.clear()
      return
    }
    // A real node throws InvalidAccessError here; the graph must not.
    if (!this.outputs.has(target))
      throw new Error(`${this.name} is not connected to ${target.name}`)
    this.outputs.delete(target)
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1)
}

class FakeDelay extends FakeNode {
  readonly delayTime = new FakeParam(0)
  constructor(readonly maxDelayTime: number) {
    super('delay')
  }
}

interface FakeContext {
  currentTime: number
  readonly gains: FakeGain[]
  readonly delays: FakeDelay[]
  readonly audioWorklet: { addModule: () => Promise<void> }
  createGain(): FakeGain
  createDelay(max: number): FakeDelay
}

function fakeContext(): FakeContext {
  const gains: FakeGain[] = []
  const delays: FakeDelay[] = []
  return {
    currentTime: 10,
    gains,
    delays,
    audioWorklet: { addModule: () => Promise.resolve() },
    createGain() {
      const gain = new FakeGain(`gain${gains.length}`)
      gains.push(gain)
      return gain
    },
    createDelay(max: number) {
      const delay = new FakeDelay(max)
      delays.push(delay)
      return delay
    },
  }
}

interface FakeShifter extends PitchShifter {
  readonly fakeNode: FakeNode
  readonly options: PitchShifterOptions
  readonly semitones: number[]
  readonly dispose: Mock<() => void>
}

const LATENCY = 0.12

function fakeFactory() {
  const made: FakeShifter[] = []
  const create = vi.fn(
    (_ctx: BaseAudioContext, options: PitchShifterOptions) => {
      const fakeNode = new FakeNode(
        options.formantCompensation ? 'vocal-shifter' : 'pitched-shifter',
      )
      const semitones: number[] = []
      const shifter: FakeShifter = {
        fakeNode,
        node: fakeNode as unknown as AudioNode,
        latencySec: LATENCY,
        options,
        semitones,
        setSemitones: (value: number) => {
          semitones.push(value)
        },
        dispose: vi.fn<() => void>(),
      }
      made.push(shifter)
      return Promise.resolve(shifter as PitchShifter)
    },
  )
  const byBus = (formant: boolean) => {
    const found = made.find((s) => s.options.formantCompensation === formant)
    if (found === undefined) throw new Error('shifter was never made')
    return found
  }
  return {
    create,
    made,
    pitched: () => byBus(false),
    vocal: () => byBus(true),
  }
}

// ── Topology helpers ──

function reaches(from: FakeNode, to: FakeNode, seen = new Set<FakeNode>()) {
  if (from === to) return true
  if (seen.has(from)) return false
  seen.add(from)
  for (const next of from.outputs) if (reaches(next, to, seen)) return true
  return false
}

function passesThrough(from: FakeNode, via: FakeNode, to: FakeNode) {
  return reaches(from, via) && reaches(via, to)
}

const still = (semitones: number, vocalAudible = true): KeyShiftState => ({
  semitones,
  vocalAudible,
  playing: false,
})

describe('stem key graph', () => {
  let ctx: FakeContext
  let destination: FakeNode
  let factory: ReturnType<typeof fakeFactory>
  let onError: Mock<(error: unknown) => void>
  let graph: KeyShiftGraph

  const bus = (name: 'pitched' | 'vocal' | 'unpitched') =>
    graph.input(name) as unknown as FakeNode
  const output = () => {
    const out = ctx.gains.find((gain) => gain.outputs.has(destination))
    if (out === undefined) throw new Error('nothing reaches the destination')
    return out
  }

  beforeEach(() => {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    ctx = fakeContext()
    destination = new FakeNode('destination')
    factory = fakeFactory()
    onError = vi.fn<(error: unknown) => void>()
    graph = createKeyShiftGraph(
      ctx as unknown as AudioContext,
      destination as unknown as AudioNode,
      { preset: 'default', onError, createShifter: factory.create },
    )
  })

  afterEach(() => {
    graph.dispose()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('starts bypassed: every bus goes straight to the output, with no latency', () => {
    for (const name of ['pitched', 'vocal', 'unpitched'] as const)
      expect(bus(name).outputs).toEqual(new Set([output()]))
    expect(graph.latencySec()).toBe(0)
    expect(graph.available()).toBe(true)
    expect(factory.create).not.toHaveBeenCalled()
  })

  it('shifts the pitched bus, parks a silent vocal and delays drums by the latency', async () => {
    await graph.apply(still(2, false))

    const pitched = factory.pitched()
    expect(passesThrough(bus('pitched'), pitched.fakeNode, output())).toBe(true)
    expect(bus('pitched').outputs.has(output())).toBe(false)
    expect(pitched.semitones.at(-1)).toBe(2)
    expect(reaches(bus('vocal'), output())).toBe(false)
    expect(ctx.delays).toHaveLength(1)
    expect(ctx.delays[0].delayTime.value).toBe(LATENCY)
    expect(passesThrough(bus('unpitched'), ctx.delays[0], output())).toBe(true)
    expect(graph.latencySec()).toBe(LATENCY)
  })

  it('makes the guide vocal shifter with formant compensation', async () => {
    await graph.apply(still(-3, true))

    const vocal = factory.vocal()
    expect(vocal.options).toMatchObject({
      formantCompensation: true,
      formantBaseHz: 0,
      preset: 'default',
    })
    expect(factory.pitched().options).toMatchObject({
      formantCompensation: false,
      preset: 'default',
    })
    expect(passesThrough(bus('vocal'), vocal.fakeNode, output())).toBe(true)
    expect(vocal.semitones.at(-1)).toBe(-3)
  })

  it('goes back to the bypass at 0 without making new shifters', async () => {
    await graph.apply(still(2))
    await graph.apply(still(0))

    for (const name of ['pitched', 'vocal', 'unpitched'] as const)
      expect(bus(name).outputs).toEqual(new Set([output()]))
    expect(graph.latencySec()).toBe(0)

    await graph.apply(still(1))
    expect(factory.create).toHaveBeenCalledTimes(2)
  })

  it('reports the shift the audio is under right now', async () => {
    expect(graph.shiftSemitones()).toBe(0)

    await graph.apply(still(2.5))
    expect(graph.shiftSemitones()).toBe(2.5)

    await graph.apply(still(0))
    expect(graph.shiftSemitones()).toBe(0)
  })

  it('moves the shift in place while already shifted', async () => {
    await graph.apply(still(2))
    const eventsBefore = output().gain.events.length

    await graph.apply({ semitones: -1, vocalAudible: true, playing: true })

    expect(factory.pitched().semitones.at(-1)).toBe(-1)
    expect(factory.vocal().semitones.at(-1)).toBe(-1)
    expect(output().gain.events.length).toBe(eventsBefore)
    expect(factory.create).toHaveBeenCalledTimes(2)
  })

  it('settles on the latest request when several arrive at once', async () => {
    void graph.apply(still(2))
    void graph.apply(still(4))
    await graph.apply(still(3))

    expect(factory.create).toHaveBeenCalledTimes(2)
    expect(factory.pitched().semitones.at(-1)).toBe(3)
    expect(graph.latencySec()).toBe(LATENCY)
  })

  it('dips the output around a re-route while playing, then comes back up', async () => {
    vi.useFakeTimers()
    const playing: KeyShiftState = {
      semitones: 2,
      vocalAudible: true,
      playing: true,
    }

    const applied = graph.apply(playing)
    await vi.advanceTimersByTimeAsync(0)

    // Still on the old route while the gain ramps down.
    expect(bus('pitched').outputs.has(output())).toBe(true)
    expect(output().gain.events).toContainEqual(['ramp', 0, 10.015])

    ctx.currentTime = 10.03
    await vi.advanceTimersByTimeAsync(30)
    await applied

    expect(bus('pitched').outputs.has(output())).toBe(false)
    const last = output().gain.events.at(-1)
    expect(last?.[0]).toBe('ramp')
    expect(last?.[1]).toBe(1)
    // Held silent until the shifter's first fresh output, then 15 ms up.
    expect(last?.[2]).toBeCloseTo(10.03 + LATENCY + 0.015, 6)
    expect(output().gain.settled()).toBe(1)
  })

  it('holds a returning guide vocal silent until the shifter has flushed', async () => {
    await graph.apply(still(2, false))
    ctx.currentTime = 20

    await graph.apply(still(2, true))

    const vocal = factory.vocal()
    expect(passesThrough(bus('vocal'), vocal.fakeNode, output())).toBe(true)
    const vocalOut = [...vocal.fakeNode.outputs][0] as FakeGain
    expect(vocalOut.gain.events).toContainEqual(['set', 0, 20])
    expect(vocalOut.gain.events.at(-1)).toEqual([
      'ramp',
      1,
      20 + LATENCY + 0.015,
    ])
  })

  it('keeps the original key when the engine will not load, and says so once', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('no wasm')))
    graph.dispose()
    graph = createKeyShiftGraph(
      ctx as unknown as AudioContext,
      destination as unknown as AudioNode,
      { preset: 'default', onError, createShifter: failing },
    )

    await graph.apply(still(3))
    await graph.apply(still(-2))

    for (const name of ['pitched', 'vocal', 'unpitched'] as const)
      expect(bus(name).outputs).toEqual(new Set([output()]))
    expect(graph.available()).toBe(false)
    expect(graph.latencySec()).toBe(0)
    expect(graph.shiftSemitones()).toBe(0)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('is unavailable from the start without AudioWorklet', async () => {
    vi.stubGlobal('AudioWorkletNode', undefined)
    graph.dispose()
    graph = createKeyShiftGraph(
      ctx as unknown as AudioContext,
      destination as unknown as AudioNode,
      { preset: 'default', onError, createShifter: factory.create },
    )

    expect(graph.available()).toBe(false)
    await graph.apply(still(2))
    expect(factory.create).not.toHaveBeenCalled()
    expect(bus('pitched').outputs).toEqual(new Set([output()]))
  })

  it('releases the shifters on dispose', async () => {
    await graph.apply(still(2))
    const out = output()

    graph.dispose()
    graph.dispose()

    for (const shifter of factory.made)
      expect(shifter.dispose).toHaveBeenCalledTimes(1)
    expect(out.outputs.size).toBe(0)
  })
})
