// The stem key control keeps the key graph in step with the key, speed and vocal.
import { createRoot, createSignal } from 'solid-js'
import type { Mock } from 'vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { KeyShiftBus, KeyShiftGraph, KeyShiftGraphOptions, KeyShiftState, } from '@/lib/key-shift/key-shift-graph'
import { busForTrack, createStemKeyControl } from './stem-key-control'

interface FakeGraph extends KeyShiftGraph {
  readonly applied: KeyShiftState[]
  readonly options: KeyShiftGraphOptions
  readonly buses: Record<KeyShiftBus, AudioNode>
  fail(error: unknown): void
  readonly dispose: Mock<() => void>
}

function fakeGraphFactory() {
  const graphs: FakeGraph[] = []
  const create = vi.fn(
    (
      _ctx: AudioContext,
      _destination: AudioNode,
      options: KeyShiftGraphOptions,
    ) => {
      let available = true
      const applied: KeyShiftState[] = []
      const buses = {
        pitched: { bus: 'pitched' } as unknown as AudioNode,
        vocal: { bus: 'vocal' } as unknown as AudioNode,
        unpitched: { bus: 'unpitched' } as unknown as AudioNode,
      }
      const graph: FakeGraph = {
        applied,
        options,
        buses,
        input: (bus) => buses[bus],
        apply: (state) => {
          applied.push(state)
          return Promise.resolve()
        },
        latencySec: () => (available ? 0.12 : 0),
        shiftSemitones: () =>
          available ? (applied.at(-1)?.semitones ?? 0) : 0,
        available: () => available,
        fail: (error) => {
          available = false
          options.onError?.(error)
        },
        dispose: vi.fn<() => void>(),
      }
      graphs.push(graph)
      return graph
    },
  )
  return { create, graphs }
}

interface Initial {
  key?: number
  speed?: number
  suspended?: boolean
  playing?: boolean
}

function setup(initial: Initial = {}) {
  const [key, setKey] = createSignal(initial.key ?? 0)
  const [playing, setPlaying] = createSignal(initial.playing ?? true)
  const [speed, setSpeed] = createSignal(initial.speed ?? 1)
  const [suspended, setSuspended] = createSignal(initial.suspended ?? false)
  const [vocalAudible, setVocalAudible] = createSignal(true)
  const [keepDrums, setKeepDrums] = createSignal(true)
  const factory = fakeGraphFactory()
  const onUnavailable = vi.fn()
  let dispose = () => {}
  const control = createRoot((disposeRoot) => {
    dispose = disposeRoot
    return createStemKeyControl({
      keyShift: key,
      suspended,
      vocalAudible,
      speed,
      playing,
      keepDrums,
      preset: 'cheaper',
      onUnavailable,
      createGraph: factory.create,
    })
  })
  const context = {} as AudioContext
  const destination = {} as AudioNode
  const attach = () => control.attach(context, destination)
  return {
    control,
    factory,
    onUnavailable,
    attach,
    graph: () => {
      const graph = factory.graphs.at(-1)
      if (graph === undefined) throw new Error('no graph yet')
      return graph
    },
    setKey,
    setSpeed,
    setSuspended,
    setVocalAudible,
    setKeepDrums,
    setPlaying,
    dispose,
  }
}

let active: ReturnType<typeof setup> | null = null
const start = (initial?: Parameters<typeof setup>[0]) => {
  active = setup(initial)
  return active
}

afterEach(() => {
  active?.dispose()
  active = null
})

