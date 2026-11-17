import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffectSpec } from '@/lib/studio-fx/chain-spec'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { COMPRESSOR_PARAMETERS, STUDIO_COMPRESSOR_DISPOSE, STUDIO_COMPRESSOR_PROCESSOR, } from '@/lib/studio-fx/compressor-kernel'
import { measureCompressorLatency, resetCompressorLatencyForTests, } from '@/lib/studio-fx/compressor-twin'
import { EFFECT_KINDS } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv } from '@/lib/studio-fx/effect-shell'
import { FAST_SETTLE_SECONDS } from '@/lib/studio-fx/effect-shell'
import type { FakeBiquad, FakeCompressor, FakeConvolver, FakeDelay, FakeGain, FakeIir, FakeNode, FakeShaper, FakeWorkletNode, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, fakeAudioWorklet, fakeImpulseRenderContext, fakeShaperRenderContext, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import type { StudioFxProfile } from '@/lib/studio-fx/fx-profile'
import { FULL_FX_PROFILE, MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { measureShaperDelays, resetShaperDelaysForTests, } from '@/lib/studio-fx/shaper-delay'
import { prepareZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createEffectUnit } from './index'

function spec(
  kind: string,
  params: Record<string, number> = {},
  enabled = true,
): EffectSpec {
  return normalizeChainSpec({ effects: [{ kind, params, enabled }] }).effects[0]
}

function setup(live = true) {
  const ctx = new FakeAudioContext()
  if (!live) ctx.state = 'suspended'
  const scheduler = createManualScheduler()
  const env: EffectEnv = {
    isLive: () => ctx.state === 'running',
    schedule: scheduler.schedule,
  }
  return { ctx, env, scheduler }
}

/** The shell's dry and wet gains are the two gains feeding its output. */
function shellGains(ctx: FakeAudioContext, output: FakeNode) {
  const feeding = ctx
    .ofType<FakeGain>('gain')
    .filter((gain) => gain.targets.includes(output))
  expect(feeding).toHaveLength(2)
  return feeding
}

describe('every effect graph', () => {
  it.each(EFFECT_KINDS)(
    '%s passes audio from input to output and disconnects every node on dispose',
    (kind) => {
      const { ctx, env } = setup()
      const unit = createEffectUnit(ctx.asContext, spec(kind), env)
      expect(
        reaches(
          unit.input as unknown as FakeNode,
          unit.output as unknown as FakeNode,
        ),
      ).toBe(true)
      unit.dispose()
      const stillWired = ctx.created.filter(
        (node) => node.connections.length > 0,
      )
      expect(stillWired).toEqual([])
    },
  )

  it.each(EFFECT_KINDS)(
    '%s glides to its bypass path when disabled live',
    (kind) => {
      const { ctx, env } = setup()
      const unit = createEffectUnit(ctx.asContext, spec(kind), env)
      const gains = shellGains(ctx, unit.output as unknown as FakeNode)
      unit.setEnabled(false)
      const writes = gains.map((gain) => gain.gain.lastWrite)
      expect(writes.every((write) => write?.kind === 'target')).toBe(true)
      expect(
        gains.map((gain) => gain.gain.destination).sort((x, y) => x - y),
      ).toEqual([0, 1])
    },
  )

  it.each(EFFECT_KINDS)(
    '%s sets values outright when nothing is playing',
    (kind) => {
      const { ctx, env } = setup(false)
      const unit = createEffectUnit(ctx.asContext, spec(kind), env)
      unit.setEnabled(false)
      const gains = shellGains(ctx, unit.output as unknown as FakeNode)
      expect(gains.every((gain) => gain.gain.lastWrite?.kind === 'set')).toBe(
        true,
      )
    },
  )
})

describe('compressor', () => {
  it('divides the automatic makeup back out and applies only the explicit makeup', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(
      ctx.asContext,
      spec('compressor', {
        thresholdDb: -24,
        kneeDb: 0,
        ratio: 4,
        makeupDb: 6,
      }),
      env,
    )
    const destinations = ctx
      .ofType<FakeGain>('gain')
      .map((gain) => gain.gain.destination)
    expect(destinations).toContainEqual(1 / compressorAutoMakeupGain(-24, 0, 4))
    expect(
      destinations.some((value) => Math.abs(value - 10 ** (6 / 20)) < 1e-9),
    ).toBe(true)
  })

  it('runs its unprocessed path through a compressor that never compresses', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('compressor'), env)
    const compressors = ctx.ofType<FakeCompressor>('compressor')
    expect(compressors).toHaveLength(2)
    expect(
      compressors.some(
        (c) => c.ratio.destination === 1 && c.threshold.destination === 0,
      ),
    ).toBe(true)
  })

  it('reports gain reduction from the working compressor', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec('compressor'), env)
    for (const compressor of ctx.ofType<FakeCompressor>('compressor'))
      compressor.reduction = -4.5
    expect(unit.readReductionDb()).toBe(-4.5)
  })

  it('splits dry and wet by the linear law for parallel compression', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(
      ctx.asContext,
      spec('compressor', { mix: 30 }),
      env,
    )
    const [low, high] = shellGains(ctx, unit.output as unknown as FakeNode)
      .map((g) => g.gain.destination)
      .sort((x, y) => x - y)
    expect(low).toBeCloseTo(0.3, 12)
    expect(high).toBeCloseTo(0.7, 12)
  })
})

