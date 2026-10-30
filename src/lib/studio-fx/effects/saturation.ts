// ============================================================
// Studio saturation — oversampled tanh drive with tone and mix
// ============================================================
//
// y = tanh(g x) / g: quiet material passes at unity and peaks are rounded
// off, so turning the drive up adds density and harmonics rather than mere
// volume. Drive is a gain before the shaper and its inverse after it — the
// curve itself never changes, so drive glides like any other control.
//
// The shaper runs 4x oversampled to keep the new harmonics from folding back
// as aliasing. Oversampling delays the signal, so the unprocessed side of the
// mix runs through an identity shaper with the same oversampling.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import type { ShaperCurve } from '@/lib/studio-fx/dsp'
import { createSaturationCurve, dbToGain, linearMix, SATURATION_DOMAIN, } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, createButterworth, createEffectShell, createIdentityShaperPath, createShaperPath, highCutFrequency, writeParam, } from '@/lib/studio-fx/effect-shell'
import { shaperOversample } from '@/lib/studio-fx/fx-profile'

let sharedCurve: ShaperCurve | null = null

function saturationCurve(): ShaperCurve {
  sharedCurve ??= createSaturationCurve()
  return sharedCurve
}

export function createSaturationUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'saturation'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(
    ctx,
    spec.enabled,
    linearMix(spec.params.mix / 100),
  )
  const oversample = shaperOversample(env.profile, 'saturation')
  const drive = createShaperPath(ctx, saturationCurve(), oversample)
  const tone = createButterworth(ctx, 'lowpass')
  const dryTwin = createIdentityShaperPath(ctx, oversample)
  shell.input.connect(drive.input)
  drive.output.connect(tone)
  tone.connect(shell.wet)
  shell.input.connect(dryTwin.input)
  dryTwin.output.connect(shell.dry)

  const apply = (p: EffectParams<'saturation'>, glide: boolean): void => {
    const driveGain = dbToGain(p.driveDb)
    const restore = (SATURATION_DOMAIN / driveGain) * dbToGain(p.outputDb)
    writeParam(drive.input.gain, driveGain / SATURATION_DOMAIN, ctx, glide)
    writeParam(drive.output.gain, restore, ctx, glide)
    writeParam(
      tone.frequency,
      highCutFrequency(p.toneHz, ctx.sampleRate),
      ctx,
      glide,
    )
    shell.setBalance(linearMix(p.mix / 100), glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'saturation',
    env,
    shell,
    nodes: [...drive.nodes, tone, ...dryTwin.nodes],
    apply: (params, glide) =>
      apply(params as EffectParams<'saturation'>, glide),
  })
}