describe('stem key control', () => {
  it('sends the speed-compensated shift once attached', () => {
    const t = start({ key: 2, speed: 0.5 })

    t.attach()

    expect(t.graph().options.preset).toBe('cheaper')
    expect(t.graph().applied.at(-1)).toEqual({
      semitones: 14,
      vocalAudible: true,
      playing: true,
    })
    expect(t.control.appliedKey()).toBe(2)
  })

  it('plays the original key in Pitch Studio, at any speed', () => {
    const t = start({ key: 3, speed: 0.75, suspended: true })

    t.attach()

    expect(t.graph().applied.at(-1)?.semitones).toBeCloseTo(
      -12 * Math.log2(0.75),
      9,
    )
    expect(t.control.appliedKey()).toBe(0)
  })

  it('follows the key, the speed and the guide vocal', () => {
    const t = start()
    t.attach()

    t.setKey(-2)
    expect(t.graph().applied.at(-1)?.semitones).toBe(-2)

    t.setSpeed(2)
    expect(t.graph().applied.at(-1)?.semitones).toBe(-14)

    t.setVocalAudible(false)
    expect(t.graph().applied.at(-1)?.vocalAudible).toBe(false)
  })

  it('clamps the key it is handed', () => {
    const t = start({ key: 9 })
    t.attach()

    expect(t.graph().applied.at(-1)?.semitones).toBe(6)
    expect(t.control.appliedKey()).toBe(6)
  })

  it('routes each track to its bus, drums by the setting', () => {
    const t = start()
    expect(t.control.busFor('Drums')).toBeNull()

    t.attach()
    const buses = t.graph().buses

    expect(t.control.busFor('Vocal')).toBe(buses.vocal)
    expect(t.control.busFor('Instrumental')).toBe(buses.pitched)
    expect(t.control.busFor('Drums')).toBe(buses.unpitched)
    t.setKeepDrums(false)
    expect(t.control.busFor('Drums')).toBe(buses.pitched)
  })

  it('makes one graph per context', () => {
    const t = start()

    t.attach()
    t.attach()
    expect(t.factory.create).toHaveBeenCalledTimes(1)

    const first = t.graph()
    t.control.attach({} as AudioContext, {} as AudioNode)
    expect(t.factory.create).toHaveBeenCalledTimes(2)
    expect(first.dispose).toHaveBeenCalledTimes(1)
  })

  it('goes unavailable, and says so once, when the engine fails', () => {
    const t = start({ key: 2 })
    t.attach()

    t.graph().fail(new Error('no wasm'))

    expect(t.control.available()).toBe(false)
    expect(t.control.appliedKey()).toBe(0)
    expect(t.onUnavailable).toHaveBeenCalledTimes(1)
    expect(t.control.latencySec()).toBe(0)
  })

  it('reads the graph latency and shift for the playback clock', () => {
    const t = start({ key: 1 })
    expect(t.control.latencySec()).toBe(0)
    expect(t.control.shiftSemitones()).toBe(0)

    t.attach()

    expect(t.control.latencySec()).toBe(0.12)
    expect(t.control.shiftSemitones()).toBe(1)
  })

  it('tells the graph when playback starts and stops', () => {
    // A shifter still loading when play is pressed must fade in, not cut in.
    const t = start({ key: 2, playing: false })
    t.attach()
    expect(t.graph().applied.at(-1)?.playing).toBe(false)

    t.setPlaying(true)

    expect(t.graph().applied.at(-1)).toEqual({
      semitones: 2,
      vocalAudible: true,
      playing: true,
    })
  })

  it('reads none of its inputs while it is being created', () => {
    // The mixer builds it before Pitch Studio's controller exists. In a
    // browser the engine is there, so nothing short-circuits the reads.
    vi.stubGlobal('AudioWorkletNode', vi.fn())
    const reads: string[] = []
    const read =
      <T>(name: string, value: T) =>
      () => {
        reads.push(name)
        return value
      }
    let readsDuringCreation: string[] = []
    const dispose = createRoot((disposeRoot) => {
      createStemKeyControl({
        keyShift: read('keyShift', 0),
        suspended: read('suspended', false),
        vocalAudible: read('vocalAudible', true),
        speed: read('speed', 1),
        playing: read('playing', false),
        keepDrums: read('keepDrums', true),
        preset: 'cheaper',
        onUnavailable: vi.fn(),
        createGraph: fakeGraphFactory().create,
      })
      readsDuringCreation = [...reads]
      return disposeRoot
    })
    dispose()
    vi.unstubAllGlobals()

    expect(readsDuringCreation).toEqual([])
  })

  it('disposes the graph with the control', () => {
    const t = start()
    t.attach()

    t.control.dispose()

    expect(t.graph().dispose).toHaveBeenCalledTimes(1)
  })
})

describe('busForTrack', () => {
  it('sends the guide vocal to the vocal bus', () => {
    expect(busForTrack('Vocal', true)).toBe('vocal')
  })

  it('keeps drums unshifted unless the setting says otherwise', () => {
    expect(busForTrack('Drums', true)).toBe('unpitched')
    expect(busForTrack('Drums', false)).toBe('pitched')
  })

  it('shifts every other stem, the generated MIDI track included', () => {
    for (const label of ['Instrumental', 'Bass', 'Guitar', 'Piano', 'Other'])
      expect(busForTrack(label, true)).toBe('pitched')
    expect(busForTrack('MIDI', true)).toBe('pitched')
  })
})
