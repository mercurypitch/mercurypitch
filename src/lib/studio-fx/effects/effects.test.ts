import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EffectSpec } from '@/lib/studio-fx/chain-spec'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { measureCompressorLatency, resetCompressorLatencyForTests, } from '@/lib/studio-fx/compressor-twin'
import { EFFECT_KINDS } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv } from '@/lib/studio-fx/effect-shell'
import type { FakeBiquad, FakeCompressor, FakeConvolver, FakeDelay, FakeGain, FakeIir, FakeNode, FakeShaper, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, fakeImpulseRenderContext, reaches, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
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
    createEffectUnit(ctx.asContext, spec('tilt', { brightnessDb: 4 }), env)
    const shelves = ctx.ofType<FakeBiquad>('biquad')
    expect(
      shelves.map((s) => [s.type, s.frequency.value, s.gain.destination]),
    ).toEqual([
      ['lowshelf', 250, -2],
      ['highshelf', 4000, 4],
    ])
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
    expect(a.loads.length + b.loads.length).toBe(2)
    ctx.currentTime = 1
    scheduler.advance(1000)
    expect(a.loads.length + b.loads.length).toBe(3)
    const latest = a.loads.at(-1)!
    expect(latest.length).toBe(4 * 48000)
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
