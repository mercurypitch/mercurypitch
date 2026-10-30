import { afterEach, describe, expect, it } from 'vitest'
import { createIdentityShaperPath, createShaperPath } from './effect-shell'
import type { FakeDelay, FakeShaper } from './fake-audio-graph.test-fixtures'
import { FakeAudioContext, fakeShaperRenderContext, } from './fake-audio-graph.test-fixtures'
import { measureShaperDelays, resetShaperDelaysForTests, shaperRun, } from './shaper-delay'

const CHROMIUM = { none: 0, '2x': 128, '4x': 192 } as const

afterEach(() => resetShaperDelaysForTests())

describe('shaper delay', () => {
  it('measures how late each oversampling runs, once per rate', async () => {
    await expect(
      measureShaperDelays(48000, fakeShaperRenderContext(CHROMIUM)),
    ).resolves.toEqual(CHROMIUM)
    expect(shaperRun(48000, '2x')).toEqual({
      oversample: '2x',
      makeUpFrames: 64,
    })
    expect(shaperRun(48000, 'none')).toEqual({
      oversample: 'none',
      makeUpFrames: 192,
    })
    expect(shaperRun(48000, '4x')).toEqual({
      oversample: '4x',
      makeUpFrames: 0,
    })
    // Not measured at this rate: every shaper stays at 4x.
    expect(shaperRun(44100, 'none')).toEqual({
      oversample: '4x',
      makeUpFrames: 0,
    })
  })

  it('keeps every shaper at 4x where the delays do not line up', async () => {
    await expect(
      measureShaperDelays(
        48000,
        fakeShaperRenderContext({ none: 0, '2x': 200, '4x': 192 }),
      ),
    ).resolves.toBeNull()
    expect(shaperRun(48000, 'none')).toEqual({
      oversample: '4x',
      makeUpFrames: 0,
    })
  })

  it('tries again after a context that cannot render', async () => {
    const broken = () => {
      throw new Error('no offline audio here')
    }
    await expect(measureShaperDelays(48000, broken)).resolves.toBeNull()
    await expect(
      measureShaperDelays(48000, fakeShaperRenderContext(CHROMIUM)),
    ).resolves.toEqual(CHROMIUM)
  })

  it('runs a shaper path at the asked oversampling and makes up the delay to 4x', async () => {
    await measureShaperDelays(48000, fakeShaperRenderContext(CHROMIUM))
    for (const [oversample, makeUp] of [
      ['4x', 0],
      ['2x', 64],
      ['none', 192],
    ] as const) {
      const ctx = new FakeAudioContext(48000)
      const path = createIdentityShaperPath(ctx.asContext, oversample)
      const [shaper] = ctx.ofType<FakeShaper>('shaper')
      expect(shaper.oversample).toBe(oversample)
      const delays = ctx.ofType<FakeDelay>('delay')
      expect(delays).toHaveLength(makeUp === 0 ? 0 : 1)
      if (makeUp > 0) {
        expect(delays[0].delayTime.value * 48000).toBeCloseTo(makeUp, 9)
        expect(path.nodes).toContain(delays[0])
      }
    }
  })

  it('never oversamples or delays a shaper that runs plain at full quality', async () => {
    await measureShaperDelays(48000, fakeShaperRenderContext(CHROMIUM))
    const ctx = new FakeAudioContext(48000)
    createShaperPath(ctx.asContext, new Float32Array([-1, 0, 1]), null)
    expect(ctx.ofType<FakeShaper>('shaper')[0].oversample).toBe('none')
    expect(ctx.ofType('delay')).toHaveLength(0)
  })
})
