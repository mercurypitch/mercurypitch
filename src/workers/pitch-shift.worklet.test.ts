// The bundled pitch-shift worklet really moves a tone by the requested semitones.
//
// This drives the REAL Signalsmith processor (WASM) block by block, the way
// the audio thread would, inside a minimal AudioWorkletGlobalScope, and sends
// it exactly what the main-thread wrapper sends. The output frequency is read
// back from its zero crossings.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { PitchShiftPreset } from '@/lib/key-shift/pitch-shift-node'
import { PITCH_SHIFT_NODE_OPTIONS, PITCH_SHIFT_PROCESSOR, presetConfig, semitoneChange, startChange, } from '@/lib/key-shift/pitch-shift-node'

vi.mock('@/workers/pitch-shift.worklet.ts?worker&url', () => ({
  default: 'pitch-shift-worklet.js',
}))

const SAMPLE_RATE = 48000
const BLOCK = 128

class FakePort {
  onmessage: ((event: { data: unknown[] }) => void) | null = null
  readonly sent: unknown[][] = []
  postMessage(data: unknown[]): void {
    this.sent.push(data)
  }
}

interface Processor {
  readonly port: FakePort
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}

type ProcessorConstructor = new (options: AudioWorkletNodeOptions) => Processor

let registered: { name: string; processor: ProcessorConstructor } | null = null
let clock = 0
let messageId = 0

function remote(processor: Processor, method: string, ...args: unknown[]) {
  const id = messageId++
  processor.port.onmessage?.({ data: [id, method, ...args] })
  return processor.port.sent.find((message) => message[0] === id)?.[1]
}

async function readyProcessor(): Promise<Processor> {
  if (registered === null) throw new Error('The worklet did not register')
  const processor = new registered.processor(PITCH_SHIFT_NODE_OPTIONS)
  for (let tries = 0; tries < 200; tries++) {
    if (processor.port.sent.some((message) => message[0] === 'ready'))
      return processor
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error('The WASM engine never reported ready')
}

// Runs `seconds` of a sine through the processor, returning the left output.
function render(processor: Processor, frequency: number, seconds: number) {
  const blocks = Math.ceil((seconds * SAMPLE_RATE) / BLOCK)
  const output = new Float32Array(blocks * BLOCK)
  for (let block = 0; block < blocks; block++) {
    const left = new Float32Array(BLOCK)
    for (let i = 0; i < BLOCK; i++) {
      const n = block * BLOCK + i
      left[i] = 0.5 * Math.sin((2 * Math.PI * frequency * n) / SAMPLE_RATE)
    }
    const outputs = [[new Float32Array(BLOCK), new Float32Array(BLOCK)]]
    processor.process([[left, left.slice()]], outputs)
    output.set(outputs[0][0], block * BLOCK)
    clock += BLOCK / SAMPLE_RATE
    vi.stubGlobal('currentTime', clock)
  }
  return output
}

// Frequency from positive-going zero crossings, interpolated between samples.
function zeroCrossingHz(samples: Float32Array): number {
  const crossings: number[] = []
  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1]
    const after = samples[i]
    if (before < 0 && after >= 0)
      crossings.push(i - 1 + before / (before - after))
  }
  if (crossings.length < 2) return 0
  const span = crossings[crossings.length - 1] - crossings[0]
  return ((crossings.length - 1) * SAMPLE_RATE) / span
}

function rms(samples: Float32Array): number {
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

// The last half second of a 1.5 s render, well past the engine's latency.
function steadyTail(samples: Float32Array): Float32Array {
  return samples.subarray(samples.length - SAMPLE_RATE / 2)
}

async function shiftedTone(
  semitones: number,
  options: { preset?: PitchShiftPreset; formantCompensation?: boolean } = {},
) {
  const processor = await readyProcessor()
  if (options.preset)
    remote(processor, 'configure', presetConfig(options.preset))
  remote(
    processor,
    'schedule',
    startChange({ formantCompensation: options.formantCompensation ?? false }),
  )
  remote(processor, 'schedule', semitoneChange(semitones))
  const latency = remote(processor, 'latency')
  const tail = steadyTail(render(processor, 220, 1.5))
  return { latency, frequency: zeroCrossingHz(tail), level: rms(tail) }
}

describe('pitch-shift worklet', () => {
  // Imported once: node caches the externalized package, so a second import
  // would not run registerProcessor again. Each test builds its own processor.
  beforeAll(async () => {
    class TestAudioWorkletProcessor {
      readonly port = new FakePort()
    }

    vi.stubGlobal('sampleRate', SAMPLE_RATE)
    vi.stubGlobal('currentTime', clock)
    vi.stubGlobal('AudioWorkletProcessor', TestAudioWorkletProcessor)
    vi.stubGlobal(
      'registerProcessor',
      (name: string, processor: ProcessorConstructor) => {
        registered = { name, processor }
      },
    )

    await import('./pitch-shift.worklet')
  })

  beforeEach(() => {
    clock = 0
    vi.stubGlobal('currentTime', clock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('registers the processor under the name the wrapper creates', () => {
    expect(registered?.name).toBe(PITCH_SHIFT_PROCESSOR)
  })

  it('moves a 220 Hz tone up an octave at +12 semitones', async () => {
    const result = await shiftedTone(12)

    expect(result.level).toBeGreaterThan(0.1)
    expect(result.frequency).toBeGreaterThan(434)
    expect(result.frequency).toBeLessThan(446)
  })

  it('leaves a 220 Hz tone at 220 Hz at 0 semitones', async () => {
    const result = await shiftedTone(0)

    expect(result.level).toBeGreaterThan(0.1)
    expect(result.frequency).toBeGreaterThan(217)
    expect(result.frequency).toBeLessThan(223)
  })

  it('shifts on the cheaper phone preset as well', async () => {
    const result = await shiftedTone(12, { preset: 'cheaper' })

    expect(result.level).toBeGreaterThan(0.1)
    expect(result.frequency).toBeGreaterThan(434)
    expect(result.frequency).toBeLessThan(446)
  })

  it('keeps the fundamental on target with formant compensation on', async () => {
    const result = await shiftedTone(12, { formantCompensation: true })

    expect(result.level).toBeGreaterThan(0.1)
    expect(result.frequency).toBeGreaterThan(434)
    expect(result.frequency).toBeLessThan(446)
  })

  it('treats an input with nothing playing into it as silence', async () => {
    // Parked, paused or released, a shifter is handed an EMPTY input, and
    // the library reads that as playing back buffers it was given: a full
    // analysis every block, dearer than shifting real audio (49 against
    // 37 us a block, measured on this processor). Silence takes the
    // engine's own shortcut instead. The buffer path is the one that posts
    // where playback has got to, so those reports are its fingerprint.
    const processor = await readyProcessor()
    remote(processor, 'schedule', startChange({ formantCompensation: false }))
    remote(processor, 'schedule', semitoneChange(2))
    processor.port.sent.length = 0

    for (let block = 0; block < 100; block++) {
      processor.process(
        [[]],
        [[new Float32Array(BLOCK), new Float32Array(BLOCK)]],
      )
      clock += BLOCK / SAMPLE_RATE
      vi.stubGlobal('currentTime', clock)
    }

    expect(
      processor.port.sent.filter((message) => message[0] === 'time'),
    ).toEqual([])
  })

  it('reports a latency the graph can compensate for', async () => {
    const result = await shiftedTone(2)

    expect(typeof result.latency).toBe('number')
    expect(result.latency).toBeGreaterThan(0)
    expect(result.latency).toBeLessThan(0.25)
  })
})
