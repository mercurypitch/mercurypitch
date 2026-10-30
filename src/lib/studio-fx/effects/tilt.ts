// ============================================================
// Studio tilt — one control from dark to bright
// ============================================================
//
// The beginner's tone control: a 4 kHz high shelf moves by `brightnessDb`
// and a 250 Hz low shelf by half as much the other way, so brighter also
// thins a little and darker also warms, and the overall level stays close.
// Two biquads, no latency; at 0 dB both shelves are exact identities, which
// is why every role chain can carry one at no cost to its sound.
//
// Nor at a cost to the audio thread: a tilt that starts flat leaves its
// shelves out, its input passing straight through, and brings them in the
// first time it moves. They come in flat, so the two paths carry the same
// signal and the crossfade between them is silent; then the shelves glide
// to their new gains as any change does.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, BYPASS_GLIDE_SECONDS, connectSeries, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

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
  const through = ctx.createGain()
  const shelved = ctx.createGain()
  shelved.gain.value = 0
  connectSeries([shell.input, through, shell.wet])
  shell.input.connect(shell.dry)
  let shelvesIn = false
  const bringShelvesIn = (glide: boolean): void => {
    shelvesIn = true
    connectSeries([shell.input, low, high, shelved, shell.wet])
    writeParam(shelved.gain, 1, ctx, glide, BYPASS_GLIDE_SECONDS)
    writeParam(through.gain, 0, ctx, glide, BYPASS_GLIDE_SECONDS)
    // Built, or changed while nothing plays: nothing to cross, so it leaves.
    if (!glide) through.disconnect()
  }

  const apply = (p: EffectParams<'tilt'>, glide: boolean): void => {
    if (!shelvesIn && p.brightnessDb !== 0) bringShelvesIn(glide)
    writeParam(low.gain, -p.brightnessDb / 2, ctx, glide)
    writeParam(high.gain, p.brightnessDb, ctx, glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'tilt',
    env,
    shell,
    nodes: [low, high, through, shelved],
    apply: (params, glide) => apply(params as EffectParams<'tilt'>, glide),
  })
}
