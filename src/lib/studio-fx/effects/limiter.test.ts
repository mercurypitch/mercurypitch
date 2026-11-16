// Studio limiter on a monitored input — no compressor and nothing oversampled, so nothing looks ahead; the input gain still plays, and the ceiling as a soft clip that passes a signal 3 dB under it untouched and holds a louder one at the ceiling; bypassed, a plain wire.
import { describe, expect, it } from 'vitest'
import type { EffectSpec } from '@/lib/studio-fx/chain-spec'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { dbToGain, gainToDb } from '@/lib/studio-fx/dsp'
import type { FakeGain, FakeNode, FakeShaper, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { createManualScheduler, FakeAudioContext, } from '@/lib/studio-fx/fake-audio-graph.test-fixtures'
import { MONITOR_FX_PROFILE } from '@/lib/studio-fx/fx-profile'
import { createEffectUnit } from './index'

function limiter(params: Record<string, number>, enabled = true): EffectSpec {
  return normalizeChainSpec({
    effects: [{ kind: 'limiter', params, enabled }],
  }).effects[0]
}

/** The limiter as the monitor builds it, on a graph of fakes. */
function monitored(spec: EffectSpec) {
  const ctx = new FakeAudioContext()
  ctx.state = 'suspended'
  const unit = createEffectUnit(ctx.asContext, spec, {
    isLive: () => false,
    schedule: createManualScheduler().schedule,
    profile: MONITOR_FX_PROFILE,
  })
  return {
    ctx,
    input: unit.input as unknown as FakeNode,
    output: unit.output as unknown as FakeNode,
  }
}

/** A WaveShaperNode's curve at `x`, interpolated as the Web Audio spec reads it. */
function shape(curve: Float32Array, x: number): number {
  const v = ((curve.length - 1) / 2) * (x + 1)
  if (v <= 0) return curve[0]
  if (v >= curve.length - 1) return curve[curve.length - 1]
  const k = Math.floor(v)
  const f = v - k
  return (1 - f) * curve[k] + f * curve[k + 1]
}

/** What a steady sample `x` at the input comes out as: every path from input to output, its gains and curves in turn. */
function transfer(input: FakeNode, output: FakeNode, x: number): number {
  const walk = (node: FakeNode, value: number): number => {
    let through = value
    if (node.nodeType === 'gain') through *= (node as FakeGain).gain.destination
    if (node.nodeType === 'shaper')
      through = shape((node as FakeShaper).curve!, through)
    if (node === output) return through
    return node.targets.reduce((sum, next) => sum + walk(next, through), 0)
  }
  return walk(input, x)
}

describe('the limiter on a monitored input', () => {
  it('looks no way ahead: no compressor, no delay, and no shaper oversampled', () => {
    const { ctx } = monitored(limiter({}))

    expect(ctx.ofType('compressor')).toEqual([])
    expect(ctx.ofType('delay')).toEqual([])
    const shapers = ctx.ofType<FakeShaper>('shaper')
    expect(shapers).toHaveLength(2)
    expect(shapers.map((shaper) => shaper.oversample)).toEqual(['none', 'none'])
  })

  it('passes a signal 3 dB under its ceiling untouched, the input gain included', () => {
    const { input, output } = monitored(
      limiter({ ceilingDb: -1.5, driveDb: 2 }),
    )

    for (const levelDb of [-40, -12, -6.5]) {
      const x = dbToGain(levelDb)
      expect(gainToDb(transfer(input, output, x))).toBeCloseTo(levelDb + 2, 4)
      expect(gainToDb(-transfer(input, output, -x))).toBeCloseTo(levelDb + 2, 4)
    }
  })

  it('holds a signal driven past its ceiling at the ceiling, never over it', () => {
    const { input, output } = monitored(limiter({ ceilingDb: -1.5 }))
    const ceiling = dbToGain(-1.5)

    for (const levelDb of [-1, 0, 6.5, 12, 24]) {
      const y = transfer(input, output, dbToGain(levelDb))
      expect(y).toBeLessThanOrEqual(ceiling)
      expect(y).toBeGreaterThan(dbToGain(-2.5))
    }
  })

  it('moves its ceiling with the setting', () => {
    const { input, output } = monitored(limiter({ ceilingDb: -6 }))

    expect(gainToDb(transfer(input, output, dbToGain(6)))).toBeLessThanOrEqual(
      -6,
    )
    expect(gainToDb(transfer(input, output, dbToGain(-9.5)))).toBeCloseTo(
      -9.5,
      4,
    )
  })

  it('passes the input on a plain wire while bypassed', () => {
    const { input, output } = monitored(limiter({ ceilingDb: -6 }, false))

    expect(transfer(input, output, dbToGain(6))).toBeCloseTo(dbToGain(6), 6)
  })
})
