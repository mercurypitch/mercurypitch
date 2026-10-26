// ============================================================
// Studio tilt — one control from dark to bright
// ============================================================
//
// The beginner's tone control: a 4 kHz high shelf moves by `brightnessDb`
// and a 250 Hz low shelf by half as much the other way, so brighter also
// thins a little and darker also warms, and the overall level stays close.
// Two biquads, no latency; at 0 dB both shelves are exact identities, which
// is why every role chain can carry one at no cost to its sound.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

export const TILT_LOW_HZ = 250
export const TILT_HIGH_HZ = 4000

function shelf(
  ctx: BaseAudioContext,
  type: 'lowshelf' | 'highshelf',
  hz: number,
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = hz
  return filter
}

export function createTiltUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'tilt'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const low = shelf(ctx, 'lowshelf', TILT_LOW_HZ)
  const high = shelf(ctx, 'highshelf', TILT_HIGH_HZ)
  connectSeries([shell.input, low, high, shell.wet])
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'tilt'>, glide: boolean): void => {
    writeParam(low.gain, -p.brightnessDb / 2, ctx, glide)
    writeParam(high.gain, p.brightnessDb, ctx, glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'tilt',
    env,
    shell,
    nodes: [low, high],
    apply: (params, glide) => apply(params as EffectParams<'tilt'>, glide),
  })
}