describe('latency twins once the compressor lookahead is measured', () => {
  afterEach(() => resetCompressorLatencyForTests())

  // [kind, compressors that shape the sound, paths that only need the delay]
  const cases = [
    ['compressor', 1, 1],
    ['dyneq', 1, 3],
    ['deesser', 1, 2],
    ['limiter', 1, 1],
  ] as const

  for (const [kind, working, twins] of cases) {
    it(`${kind}: every path beside its compressor is a plain delay`, async () => {
      await measureCompressorLatency(48000, fakeImpulseRenderContext(288))
      const { ctx, env } = setup(false)
      createEffectUnit(ctx.asContext, spec(kind), env)
      expect(ctx.ofType<FakeCompressor>('compressor')).toHaveLength(working)
      const delays = ctx.ofType<FakeDelay>('delay')
      expect(delays).toHaveLength(twins)
      for (const delay of delays)
        expect(delay.delayTime.value * 48000).toBeCloseTo(288, 9)
    })
  }
})

describe('settling a fresh compressor before its first sound', () => {
  afterEach(() => resetCompressorLatencyForTests())

  const cases = ['compressor', 'dyneq', 'deesser', 'limiter'] as const

  /** Release at 1 ms from `at`, then back to `release` FAST_SETTLE_SECONDS later. */
  const settledFrom = (param: FakeCompressor['release'], at: number) => {
    const sets = param.events.filter((e) => e.kind === 'set')
    expect(param.events.filter((e) => e.kind === 'cancel').at(-1)?.time).toBe(
      at,
    )
    expect(sets.at(-2)).toMatchObject({ time: at, value: 0.001 })
    expect(sets.at(-1)?.time).toBeCloseTo(at + FAST_SETTLE_SECONDS, 9)
    return sets.at(-1)!.value
  }

  for (const kind of cases) {
    it(`${kind}: runs its compressor's release at 1 ms for 40 ms, then at its own`, async () => {
      await measureCompressorLatency(48000, fakeImpulseRenderContext(288))
      const { ctx, env } = setup(false)
      const unit = createEffectUnit(ctx.asContext, spec(kind), env)
      const [compressor] = ctx.ofType<FakeCompressor>('compressor')
      const release = compressor.release.value
      unit.settle?.(2)
      expect(settledFrom(compressor.release, 2)).toBeCloseTo(release, 9)
    })

    it(`${kind}: settles null-compressor twins too, before the lookahead is measured`, () => {
      const { ctx, env } = setup(false)
      const unit = createEffectUnit(ctx.asContext, spec(kind), env)
      const compressors = ctx.ofType<FakeCompressor>('compressor')
      expect(compressors.length).toBeGreaterThan(1)
      unit.settle?.(1)
      for (const compressor of compressors) settledFrom(compressor.release, 1)
    })
  }

  it('leaves a unit with no compressor without a settle', () => {
    const { ctx, env } = setup(false)
    expect(createEffectUnit(ctx.asContext, spec('eq'), env).settle).toBe(
      undefined,
    )
  })
})

describe('shapers at a lighter playback quality', () => {
  afterEach(() => resetShaperDelaysForTests())

  const profile = (oversample: OverSampleType): StudioFxProfile => ({
    id: oversample,
    oversample: {
      saturation: oversample,
      exciter: oversample,
      limiter: oversample,
    },
    reverbBus: false,
    lite: [],
  })

  for (const kind of ['saturation', 'exciter', 'limiter'] as const) {
    it(`${kind}: its shaper and its twin run at the asked oversampling, each as late as at 4x`, async () => {
      await measureShaperDelays(
        48000,
        fakeShaperRenderContext({ none: 0, '2x': 128, '4x': 192 }),
      )
      for (const [oversample, makeUp] of [
        ['2x', 64],
        ['none', 192],
      ] as const) {
        const { ctx, env } = setup(false)
        createEffectUnit(ctx.asContext, spec(kind), {
          ...env,
          profile: profile(oversample),
        })
        const shapers = ctx.ofType<FakeShaper>('shaper')
        const oversampled = shapers.filter((s) => s.oversample !== 'none')
        if (oversample === '2x') expect(oversampled).toHaveLength(2)
        const makeUps = ctx
          .ofType<FakeDelay>('delay')
          .filter((d) => Math.abs(d.delayTime.value * 48000 - makeUp) < 1e-6)
        // The processed shaper and the twin beside it, never the plain hard clip.
        expect(makeUps).toHaveLength(2)
      }
    })
  }

  it('runs every shaper at 4x with no profile, as export does', async () => {
    await measureShaperDelays(
      48000,
      fakeShaperRenderContext({ none: 0, '2x': 128, '4x': 192 }),
    )
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('saturation'), env)
    expect(
      ctx.ofType<FakeShaper>('shaper').map((shaper) => shaper.oversample),
    ).toEqual(['4x', '4x'])
  })
})

describe('dynamics at Light playback quality', () => {
  const light: StudioFxProfile = {
    ...FULL_FX_PROFILE,
    id: 'light',
    lite: ['dyneq', 'deesser'],
  }

  it('keeps a dynamic EQ band and a de-esser as their lookahead alone', () => {
    for (const kind of ['dyneq', 'deesser']) {
      const { ctx, env } = setup(false)
      const unit = createEffectUnit(ctx.asContext, spec(kind), {
        ...env,
        profile: light,
      })
      // One null-compressor twin, the lookahead; no band, no compressor that cuts.
      expect(ctx.ofType<FakeBiquad>('biquad')).toHaveLength(0)
      const compressors = ctx.ofType<FakeCompressor>('compressor')
      expect(compressors).toHaveLength(1)
      expect(compressors[0].threshold.value).toBe(0)
      expect((unit.input as unknown as FakeNode).targets).toEqual([
        compressors[0],
      ])
      expect(compressors[0].targets).toEqual([unit.output])
    }
  })

  it('leaves a following dynamic EQ band a plain wire, and every other effect whole', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec('dyneq'), {
      ...env,
      profile: light,
    })
    unit.follow!(ctx.createGain() as unknown as AudioNode)
    expect((unit.input as unknown as FakeNode).targets).toEqual([unit.output])
    unit.follow!(null)
    expect((unit.input as unknown as FakeNode).targets).toHaveLength(1)
    expect((unit.input as unknown as FakeNode).targets[0].nodeType).toBe(
      'compressor',
    )
    const other = setup(false)
    createEffectUnit(other.ctx.asContext, spec('compressor'), {
      ...other.env,
      profile: light,
    })
    expect(
      other.ctx
        .ofType<FakeCompressor>('compressor')
        .some((c) => c.threshold.value !== 0),
    ).toBe(true)
  })
})

