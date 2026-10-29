// ============================================================
// Studio compressor — explicit makeup, latency-matched parallel mix
// ============================================================
//
// DynamicsCompressorNode with its automatic makeup gain divided back out (see
// compressor-curve.ts), so it sits at unity below threshold and "Makeup" is
// the only thing that raises the level. Bypassing it therefore compares like
// with like instead of rewarding the louder side.
//
// Mix blends in the unprocessed signal for parallel ("New York") compression.
// That path runs through a compressor twin (the measured lookahead as a
// delay), so the two sum without comb filtering.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin } from '@/lib/studio-fx/compressor-twin'
import { dbToGain, linearMix } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

export function createCompressorUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'compressor'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(
    ctx,
    spec.enabled,
    linearMix(spec.params.mix / 100),
  )
  const compressor = ctx.createDynamicsCompressor()
  const cancelAutoMakeup = ctx.createGain()
  const makeup = ctx.createGain()
  const dryTwin = createCompressorTwin(ctx)
  connectSeries([shell.input, compressor, cancelAutoMakeup, makeup, shell.wet])
  connectSeries([shell.input, dryTwin, shell.dry])

  const apply = (p: EffectParams<'compressor'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    write(compressor.threshold, p.thresholdDb)
    write(compressor.knee, p.kneeDb)
    write(compressor.ratio, p.ratio)
    write(compressor.attack, p.attackMs / 1000)
    write(compressor.release, p.releaseMs / 1000)
    write(
      cancelAutoMakeup.gain,
      1 / compressorAutoMakeupGain(p.thresholdDb, p.kneeDb, p.ratio),
    )
    write(makeup.gain, dbToGain(p.makeupDb))
    shell.setBalance(linearMix(p.mix / 100), glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'compressor',
    env,
    shell,
    nodes: [compressor, cancelAutoMakeup, makeup, dryTwin],
    apply: (params, glide) =>
      apply(params as EffectParams<'compressor'>, glide),
    readReductionDb: () => compressor.reduction,
  })
}
