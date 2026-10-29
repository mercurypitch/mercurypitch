import { afterEach, describe, expect, it } from 'vitest'
import { createCompressorTwin, measureCompressorLatency, resetCompressorLatencyForTests, } from '@/lib/studio-fx/compressor-twin'
import type { FakeCompressor, FakeDelay, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { FakeAudioContext, fakeImpulseRenderContext as impulseContext, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'

afterEach(() => resetCompressorLatencyForTests())

describe('compressor twin', () => {
  it('stays a null compressor until the lookahead is measured', () => {
    const ctx = new FakeAudioContext(48000)
    createCompressorTwin(ctx.asContext)
    const [twin] = ctx.ofType<FakeCompressor>('compressor')
    expect(twin.ratio.value).toBe(1)
    expect(ctx.ofType('delay')).toHaveLength(0)
  })

  it('becomes a delay of exactly the measured frames', async () => {
    await expect(
      measureCompressorLatency(48000, impulseContext(288)),
    ).resolves.toBe(288)
    const ctx = new FakeAudioContext(48000)
    createCompressorTwin(ctx.asContext)
    expect(ctx.ofType('compressor')).toHaveLength(0)
    const [delay] = ctx.ofType<FakeDelay>('delay')
    expect(delay.delayTime.value * 48000).toBeCloseTo(288, 9)
    expect(delay.maxDelayTime).toBeGreaterThan(delay.delayTime.value)
  })

  it('measures each sample rate on its own', async () => {
    await measureCompressorLatency(48000, impulseContext(288))
    const ctx = new FakeAudioContext(44100)
    createCompressorTwin(ctx.asContext)
    expect(ctx.ofType('compressor')).toHaveLength(1)
  })

  it('keeps the compressor when the response is not a clean delayed impulse', async () => {
    await expect(
      measureCompressorLatency(48000, impulseContext(288, [0.7, 0.3])),
    ).resolves.toBeNull()
    const ctx = new FakeAudioContext(48000)
    createCompressorTwin(ctx.asContext)
    expect(ctx.ofType('compressor')).toHaveLength(1)
  })

  it('tries again after a context that cannot render', async () => {
    const broken = () => {
      throw new Error('no offline audio here')
    }
    await expect(measureCompressorLatency(48000, broken)).resolves.toBeNull()
    await expect(
      measureCompressorLatency(48000, impulseContext(288)),
    ).resolves.toBe(288)
  })
})