describe('effects on a monitored input', () => {
  afterEach(() => resetShaperDelaysForTests())

  const monitored = (kind: string) => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec(kind), {
      ...env,
      profile: MONITOR_FX_PROFILE,
    })
    return { ctx, unit }
  }

  it.each(['compressor', 'deesser', 'dyneq'])(
    '%s passes the input straight through until the compressor worklet has loaded: one gain at unity, no lookahead, no cut',
    (kind) => {
      const { ctx, unit } = monitored(kind)
      expect(unit.input).toBe(unit.output)
      expect(ctx.created.map((node) => node.nodeType)).toEqual(['gain'])
      expect((unit.input as unknown as FakeGain).gain.value).toBe(1)
      expect(unit.readReductionDb()).toBe(0)
      unit.dispose()
      expect(ctx.created[0].disconnectAllCount).toBe(1)
    },
  )

  describe('once the compressor worklet has loaded', () => {
    afterEach(() => vi.unstubAllGlobals())

    const loaded = async (
      kind: string,
      params: Record<string, number> = {},
      profile: StudioFxProfile = MONITOR_FX_PROFILE,
    ) => {
      const { ctx, env } = setup(false)
      fakeAudioWorklet(ctx, {
        [STUDIO_COMPRESSOR_PROCESSOR]: COMPRESSOR_PARAMETERS,
      })
      await prepareZeroLatencyCompressor(ctx.asContext)
      const unit = createEffectUnit(ctx.asContext, spec(kind, params), {
        ...env,
        profile,
      })
      const worklets = ctx.ofType<FakeWorkletNode>('worklet')
      return { ctx, unit, worklets }
    }

    /** The monitor's profile while live playback is on Light (playback-quality.ts). */
    const LIGHT_MONITOR: StudioFxProfile = {
      ...MONITOR_FX_PROFILE,
      lite: ['dyneq', 'deesser'],
    }

    it.each(['deesser', 'dyneq'])(
      '%s on the Light tier builds no worklet and no band: one gain at unity, passing the input bit for bit as Light playback passes it uncut',
      async (kind) => {
        const { ctx, unit } = await loaded(kind, {}, LIGHT_MONITOR)

        expect(unit.input).toBe(unit.output)
        expect(ctx.created.map((node) => node.nodeType)).toEqual(['gain'])
        expect((unit.input as unknown as FakeGain).gain.value).toBe(1)
        expect(unit.follow).toBeUndefined()
        expect(unit.readReductionDb()).toBe(0)
      },
    )

    it('compresses on the worklet on the Light tier all the same: Light leaves only the de-esser and the dynamic EQ uncut', async () => {
      const { worklets } = await loaded('compressor', {}, LIGHT_MONITOR)

      expect(worklets).toHaveLength(1)
    })

    const VOICE = {
      thresholdDb: -20,
      kneeDb: 6,
      ratio: 2,
      attackMs: 15,
      releaseMs: 180,
      makeupDb: 1.5,
    }

    /** Each of the worklet's parameters, as the last write left it. */
    const settings = (worklet: FakeWorkletNode) =>
      ['threshold', 'knee', 'ratio', 'attack', 'release'].map(
        (name) => worklet.parameters.get(name)?.destination,
      )

    it('compresses on the worklet at its own settings and makeup, with nothing that delays', async () => {
      const { ctx, unit, worklets } = await loaded('compressor', VOICE)

      expect(worklets.map((worklet) => worklet.processor)).toEqual([
        STUDIO_COMPRESSOR_PROCESSOR,
      ])
      const [worklet] = worklets
      expect(settings(worklet)).toEqual([-20, 6, 2, 0.015, 0.18])
      // The worklet adds no makeup of its own, so none is divided out.
      const after = ctx
        .ofType<FakeGain>('gain')
        .filter((gain) => worklet.targets.includes(gain))
      expect(after).toHaveLength(1)
      expect(after[0].gain.destination).toBeCloseTo(10 ** (1.5 / 20), 12)
      expect(
        reaches(unit.input as unknown as FakeNode, worklet) &&
          reaches(worklet, unit.output as unknown as FakeNode),
      ).toBe(true)
      expect(ctx.ofType<FakeCompressor>('compressor')).toEqual([])
      expect(ctx.ofType<FakeDelay>('delay')).toEqual([])
    })

    it('mixes in its unprocessed input by the linear law, straight from its input', async () => {
      const { ctx, unit, worklets } = await loaded('compressor', { mix: 30 })

      const gains = shellGains(ctx, unit.output as unknown as FakeNode)
      const [dry] = gains.filter((gain) => !reaches(worklets[0], gain))
      const [wet] = gains.filter((gain) => reaches(worklets[0], gain))
      expect(dry.gain.destination).toBeCloseTo(0.7, 12)
      expect(wet.gain.destination).toBeCloseTo(0.3, 12)
      expect((unit.input as unknown as FakeNode).targets).toContain(dry)
    })

    it('glides the worklet to new settings while it plays', async () => {
      const { ctx, unit, worklets } = await loaded('compressor', VOICE)
      ctx.state = 'running'

      unit.setParams({ ...VOICE, thresholdDb: -30, ratio: 4 })

      const [worklet] = worklets
      expect(settings(worklet)).toEqual([-30, 6, 4, 0.015, 0.18])
      expect(worklet.parameters.get('threshold')?.lastWrite?.kind).toBe(
        'target',
      )
    })

    it.each(['compressor', 'deesser', 'dyneq'])(
      '%s tells its processor it is done when the unit is disposed, and takes the node out',
      async (kind) => {
        const { unit, worklets } = await loaded(kind)

        unit.dispose()

        const [worklet] = worklets
        expect(worklet.posted).toEqual([STUDIO_COMPRESSOR_DISPOSE])
        expect(worklet.connections).toEqual([])
      },
    )

    it.each(EFFECT_KINDS)(
      '%s passes audio from input to output and disconnects every node on dispose',
      async (kind) => {
        const { ctx, unit } = await loaded(kind)

        expect(
          reaches(
            unit.input as unknown as FakeNode,
            unit.output as unknown as FakeNode,
          ),
        ).toBe(true)
        unit.dispose()
        expect(
          ctx.created.filter((node) => node.connections.length > 0),
        ).toEqual([])
      },
    )

    /** The clean-vocal preset's de-esser (presets.ts). */
    const DEESSER = { frequencyHz: 6500, thresholdDb: -30, ratio: 5 }

    it("de-esser: compresses its sibilant band on the worklet at its own threshold and ratio, and the de-esser's knee, attack and release, split as in playback, with nothing that delays", async () => {
      const { ctx, unit, worklets } = await loaded('deesser', DEESSER)

      expect(worklets.map((worklet) => worklet.processor)).toEqual([
        STUDIO_COMPRESSOR_PROCESSOR,
      ])
      const [worklet] = worklets
      expect(settings(worklet)).toEqual([-30, 3, 5, 0.001, 0.06])
      const filters = ctx.ofType<FakeBiquad>('biquad')
      expect(filters.map((filter) => filter.frequency.destination)).toEqual([
        6500, 6500, 6500, 6500,
      ])
      const highs = filters.filter((filter) => filter.type === 'highpass')
      const lows = filters.filter((filter) => filter.type === 'lowpass')
      expect([highs.length, lows.length]).toEqual([2, 2])
      // The sibilant band alone goes through the worklet, and comes out
      // with no makeup to divide out, into the sum the low band joins.
      expect(highs.every((filter) => reaches(filter, worklet))).toBe(true)
      expect(lows.some((filter) => reaches(filter, worklet))).toBe(false)
      const [sum] = worklet.targets as FakeGain[]
      expect(sum.gain.value).toBe(1)
      expect(lows.some((filter) => filter.targets.includes(sum))).toBe(true)
      expect(reaches(sum, unit.output as unknown as FakeNode)).toBe(true)
      expect(ctx.ofType<FakeCompressor>('compressor')).toEqual([])
      expect(ctx.ofType<FakeDelay>('delay')).toEqual([])
    })

    it.each(['deesser', 'dyneq'])(
      '%s bypasses to its input straight, with no twin in the way',
      async (kind) => {
        const { ctx, unit, worklets } = await loaded(kind)

        const gains = shellGains(ctx, unit.output as unknown as FakeNode)
        const [dry] = gains.filter((gain) => !reaches(worklets[0], gain))
        expect((unit.input as unknown as FakeNode).targets).toContain(dry)
      },
    )

    /** The voice role's harsh band (role-chains.ts). */
    const HARSH = {
      frequencyHz: 7500,
      q: 0.8,
      thresholdDb: -40,
      ratio: 2,
      rangeDb: 4,
      attackMs: 8,
      releaseMs: 90,
    }

    it('dynamic EQ: cuts its band on the worklet at its own settings, by the share its range allows, with nothing that delays', async () => {
      const { ctx, unit, worklets } = await loaded('dyneq', HARSH)

      expect(worklets.map((worklet) => worklet.processor)).toEqual([
        STUDIO_COMPRESSOR_PROCESSOR,
      ])
      const [worklet] = worklets
      expect(settings(worklet)).toEqual([-40, 4, 2, 0.008, 0.09])
      const [band] = ctx.ofType<FakeBiquad>('biquad')
      expect([
        band.type,
        band.frequency.destination,
        band.Q.destination,
      ]).toEqual(['bandpass', 7500, 0.8])
      expect(band.targets).toContain(worklet)
      // out = x + m (K(bp(x)) - bp(x)): the input whole, and the share the
      // range allows of what the worklet takes from the band.
      const [taken] = worklet.targets as FakeGain[]
      const negated = band.targets.filter(
        (node) => node !== worklet,
      ) as FakeGain[]
      expect(negated).toHaveLength(1)
      expect(negated[0].gain.destination).toBe(-1)
      expect(negated[0].targets).toEqual([taken])
      expect(taken.gain.destination).toBe(1)
      const [share] = taken.targets as FakeGain[]
      expect(share.gain.destination).toBeCloseTo(1 - 10 ** (-4 / 20), 12)
      const [sum] = share.targets
      expect((unit.input as unknown as FakeNode).targets).toContain(sum)
      expect(reaches(sum, unit.output as unknown as FakeNode)).toBe(true)
      expect(ctx.ofType<FakeCompressor>('compressor')).toEqual([])
      expect(ctx.ofType<FakeDelay>('delay')).toEqual([])
    })

    // A sum of three can round differently in another order, and the order
    // a node adds its inputs in can differ between two builds of one chain.
    it.each(['deesser', 'dyneq'])(
      '%s adds no more than two signals at any node, so no order of adding them changes what it plays',
      async (kind) => {
        const { ctx, worklets } = await loaded(kind)

        expect(worklets).toHaveLength(1)
        const fedBy = (target: FakeNode): number =>
          ctx.created.filter((node) => node.targets.includes(target)).length
        for (const node of ctx.created) expect(fedBy(node)).toBeLessThan(3)
      },
    )

    it('dynamic EQ: runs beside the band before it, detecting the run input and passing its own input on undelayed', async () => {
      const { ctx, unit } = await loaded('dyneq', HARSH)
      const input = unit.input as unknown as FakeNode
      const [band] = ctx.ofType<FakeBiquad>('biquad')
      const runInput = ctx.createGain()

      unit.follow!(runInput as unknown as AudioNode)

      expect(runInput.targets).toEqual([band])
      expect(input.targets).not.toContain(band)
      // The chain cut the run input's outputs before patching again.
      runInput.disconnect()
      unit.follow!(runInput as unknown as AudioNode)
      expect(runInput.targets).toEqual([band])
      unit.follow!(null)
      expect(input.targets).toContain(band)
    })

    it('glides the worklet and the bands to new settings while they play', async () => {
      const deesser = await loaded('deesser', DEESSER)
      const dyneq = await loaded('dyneq', HARSH)
      deesser.ctx.state = 'running'
      dyneq.ctx.state = 'running'

      deesser.unit.setParams({ ...DEESSER, thresholdDb: -24, ratio: 8 })
      dyneq.unit.setParams({ ...HARSH, thresholdDb: -30, rangeDb: 6 })

      expect(settings(deesser.worklets[0])).toEqual([-24, 3, 8, 0.001, 0.06])
      expect(settings(dyneq.worklets[0])).toEqual([-30, 4, 2, 0.008, 0.09])
      const [taken] = dyneq.worklets[0].targets as FakeGain[]
      const [share] = taken.targets as FakeGain[]
      expect(share.gain.destination).toBeCloseTo(1 - 10 ** (-6 / 20), 12)
      for (const param of [
        deesser.worklets[0].parameters.get('threshold'),
        dyneq.worklets[0].parameters.get('threshold'),
        share.gain,
      ])
        expect(param?.lastWrite?.kind).toBe('target')
    })
  })

  it('runs saturation and air without oversampling or a make-up delay, once 4x is measured late', async () => {
    await measureShaperDelays(
      48000,
      fakeShaperRenderContext({ none: 0, '2x': 128, '4x': 192 }),
    )
    for (const kind of ['saturation', 'exciter']) {
      const { ctx } = monitored(kind)
      const shapers = ctx.ofType<FakeShaper>('shaper')
      expect(shapers.length).toBeGreaterThan(0)
      expect(shapers.every((shaper) => shaper.oversample === 'none')).toBe(true)
      expect(ctx.ofType<FakeDelay>('delay')).toEqual([])
    }
  })

  it('runs the transient shaper with no lookahead on either path', () => {
    const { ctx } = monitored('transient')
    expect(
      ctx.ofType<FakeDelay>('delay').map((delay) => delay.delayTime.value),
    ).toEqual([0, 0])
  })

  it.each(EFFECT_KINDS)('%s builds no compressor', (kind) => {
    const { ctx } = monitored(kind)
    expect(ctx.ofType<FakeCompressor>('compressor')).toEqual([])
  })
})

