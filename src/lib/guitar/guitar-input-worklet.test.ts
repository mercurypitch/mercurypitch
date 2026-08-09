// The guitar worklet must hear every channel an interface sends it.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface TestProcessor {
  port: { postMessage: ReturnType<typeof vi.fn> }
  process(inputs: Float32Array[][]): boolean
}

type TestProcessorConstructor = new () => TestProcessor

describe('guitar input worklet', () => {
  let processor: TestProcessorConstructor | null

  beforeEach(async () => {
    vi.resetModules()
    processor = null

    class TestAudioWorkletProcessor {
      readonly port = { postMessage: vi.fn() }
    }

    vi.stubGlobal('currentFrame', 4800)
    vi.stubGlobal('sampleRate', 48000)
    vi.stubGlobal('AudioWorkletProcessor', TestAudioWorkletProcessor)
    vi.stubGlobal(
      'registerProcessor',
      vi.fn((_name: string, registered: TestProcessorConstructor) => {
        processor = registered
      }),
    )

    await import('../../workers/guitar-input.worklet')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps a quiet guitar on channel two above the detector floor', () => {
    if (processor === null) throw new Error('The worklet did not register')
    const instance = new processor()
    const channelOne = new Float32Array(128)
    const channelTwo = new Float32Array(128)
    channelTwo[1] = 0.03

    expect(instance.process([[channelOne, channelTwo]])).toBe(true)
    expect(instance.port.postMessage).toHaveBeenCalledWith({
      type: 'attack',
      atFrame: 4801,
      level: expect.closeTo(0.03, 5),
    })
  })

  it('does not cancel polarity-opposed interface channels', () => {
    if (processor === null) throw new Error('The worklet did not register')
    const instance = new processor()
    const channelOne = new Float32Array(128)
    const channelTwo = new Float32Array(128)
    channelOne[1] = 0.04
    channelTwo[1] = -0.04

    expect(instance.process([[channelOne, channelTwo]])).toBe(true)
    expect(instance.port.postMessage).toHaveBeenCalledWith({
      type: 'attack',
      atFrame: 4801,
      level: expect.closeTo(0.04, 5),
    })
  })
})
