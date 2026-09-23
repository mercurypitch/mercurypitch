// Every peer shifts its own backing and guide vocal to the room's key.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBus, KeyShiftGraph, KeyShiftGraphOptions, KeyShiftState, } from '@/lib/key-shift/key-shift-graph'
import { createJamKeyShift, heardPositionSec, heardRoomKey, } from './jam-key-shift'

interface FakeGraph extends KeyShiftGraph {
  readonly ctx: AudioContext
  readonly destination: AudioNode
  readonly options: KeyShiftGraphOptions
  readonly applied: KeyShiftState[]
  latency: number
  shift: number
  disposed: boolean
}

function fakeGraphs(available = true) {
  const made: FakeGraph[] = []
  const create = (
    ctx: AudioContext,
    destination: AudioNode,
    options: KeyShiftGraphOptions,
  ): KeyShiftGraph => {
    const buses = {
      pitched: { bus: 'pitched' },
      vocal: { bus: 'vocal' },
      unpitched: { bus: 'unpitched' },
    } as unknown as Record<KeyShiftBus, AudioNode>
    const graph: FakeGraph = {
      ctx,
      destination,
      options,
      applied: [],
      latency: 0,
      shift: 0,
      disposed: false,
      input: (bus) => buses[bus],
      apply: (state) => {
        graph.applied.push(state)
        return Promise.resolve()
      },
      latencySec: () => graph.latency,
      shiftSemitones: () => graph.shift,
      available: () => available,
      dispose: () => {
        graph.disposed = true
      },
    }
    made.push(graph)
    return graph
  }
  return { create, made }
}

const context = (name: string) =>
  ({
    name,
    destination: { name: `${name} speakers` },
  }) as unknown as AudioContext

const STATE: KeyShiftState = { semitones: 2, vocalAudible: true, playing: true }

function setup(available = true) {
  const graphs = fakeGraphs(available)
  const onUnavailable = vi.fn<(error?: unknown) => void>()
  const key = createJamKeyShift({
    preset: 'cheaper',
    onUnavailable,
    createGraph: graphs.create,
  })
  return { key, graphs, onUnavailable }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createJamKeyShift', () => {
  it('makes one graph per context, when the backing or the guide first asks where to go', () => {
    const { key, graphs } = setup()
    const ctx = context('a')

    const backing = key.backingOutput(ctx)
    const guide = key.guideOutput(ctx)

    expect(graphs.made).toHaveLength(1)
    const [graph] = graphs.made
    expect(graph.destination).toBe(ctx.destination)
    expect(graph.options.preset).toBe('cheaper')
    expect(backing).toBe(graph.input('pitched'))
    expect(guide).toBe(graph.input('vocal'))
  })

  it('tells a graph made later the state it missed, then every change', () => {
    const { key, graphs } = setup()
    key.apply(STATE)

    key.backingOutput(context('a'))
    key.apply({ ...STATE, semitones: -1 })

    expect(graphs.made[0].applied).toEqual([STATE, { ...STATE, semitones: -1 }])
  })

  it('reports the graph’s latency and live shift, and nothing before it exists', () => {
    const { key, graphs } = setup()
    expect(key.latencySec()).toBe(0)
    expect(key.shiftSemitones()).toBe(0)

    key.backingOutput(context('a'))
    graphs.made[0].latency = 0.14
    graphs.made[0].shift = 2

    expect(key.latencySec()).toBe(0.14)
    expect(key.shiftSemitones()).toBe(2)
  })

  it('lets the old graph go when the engine’s context is replaced', () => {
    const { key, graphs } = setup()
    key.backingOutput(context('a'))

    key.guideOutput(context('b'))

    expect(graphs.made).toHaveLength(2)
    expect(graphs.made[0].disposed).toBe(true)
    expect(graphs.made[1].disposed).toBe(false)
  })

  it('says why when the engine fails to load', () => {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    const { key, graphs, onUnavailable } = setup()
    key.backingOutput(context('a'))
    expect(key.available()).toBe(true)

    const failure = new Error('worklet failed')
    graphs.made[0].options.onError?.(failure)

    expect(key.available()).toBe(false)
    expect(onUnavailable.mock.calls).toEqual([[failure]])
  })

  it('goes quiet about a device that cannot shift at all', () => {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    const { key, onUnavailable } = setup(false)

    key.backingOutput(context('a'))

    expect(key.available()).toBe(false)
    expect(onUnavailable.mock.calls).toEqual([[undefined]])
  })

  it('plays the original key through the speakers when the graph cannot be made', () => {
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    const failure = new Error('no nodes left')
    const onUnavailable = vi.fn<(error?: unknown) => void>()
    const key = createJamKeyShift({
      preset: 'cheaper',
      onUnavailable,
      createGraph: () => {
        throw failure
      },
    })
    const ctx = context('a')

    expect(key.backingOutput(ctx)).toBe(ctx.destination)
    expect(key.guideOutput(ctx)).toBe(ctx.destination)
    expect(key.available()).toBe(false)
    expect(onUnavailable.mock.calls).toEqual([[failure]])
  })

  it('lets its graph go when the stage does', () => {
    const { key, graphs } = setup()
    key.backingOutput(context('a'))

    key.dispose()

    expect(graphs.made[0].disposed).toBe(true)
    expect(key.latencySec()).toBe(0)
  })
})

describe('heardPositionSec', () => {
  it('trails the element by the shifter while the song plays', () => {
    expect(heardPositionSec(10, 0.12, true)).toBeCloseTo(9.88)
  })

  it('is the element’s own position while nothing sounds', () => {
    // A host who clicks a line while paused lands on that line, not on the
    // tail of the one before it.
    expect(heardPositionSec(10, 0.12, false)).toBe(10)
  })

  it('never runs before the start of the song', () => {
    expect(heardPositionSec(0.05, 0.12, true)).toBe(0)
  })
})

describe('heardRoomKey', () => {
  // What is drawn and scored, and what the key graph is told, must be the
  // key this device actually plays -- or the guide comes out in the room's
  // key over a backing in the original one.
  it('is the room’s key once the backing goes through the key graph', () => {
    expect(heardRoomKey(3, { available: true, backingInGraph: true })).toBe(3)
  })

  it('is the original key while the backing still plays natively', () => {
    expect(heardRoomKey(3, { available: true, backingInGraph: false })).toBe(0)
  })

  it('is the original key where the key cannot change', () => {
    expect(heardRoomKey(-2, { available: false, backingInGraph: true })).toBe(0)
  })
})