describe('reverb on a reverb bus', () => {
  const bus = { ...FULL_FX_PROFILE, id: 'bus', reverbBus: true }

  it('sends its pre-delayed, cut and mixed signal to the space its decay picks, and convolves nothing', () => {
    for (const [decayS, space] of [
      [0.8, 'room'],
      [1.5, 'hall'],
      [2.8, 'long'],
    ] as const) {
      const { ctx, env } = setup(false)
      const unit = createEffectUnit(
        ctx.asContext,
        spec('reverb', { decayS, mix: 26, duck: 0 }),
        { ...env, profile: bus },
      )
      expect(unit.send?.space).toBe(space)
      expect(ctx.ofType<FakeConvolver>('convolver')).toHaveLength(0)
      const send = unit.send!.output as unknown as FakeNode
      // The send is the wet path; none of it returns to the unit's output.
      expect(reaches(send, unit.output as unknown as FakeNode)).toBe(false)
      expect(
        reaches(
          unit.input as unknown as FakeNode,
          unit.output as unknown as FakeNode,
        ),
      ).toBe(true)
    }
  })

  it('keeps a ducked reverb on its own, as at full quality', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec('reverb', { duck: 60 }), {
      ...env,
      profile: bus,
    })
    expect(unit.send).toBeUndefined()
    expect(ctx.ofType<FakeConvolver>('convolver').length).toBeGreaterThan(0)
  })
})

