// ============================================================
// Studio gain — level match and balance trims
// ============================================================
//
// The first stage of every auto-mix chain (bringing a measured clip to the
// reference loudness its thresholds were voiced for) and, at the end, the
// role's place in the balance. A gain is latency-free, so bypass is a wire.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { dbToGain, WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

export function createGainUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'gain'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const trim = ctx.createGain()
  connectSeries([shell.input, trim, shell.wet])
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'gain'>, glide: boolean): void => {
    writeParam(trim.gain, dbToGain(p.gainDb), ctx, glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'gain',
    env,
    shell,
    nodes: [trim],
    apply: (params, glide) => apply(params as EffectParams<'gain'>, glide),
  })
}
