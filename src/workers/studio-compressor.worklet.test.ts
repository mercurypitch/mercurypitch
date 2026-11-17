// Studio compressor worklet tests — the processor declares a DynamicsCompressorNode's parameters, compresses each render quantum at the values they have for it, and runs on until its unit is disposed.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compressorStaticOutputDb } from '@/lib/studio-fx/compressor-curve'
import { COMPRESSOR_PARAMETERS, STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from '@/lib/studio-fx/compressor-kernel'
import { dbToGain, gainToDb } from '@/lib/studio-fx/dsp'

type Parameters = Record<string, Float32Array>

interface Processor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Parameters,
  ): boolean
}

type ProcessorClass = (new () => Processor) & {
  readonly parameterDescriptors: unknown
}

/** Load the worklet with a fake audio thread: its processor class, and a way to post to the one made. */
async function loadWorklet() {
  const port = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: vi.fn(),
  }
  const registered = new Map<string, ProcessorClass>()
  vi.stubGlobal('sampleRate', 48000)
  vi.stubGlobal(
    'AudioWorkletProcessor',
    class {
      port = port
    },
  )
  vi.stubGlobal(
    'registerProcessor',
    (name: string, processor: ProcessorClass) =>
      void registered.set(name, processor),
  )
  vi.resetModules()
  await import('./studio-compressor.worklet')
  const send = (data: unknown) => port.onmessage?.({ data })
  return { registered, send }
}

/** A DynamicsCompressorNode's parameters as a processor reads them for one quantum: each one value, k-rate. */
function parameters(over: Partial<Record<string, number>> = {}): Parameters {
  const values: Record<string, number> = {
    threshold: -20,
    knee: 6,
    ratio: 2,
    attack: 0.015,
    release: 0.18,
    ...over,
  }
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      name,
      new Float32Array([value]),
    ]),
  )
}

/** `quanta` render quanta of a square wave at `levelDb` through `processor`, one channel in; both sides of what came out of the last. */
function play(
  processor: Processor,
  levelDb: number,
  quanta: number,
  params: Parameters | ((quantum: number) => Parameters) = parameters(),
) {
  const amplitude = dbToGain(levelDb)
  const input = Float32Array.from({ length: 128 }, (_, i) =>
    i < 64 ? amplitude : -amplitude,
  )
  const output = [new Float32Array(128), new Float32Array(128)]
  let running = true
  for (let quantum = 0; quantum < quanta; quantum++)
    running = processor.process(
      [[input]],
      [output],
      typeof params === 'function' ? params(quantum) : params,
    )
  const gainDb = (side: Float32Array) => gainToDb(side[0] / input[0])
  return { running, left: gainDb(output[0]), right: gainDb(output[1]) }
}

afterEach(() => vi.unstubAllGlobals())

describe('Studio compressor worklet', () => {
  it("registers under the compressor's name with a DynamicsCompressorNode's parameters, read once a render quantum", async () => {
    const { registered } = await loadWorklet()

    const Processor = registered.get(STUDIO_COMPRESSOR_PROCESSOR)

    expect(Processor?.parameterDescriptors).toEqual(COMPRESSOR_PARAMETERS)
    expect(COMPRESSOR_PARAMETERS.map((p) => [p.name, p.defaultValue])).toEqual([
      ['threshold', -24],
      ['knee', 30],
      ['ratio', 12],
      ['attack', 0.003],
      ['release', 0.25],
    ])
    expect(
      COMPRESSOR_PARAMETERS.every((p) => p.automationRate === 'k-rate'),
    ).toBe(true)
  })

  it('compresses a steady level to the static curve at the parameters it is given, on both sides', async () => {
    const { registered } = await loadWorklet()
    const processor = new (registered.get(STUDIO_COMPRESSOR_PROCESSOR)!)()

    const heard = play(processor, -6, 375)

    const expected = compressorStaticOutputDb(-6, -20, 6, 2) + 6
    expect(heard.left).toBeCloseTo(expected, 3)
    expect(heard.right).toBeCloseTo(expected, 3)
    expect(heard.running).toBe(true)
  })

  it('follows a parameter that moves from one render quantum to the next', async () => {
    const { registered } = await loadWorklet()
    const processor = new (registered.get(STUDIO_COMPRESSOR_PROCESSOR)!)()

    const heard = play(processor, -6, 750, (quantum) =>
      quantum < 375 ? parameters() : parameters({ threshold: -30 }),
    )

    expect(heard.left).toBeCloseTo(
      compressorStaticOutputDb(-6, -30, 6, 2) + 6,
      3,
    )
  })

  it('plays silence for a quantum with nothing connected', async () => {
    const { registered } = await loadWorklet()
    const processor = new (registered.get(STUDIO_COMPRESSOR_PROCESSOR)!)()
    const output = [new Float32Array(128).fill(1), new Float32Array(128)]

    const running = processor.process([[]], [output], parameters())

    expect(output[0].every((value) => value === 0)).toBe(true)
    expect(running).toBe(true)
  })

  it('runs on, as a compressor rings on, until its unit is disposed, and then says it is done', async () => {
    const { registered, send } = await loadWorklet()
    const processor = new (registered.get(STUDIO_COMPRESSOR_PROCESSOR)!)()

    send('something else')
    expect(play(processor, -6, 1).running).toBe(true)
    send(STUDIO_COMPRESSOR_DISPOSE)
    expect(play(processor, -6, 1).running).toBe(false)
  })
})
