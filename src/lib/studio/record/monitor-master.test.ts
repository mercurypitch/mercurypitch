// Studio monitor master — every monitored path reaches the speakers through one stage, built from the master spec at the monitor profile (no DynamicsCompressorNode, the glue compressor on the monitor's worklet once loaded, nothing oversampled or delayed, the ceiling a soft clip, the loudness and safety gains at the measured gain), gliding to a new gain as playback's master does, built for the first path and taken apart after the last.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPRESSOR_PARAMETERS, STUDIO_COMPRESSOR_PROCESSOR, } from '@/lib/studio-fx/compressor-kernel'
import { dbToGain } from '@/lib/studio-fx/dsp'
import type { FakeDelay, FakeGain, FakeShaper, FakeWorkletNode, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { FakeAudioContext, fakeAudioWorklet, FakeNode, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { masterChain } from '@/lib/studio-fx/master'
import { prepareZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createStudioMonitorMaster } from './monitor-master'

/** A monitor path's end: what the stage hears from it. */
function pathInto(
  ctx: FakeAudioContext,
  master: ReturnType<typeof createStudioMonitorMaster>,
) {
  const level = new FakeNode('level')
  const joined = master.join(ctx.asContext)
  level.connect(joined.node as unknown as FakeNode)
  return { level, joined }
}

/** What feeds the speakers. */
function feedingDestination(ctx: FakeAudioContext): FakeNode[] {
  return ctx.created.filter((node) => node.targets.includes(ctx.destination))
}

/** The gains whose value is `value` exactly: how a stage's loudness trim is found among its gains. */
function gainsAt(ctx: FakeAudioContext, value: number): FakeGain[] {
  return ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.gain.value === value)
}

describe('the monitor master', () => {
  it('feeds the speakers from one stage, which every path joining it reaches them through', () => {
    const ctx = new FakeAudioContext()
    const master = createStudioMonitorMaster()

    const first = pathInto(ctx, master)
    const second = pathInto(ctx, master)

    expect(second.joined.node).toBe(first.joined.node)
    const [speakers] = feedingDestination(ctx)
    expect(feedingDestination(ctx)).toHaveLength(1)
    expect(reaches(first.level, speakers)).toBe(true)
    expect(reaches(second.level, speakers)).toBe(true)
  })

  it('is the master spec at the monitor profile: no DynamicsCompressorNode, nothing oversampled or delayed, the ceiling a soft clip, the loudness and safety gains as measured', () => {
    const ctx = new FakeAudioContext()
    const master = createStudioMonitorMaster(
      masterChain({ gainDb: 6, safetyGainDb: -2, ceilingDb: -1.5 }),
    )

    pathInto(ctx, master)

    expect(ctx.ofType('compressor')).toEqual([])
    const shapers = ctx.ofType<FakeShaper>('shaper')
    expect(shapers.map((shaper) => shaper.oversample)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ])
    const heard = ctx
      .ofType<FakeDelay>('delay')
      .filter((delay) => reaches(delay, ctx.destination))
    expect(heard.map((delay) => delay.delayTime.value)).toEqual([0])
    // The soft clip's input scales the ceiling to its curve's domain.
    expect(gainsAt(ctx, 1 / (dbToGain(-1.5) * 4))).toHaveLength(1)
    expect(gainsAt(ctx, dbToGain(6))).toHaveLength(1)
    expect(gainsAt(ctx, dbToGain(-2))).toHaveLength(1)
    expect(ctx.ofType('biquad').length).toBeGreaterThan(0)
  })

  describe('once the compressor worklet has loaded', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('plays the glue compressor on it, at its settings, between the trace saturation and the ceiling', async () => {
      const ctx = new FakeAudioContext()
      fakeAudioWorklet(ctx, {
        [STUDIO_COMPRESSOR_PROCESSOR]: COMPRESSOR_PARAMETERS,
      })
      await prepareZeroLatencyCompressor(ctx.asContext)
      const master = createStudioMonitorMaster(masterChain({ gainDb: 6 }))

      const { level } = pathInto(ctx, master)

      expect(ctx.ofType('compressor')).toEqual([])
      const worklets = ctx.ofType<FakeWorkletNode>('worklet')
      expect(worklets).toHaveLength(1)
      const [glue] = worklets
      expect(
        ['threshold', 'ratio', 'knee'].map(
          (name) => glue.parameters.get(name)?.value,
        ),
      ).toEqual([-12, 1.35, 5])
      const shapers = ctx.ofType<FakeShaper>('shaper')
      const [trace, softClip] = [shapers[0], shapers.at(-1)!]
      expect(reaches(level, glue)).toBe(true)
      expect(reaches(trace, glue)).toBe(true)
      expect(reaches(glue, softClip)).toBe(true)
      expect(reaches(softClip, glue)).toBe(false)
    })
  })

  it("glides a stage to a new gain as playback's master does, and builds the next stage at it", () => {
    const ctx = new FakeAudioContext()
    const master = createStudioMonitorMaster(masterChain({ gainDb: 6 }))
    const { joined } = pathInto(ctx, master)
    const [trim] = gainsAt(ctx, dbToGain(6))

    master.follow(masterChain({ gainDb: -4 }))

    expect(trim.gain.lastWrite).toEqual({
      kind: 'target',
      time: 0,
      value: dbToGain(-4),
      timeConstant: 0.02,
    })
    joined.leave()
    pathInto(ctx, master)
    expect(gainsAt(ctx, dbToGain(-4))).toHaveLength(1)
  })

  it('stays while any path is joined, comes apart after the last leaves, once however often it says so', () => {
    const ctx = new FakeAudioContext()
    const master = createStudioMonitorMaster()
    const first = pathInto(ctx, master)
    const second = pathInto(ctx, master)

    first.joined.leave()
    first.joined.leave()

    expect(feedingDestination(ctx)).toHaveLength(1)
    second.joined.leave()
    expect(feedingDestination(ctx)).toEqual([])
    expect(ctx.created.filter((node) => node.connections.length > 0)).toEqual(
      [],
    )
    const third = pathInto(ctx, master)
    expect(third.joined.node).not.toBe(first.joined.node)
    expect(feedingDestination(ctx)).toHaveLength(1)
  })
})