describe('de-esser', () => {
  it('splits at the chosen frequency with two filters per side', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('deesser', { frequencyHz: 7000 }), env)
    const filters = ctx.ofType<FakeBiquad>('biquad')
    expect(filters.map((f) => f.type).sort()).toEqual([
      'highpass',
      'highpass',
      'lowpass',
      'lowpass',
    ])
    expect(filters.every((f) => f.frequency.destination === 7000)).toBe(true)
  })
})

describe('saturation and limiter', () => {
  it('oversample their shapers and keep the latency twin oversampled too', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('saturation'), env)
    expect(ctx.ofType<FakeShaper>('shaper').map((s) => s.oversample)).toEqual([
      '4x',
      '4x',
    ])
  })

  it('end the limiter in a hard clamp with no oversampling, so nothing filters it afterwards', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec('limiter'), env)
    const shapers = ctx.ofType<FakeShaper>('shaper')
    const clamp = shapers.find((s) => s.oversample === 'none')
    expect(clamp).toBeDefined()
    const output = unit.output as unknown as FakeNode
    const after = shapers.filter(
      (s) => s !== clamp && s.oversample === '4x' && reaches(clamp!, s),
    )
    expect(after).toEqual([])
    expect(reaches(clamp!, output)).toBe(true)
  })
})

