// The capture worklet's whole job is a steady hop and an honest window.
// ============================================================
//
// Neither is observable through a live microphone, and both are exactly
// what broke when the hop was a rendered frame — so they are tested here
// against a synthetic audio thread, one 128-sample quantum at a time.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { F0_HOP, F0_WINDOW } from './f0-worklet-contract'

interface CaptureMessage {
  samples: Float32Array
  atFrame: number
  rms: number
}

interface TestProcessor {
  port: { postMessage: ReturnType<typeof vi.fn> }
  process(inputs: Float32Array[][]): boolean
}

type TestProcessorConstructor = new () => TestProcessor

const QUANTUM = 128

describe('the F0 capture worklet', () => {
  let processor: TestProcessorConstructor | null

  beforeEach(async () => {
    vi.resetModules()
    processor = null

    class TestAudioWorkletProcessor {
      readonly port = { postMessage: vi.fn() }
    }

    vi.stubGlobal('currentFrame', 0)
    vi.stubGlobal('sampleRate', 48000)
    vi.stubGlobal('AudioWorkletProcessor', TestAudioWorkletProcessor)
    vi.stubGlobal(
      'registerProcessor',
      vi.fn((_name: string, registered: TestProcessorConstructor) => {
        processor = registered
      }),
    )

    await import('./f0-capture.worklet')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const instance = (): TestProcessor => {
    if (processor === null) throw new Error('The worklet did not register')
    return new processor()
  }

  /** Push `count` quanta, each filled by `sample(absoluteIndex)`. */
  const pump = (
    node: TestProcessor,
    count: number,
    sample: (i: number) => number = () => 0,
  ): void => {
    for (let q = 0; q < count; q++) {
      const channel = new Float32Array(QUANTUM)
      for (let i = 0; i < QUANTUM; i++) channel[i] = sample(q * QUANTUM + i)
      node.process([[channel]])
    }
  }

  it('says nothing until it has a full window to say it about', () => {
    const node = instance()
    // A hop's worth of audio arrives long before a window's worth does.
    pump(node, F0_WINDOW / QUANTUM - 1, () => 0.5)
    expect(node.port.postMessage).not.toHaveBeenCalled()

    pump(node, 1, () => 0.5)
    expect(node.port.postMessage).toHaveBeenCalledTimes(1)
  })

  it('then posts once per hop, whatever the caller is doing', () => {
    const node = instance()
    pump(node, F0_WINDOW / QUANTUM)
    expect(node.port.postMessage).toHaveBeenCalledTimes(1)

    // Four more hops of audio is four more windows. This is the property
    // the frame loop could not hold: the rate is the audio clock's, not
    // the renderer's.
    pump(node, (4 * F0_HOP) / QUANTUM)
    expect(node.port.postMessage).toHaveBeenCalledTimes(5)
  })

  it('posts the most recent window, oldest sample first', () => {
    const node = instance()
    // Ramp so every sample is identifiable by its absolute index.
    pump(node, F0_WINDOW / QUANTUM, (i) => i)
    pump(node, F0_HOP / QUANTUM, (i) => F0_WINDOW + i)

    const calls = node.port.postMessage.mock.calls as [CaptureMessage][]
    const second = calls[1][0]
    expect(second.samples).toHaveLength(F0_WINDOW)
    // After one hop past the first full window, the window covers
    // samples HOP .. HOP+WINDOW-1, in order.
    expect(second.samples[0]).toBe(F0_HOP)
    expect(second.samples[F0_WINDOW - 1]).toBe(F0_HOP + F0_WINDOW - 1)
  })

  it('stamps the window on the audio clock and measures its level', () => {
    const node = instance()
    pump(node, F0_WINDOW / QUANTUM, () => 0.5)

    const [message] = node.port.postMessage.mock.calls[0] as [CaptureMessage]
    // `currentFrame` is stubbed at 0 and does not advance in this
    // harness, so the stamp is the quantum offset the worklet adds.
    expect(message.atFrame).toBe(QUANTUM)
    // A constant 0.5 signal has RMS 0.5.
    expect(message.rms).toBeCloseTo(0.5, 6)
  })

  it('transfers the window rather than copying it', () => {
    const node = instance()
    pump(node, F0_WINDOW / QUANTUM, () => 0.25)

    const call = node.port.postMessage.mock.calls[0] as [
      CaptureMessage,
      ArrayBuffer[],
    ]
    expect(call[1]).toEqual([call[0].samples.buffer])
  })

  it('survives an input with no connected source', () => {
    const node = instance()
    expect(node.process([])).toBe(true)
    expect(node.process([[]])).toBe(true)
    expect(node.port.postMessage).not.toHaveBeenCalled()
  })
})

// The bug this guards: a Focusrite Scarlett presented as "Analog Surround
// 4.1" hands Chrome a two-channel capture with the singer on ONE channel.
// Reading channel zero read digital silence, reported no pitch, and raised
// nothing at all to explain it -- while an AnalyserNode on the same stream
// worked, because AnalyserNode down-mixes by default.
describe('a capture that arrives with more than one channel', () => {
  let processor: TestProcessorConstructor | null

  beforeEach(async () => {
    vi.resetModules()
    processor = null
    class TestAudioWorkletProcessor {
      readonly port = { postMessage: vi.fn() }
    }
    vi.stubGlobal('currentFrame', 0)
    vi.stubGlobal('sampleRate', 48000)
    vi.stubGlobal('AudioWorkletProcessor', TestAudioWorkletProcessor)
    vi.stubGlobal(
      'registerProcessor',
      vi.fn((_name: string, registered: TestProcessorConstructor) => {
        processor = registered
      }),
    )
    await import('./f0-capture.worklet')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const QUANTUM_ = 128
  const build = (): TestProcessor => {
    if (processor === null) throw new Error('The worklet did not register')
    return new processor()
  }
  const pumpTwo = (
    node: TestProcessor,
    count: number,
    left: (i: number) => number,
    right: (i: number) => number,
  ): void => {
    for (let q = 0; q < count; q++) {
      const l = new Float32Array(QUANTUM_)
      const r = new Float32Array(QUANTUM_)
      for (let i = 0; i < QUANTUM_; i++) {
        l[i] = left(q * QUANTUM_ + i)
        r[i] = right(q * QUANTUM_ + i)
      }
      node.process([[l, r]])
    }
  }
  const lastMessage = (node: TestProcessor): CaptureMessage => {
    const calls = node.port.postMessage.mock.calls
    return calls[calls.length - 1]![0] as CaptureMessage
  }

  it('hears a singer who is only on the right channel', () => {
    const node = build()
    // Left is digital silence; the voice is entirely on the right.
    pumpTwo(
      node,
      Math.ceil(F0_WINDOW / QUANTUM_) + 1,
      () => 0,
      (i) => Math.sin((2 * Math.PI * 220 * i) / 48000),
    )
    expect(node.port.postMessage).toHaveBeenCalled()
    expect(lastMessage(node).rms).toBeGreaterThan(0.1)
  })

  it('hears a singer who is only on the left channel', () => {
    const node = build()
    pumpTwo(
      node,
      Math.ceil(F0_WINDOW / QUANTUM_) + 1,
      (i) => Math.sin((2 * Math.PI * 220 * i) / 48000),
      () => 0,
    )
    expect(lastMessage(node).rms).toBeGreaterThan(0.1)
  })

  // The same sound on both channels must not come out louder than it went
  // in: this is a mix, not a sum.
  it('averages rather than adds', () => {
    const both = build()
    const tone = (i: number) => Math.sin((2 * Math.PI * 220 * i) / 48000)
    pumpTwo(both, Math.ceil(F0_WINDOW / QUANTUM_) + 1, tone, tone)
    const mixed = lastMessage(both).rms

    const one = build()
    pumpTwo(one, Math.ceil(F0_WINDOW / QUANTUM_) + 1, tone, () => 0)
    const half = lastMessage(one).rms

    expect(mixed).toBeCloseTo(Math.SQRT1_2, 1)
    expect(half).toBeCloseTo(mixed / 2, 2)
  })
})