describe('EQ and filters', () => {
  it('switches cuts out at the ends of their range so the default EQ is a straight wire', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('eq'), env)
    const filters = ctx.ofType<FakeBiquad>('biquad')
    const lowCut = filters.filter((f) => f.type === 'highpass')
    const highCut = filters.find((f) => f.type === 'lowpass')!
    expect(lowCut.map((f) => f.frequency.destination)).toEqual([0, 0])
    expect(highCut.frequency.destination).toBe(24000)
  })

  it('cuts lows at 24 dB/octave: two biquads with fourth-order Butterworth Qs, in decibels', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('eq', { lowCutHz: 100 }), env)
    const lowCut = ctx
      .ofType<FakeBiquad>('biquad')
      .filter((f) => f.type === 'highpass')
    expect(lowCut.map((f) => f.Q.value)).toEqual([
      expect.closeTo(20 * Math.log10(0.5412), 3),
      expect.closeTo(20 * Math.log10(1.3066), 3),
    ])
    expect(lowCut.every((f) => f.frequency.destination === 100)).toBe(true)
  })
})

describe('dynamic EQ', () => {
  it('runs beside the band before it: detects the run input and passes its own input through undelayed', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(ctx.asContext, spec('dyneq'), env)
    const input = unit.input as unknown as FakeNode
    const band = ctx.ofType<FakeBiquad>('biquad')[0]
    const runInput = ctx.createGain()
    unit.follow!(runInput as unknown as AudioNode)
    expect(runInput.targets).toEqual([band])
    // Straight to the sum and the dry side: no twin delays it.
    expect(input.targets).toHaveLength(2)
    expect(input.targets.every((node) => node.nodeType === 'gain')).toBe(true)
    // The chain cut the run input's outputs before patching again.
    runInput.disconnect()
    unit.follow!(runInput as unknown as AudioNode)
    expect(runInput.targets).toEqual([band])
    unit.follow!(null)
    expect(input.targets).toContain(band)
    expect(input.targets).toHaveLength(3)
  })

  it('compresses only the share of the band that its range allows', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('dyneq', { rangeDb: 6 }), env)
    const share = 1 - 10 ** (-6 / 20)
    const values = ctx.ofType<FakeGain>('gain').map((g) => g.gain.destination)
    expect(values).toContainEqual(-1)
    expect(values.some((v) => Math.abs(v - share) < 1e-12)).toBe(true)
    expect(values.some((v) => Math.abs(v - (1 - share)) < 1e-12)).toBe(true)
  })

  it('reports the cut the band actually gets, which the range bounds', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(
      ctx.asContext,
      spec('dyneq', { rangeDb: 4 }),
      env,
    )
    const inner = ctx
      .ofType<FakeCompressor>('compressor')
      .find((c) => c.ratio.destination !== 1)!
    inner.reduction = -40
    expect(unit.readReductionDb()).toBeLessThan(-3.8)
    expect(unit.readReductionDb()).toBeGreaterThan(-4)
  })

  it('carries the compressor lookahead on every path it sums', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('dyneq'), env)
    const compressors = ctx.ofType<FakeCompressor>('compressor')
    expect(compressors).toHaveLength(4)
    expect(compressors.filter((c) => c.ratio.destination === 1)).toHaveLength(3)
  })
})

describe('air', () => {
  it('adds harmonics under an untouched signal instead of crossfading to them', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(
      ctx.asContext,
      spec('exciter', { amount: 40 }),
      env,
    )
    const [dry, wet] = shellGains(ctx, unit.output as unknown as FakeNode)
      .map((g) => g.gain.destination)
      .sort((x, y) => y - x)
    expect(dry).toBe(1)
    expect(wet).toBeCloseTo(0.4, 12)
  })
})

describe('reverb ducking', () => {
  it('drives the return gain from the dry signal, down to -12 dB at 100 %', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('reverb', { duck: 100 }), env)
    const depth = ctx
      .ofType<FakeGain>('gain')
      .find((g) => g.targets.some((t) => t.nodeType === 'param'))!
    expect(depth.gain.destination).toBeCloseTo(-(1 - 10 ** (-12 / 20)), 12)
  })

  it('does not duck at all at 0 %', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('reverb', { duck: 0 }), env)
    const depth = ctx
      .ofType<FakeGain>('gain')
      .find((g) => g.targets.some((t) => t.nodeType === 'param'))!
    expect(depth.gain.destination).toBeCloseTo(0, 12)
  })
})

describe('tilt', () => {
  it('moves a 4 kHz shelf by the brightness and a 250 Hz shelf half as far the other way', () => {
    const { ctx, env } = setup(false)
    const unit = createEffectUnit(
      ctx.asContext,
      spec('tilt', { brightnessDb: 4 }),
      env,
    )
    const shelves = ctx.ofType<FakeBiquad>('biquad')
    expect(
      shelves.map((s) => [s.type, s.frequency.value, s.gain.destination]),
    ).toEqual([
      ['lowshelf', 250, -2],
      ['highshelf', 4000, 4],
    ])
    // Built tilted, its straight path has nowhere to go.
    const through = (unit.input as unknown as FakeNode).targets.find(
      (node) => node.nodeType === 'gain' && (node as FakeGain).gain.value === 0,
    ) as FakeGain
    expect(through.targets).toEqual([])
  })

  it('passes a flat tilt straight through, and crossfades its shelves in the first time it moves', () => {
    const { ctx, env } = setup(true)
    ctx.currentTime = 1
    const unit = createEffectUnit(ctx.asContext, spec('tilt'), env)
    const [low, high] = ctx.ofType<FakeBiquad>('biquad')
    const input = unit.input as unknown as FakeNode
    expect(input.targets).not.toContain(low)
    unit.setParams(spec('tilt', { brightnessDb: 3 }).params)
    expect(input.targets).toContain(low)
    const shelved = high.targets[0] as FakeGain
    const through = input.targets.find(
      (node) => node !== low && (node as FakeGain).gain.value === 1,
    ) as FakeGain
    // Both paths carry the same signal while the shelves are flat.
    expect(shelved.gain.destination).toBe(1)
    expect(through.gain.destination).toBe(0)
    expect(high.gain.destination).toBe(3)
    // Flat again, the shelves stay in: they are identities at 0 dB.
    unit.setParams(spec('tilt').params)
    expect(input.targets).toContain(low)
  })
})

describe('transient shaper', () => {
  /** The detector's two depth gains are the gains that drive an AudioParam. */
  function depthGains(ctx: FakeAudioContext): number[] {
    return ctx
      .ofType<FakeGain>('gain')
      .filter((g) => g.targets.some((t) => t.nodeType === 'param'))
      .map((g) => g.gain.destination)
  }

  it('adds attack and sustain to the gain of the audio path, up to 6 dB each way', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(
      ctx.asContext,
      spec('transient', { attack: 100, sustain: -100 }),
      env,
    )
    const [attack, sustain] = depthGains(ctx)
    expect(attack).toBeCloseTo(10 ** (6 / 20) - 1, 12)
    expect(sustain).toBeCloseTo(10 ** (-6 / 20) - 1, 12)
  })

  it('leaves the gain at exactly one at its defaults', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('transient'), env)
    expect(depthGains(ctx)).toEqual([0, 0])
  })

  it('delays the bypass path by the same lookahead as the processed path', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('transient'), env)
    const delays = ctx
      .ofType<FakeDelay>('delay')
      .map((delay) => delay.delayTime.value)
    expect(delays).toEqual([0.003, 0.003])
  })

  it('detects in mono from a 90-degree allpass pair, so a held low note cannot ripple the gain', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('transient'), env)
    const sections = ctx.ofType<FakeIir>('iir')
    expect(sections).toHaveLength(8)
    // Each section is (a^2 - z^-2) / (1 - a^2 z^-2); one chain is a sample later.
    for (const section of sections) {
      const a2 = -section.feedback[2]
      expect(section.feedforward.slice(-3)).toEqual([a2, 0, -1])
    }
    expect(sections.filter((s) => s.feedforward.length === 4)).toHaveLength(1)
    const key = ctx
      .ofType<FakeGain>('gain')
      .find((gain) => gain.gain.value === 0.25)!
    expect(key).toMatchObject({ channelCount: 1, channelCountMode: 'explicit' })
  })
})

describe('stereo', () => {
  it('up-mixes a mono track to both sides before splitting it', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('stereo'), env)
    const splitter = ctx.ofType<FakeNode>('splitter')[0]
    const upmix = ctx
      .ofType<FakeGain>('gain')
      .find((gain) => gain.targets.includes(splitter))!
    expect(upmix).toMatchObject({
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    })
  })

  it('scales the side by the width and removes it below the mono frequency at 24 dB/octave', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(
      ctx.asContext,
      spec('stereo', { widthPct: 130, monoBelowHz: 120 }),
      env,
    )
    expect(
      ctx.ofType<FakeGain>('gain').some((g) => g.gain.destination === 1.3),
    ).toBe(true)
    const monoLow = ctx
      .ofType<FakeBiquad>('biquad')
      .filter((filter) => filter.type === 'highpass')
      .filter((filter) => filter.frequency.destination === 120)
    expect(monoLow.map((filter) => filter.Q.value)).toEqual([
      20 * Math.log10(0.5411961001461969),
      20 * Math.log10(1.3065629648763766),
    ])
  })

  it('sends the Haas copy into the side, where the mono fold-down cancels it', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(
      ctx.asContext,
      spec('stereo', { haasMs: 20, haasAmount: 60 }),
      env,
    )
    const haasDelay = ctx
      .ofType<FakeDelay>('delay')
      .find((delay) => delay.delayTime.destination === 0.02)!
    const level = haasDelay.targets[0] as FakeGain
    expect(level.gain.destination).toBeCloseTo(0.3, 12)
    // The copy reaches the left output directly and the right one inverted.
    const negations = ctx
      .ofType<FakeGain>('gain')
      .filter((gain) => gain.gain.value === -1)
    const sideInverter = negations.find((gain) => reaches(level, gain))
    expect(sideInverter).toBeDefined()
  })

  it('is a straight wire at its defaults: unity width, no mono cut, no Haas', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('stereo'), env)
    const highpasses = ctx
      .ofType<FakeBiquad>('biquad')
      .filter((filter) => filter.type === 'highpass')
      .map((filter) => filter.frequency.destination)
    // The two mono-low stages switch out; the Haas band filter stays at 180 Hz.
    expect(highpasses.sort((a, b) => a - b)).toEqual([0, 0, 180])
  })

  it('leaves a Haas copy at 0 % out of the graph, and fades it in once its delay fills when turned up while playing', () => {
    const { ctx, env } = setup(true)
    ctx.currentTime = 2
    const unit = createEffectUnit(
      ctx.asContext,
      spec('stereo', { haasMs: 20, haasAmount: 0 }),
      env,
    )
    const haasDelay = ctx
      .ofType<FakeDelay>('delay')
      .find((delay) => delay.delayTime.destination === 0.02)!
    const level = haasDelay.targets[0] as FakeGain
    expect(level.targets).toEqual([])
    unit.setParams(spec('stereo', { haasMs: 20, haasAmount: 60 }).params)
    expect(level.targets).toHaveLength(1)
    // Its first samples are a step from nothing: held at zero past them.
    expect(level.gain.events.slice(-2)).toEqual([
      { kind: 'set', time: 2, value: 0 },
      { kind: 'target', time: 2.06, value: 0.3, timeConstant: 0.02 },
    ])
    // Turned down again it stays: leaving while it sounds would step the side.
    unit.setParams(spec('stereo', { haasMs: 20, haasAmount: 0 }).params)
    expect(level.targets).toHaveLength(1)
  })

  it('leaves the whole side out at 0 % width with no Haas, and joins it when widened', () => {
    const { ctx, env } = setup(true)
    const unit = createEffectUnit(
      ctx.asContext,
      spec('stereo', { widthPct: 0, monoBelowHz: 100 }),
      env,
    )
    const stages = ctx
      .ofType<FakeBiquad>('biquad')
      .filter(
        (filter) =>
          filter.type === 'highpass' && filter.frequency.destination === 100,
      )
    const last = stages.find((stage) =>
      stages.every((other) => !stage.targets.includes(other)),
    )!
    const negateSide = last.targets[0] as FakeGain
    expect(last.targets).toHaveLength(1)
    expect(negateSide.targets).toEqual([])
    unit.setParams(spec('stereo', { widthPct: 50, monoBelowHz: 100 }).params)
    expect(last.targets).toHaveLength(2)
    expect(negateSide.targets).toHaveLength(1)
  })
})

describe('delay', () => {
  it('ducks its echoes from the dry signal, down to -6 dB at 50 %', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(ctx.asContext, spec('delay', { duck: 50 }), env)
    const depth = ctx
      .ofType<FakeGain>('gain')
      .find((g) => g.targets.some((t) => t.nodeType === 'param'))!
    expect(depth.gain.destination).toBeCloseTo(-(1 - 10 ** (-6 / 20)), 12)
  })

  it('splits feedback between repeating and crossing over by the ping-pong amount', () => {
    const { ctx, env } = setup(false)
    createEffectUnit(
      ctx.asContext,
      spec('delay', { feedback: 40, pingPong: 25 }),
      env,
    )
    const values = ctx.ofType<FakeGain>('gain').map((g) => g.gain.destination)
    expect(values.filter((v) => Math.abs(v - 0.3) < 1e-9)).toHaveLength(2)
    expect(values.filter((v) => Math.abs(v - 0.1) < 1e-9)).toHaveLength(2)
  })
})

describe('reverb impulse changes', () => {
  function reverb(live: boolean) {
    const harness = setup(live)
    const unit = createEffectUnit(
      harness.ctx.asContext,
      spec('reverb', { decayS: 1 }),
      harness.env,
    )
    const [a, b] = harness.ctx.ofType<FakeConvolver>('convolver')
    return { ...harness, unit, a, b }
  }

  it('loads the first impulse into one convolver and leaves the other detached', () => {
    const { a, b } = reverb(true)
    expect(a.loads).toHaveLength(1)
    expect(b.loads).toHaveLength(0)
  })

  it('loads a new impulse into the idle convolver and cross-fades instead of cutting the tail', () => {
    const { unit, a, b } = reverb(true)
    unit.setParams(spec('reverb', { decayS: 3 }).params)
    expect(a.loads).toHaveLength(1)
    expect(b.loads).toHaveLength(1)
  })

  it('makes a change during a cross-fade wait, then jumps to the latest setting', () => {
    const { ctx, unit, a, b, scheduler } = reverb(true)
    unit.setParams(spec('reverb', { decayS: 2 }).params)
    unit.setParams(spec('reverb', { decayS: 3 }).params)
    unit.setParams(spec('reverb', { decayS: 4 }).params)
    const loaded = () => [...a.loads, ...b.loads].filter(Boolean).length
    expect(loaded()).toBe(2)
    ctx.currentTime = 1
    scheduler.advance(1000)
    expect(loaded()).toBe(3)
    const latest = a.loads.filter(Boolean).at(-1)!
    expect(latest.length).toBe(4 * 48000)
  })

  it('lets the faded-out impulse go once a swap is over', () => {
    const { ctx, unit, a, b, scheduler } = reverb(true)
    unit.setParams(spec('reverb', { decayS: 3 }).params)
    expect(a.buffer).not.toBeNull()
    ctx.currentTime = 1
    scheduler.advance(1000)
    expect(a.buffer).toBeNull()
    expect(b.buffer?.length).toBe(3 * 48000)
  })

  it('ignores a change that only returns to the impulse already playing', () => {
    const { unit, a, b } = reverb(true)
    unit.setParams(spec('reverb', { decayS: 1, mix: 40 }).params)
    expect(a.loads.length + b.loads.length).toBe(1)
  })

  it('cancels a waiting impulse change on dispose', () => {
    const { unit, scheduler } = reverb(true)
    unit.setParams(spec('reverb', { decayS: 2 }).params)
    unit.setParams(spec('reverb', { decayS: 3 }).params)
    unit.dispose()
    expect(scheduler.pendingCount).toBe(0)
  })

  it('swaps in place when nothing is playing', () => {
    const { unit, a, b } = reverb(false)
    unit.setParams(spec('reverb', { decayS: 5 }).params)
    expect(a.loads).toHaveLength(2)
    expect(b.loads).toHaveLength(0)
  })
})

it('reuses shared reverb impulses only while an owner lives and clears disposed buffers', () => {
  const { ctx, env } = setup(false)
  const create = vi.spyOn(ctx, 'createBuffer')
  const first = createEffectUnit(
    ctx.asContext,
    spec('reverb', { decayS: 8 }),
    env,
  )
  const second = createEffectUnit(
    ctx.asContext,
    spec('reverb', { decayS: 8 }),
    env,
  )
  const original = ctx.ofType<FakeConvolver>('convolver')[0].buffer
  expect(create).toHaveBeenCalledTimes(1)
  first.dispose()
  const third = createEffectUnit(
    ctx.asContext,
    spec('reverb', { decayS: 8 }),
    env,
  )
  expect(ctx.ofType<FakeConvolver>('convolver')[4].buffer).toBe(original)
  expect(create).toHaveBeenCalledTimes(1)
  second.dispose()
  third.dispose()
  expect(
    ctx
      .ofType<FakeConvolver>('convolver')
      .every((node) => node.buffer === null),
  ).toBe(true)
  const next = createEffectUnit(
    ctx.asContext,
    spec('reverb', { decayS: 8 }),
    env,
  )
  expect(create).toHaveBeenCalledTimes(2)
  expect(ctx.ofType<FakeConvolver>('convolver')[6].buffer).not.toBe(original)
  next.dispose()
})
