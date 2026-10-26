// ============================================================
// Studio air — harmonic excitation instead of a treble boost
// ============================================================
//
// fx-lab's "Air": the top of the voice is brightened with new harmonics
// rather than by turning the existing ones up, so it adds shine without
// raising hiss or edge. The band above `frequencyHz` goes through an even
// curve, tanh(g x)^2 / g, which turns each partial into its octave (plus DC
// and sum and difference tones); a highpass at the band edge keeps what lies
// above it, and the result is added under the untouched signal at `amount`.
//
// The curve is quadratic for quiet input and bounded for loud input, so the
// effect follows the voice — shine on open sung notes, almost nothing in the
// gaps, and a sibilant cannot push it past a fixed level. The shaper runs 4x
// oversampled so its harmonics do not fold back as aliasing; the untouched
// path runs through a matching identity shaper so the two line up.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import type { ShaperCurve } from '@/lib/studio-fx/dsp'
import { createEvenHarmonicCurve, dbToGain, SATURATION_DOMAIN, } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, createIdentityShaperPath, createShaperPath, writeParam, } from '@/lib/studio-fx/effect-shell'

const HARMONIC_CEILING_HZ = 18000

let sharedCurve: ShaperCurve | null = null

function exciterCurve(): ShaperCurve {
  sharedCurve ??= createEvenHarmonicCurve()
  return sharedCurve
}

export function createExciterUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'exciter'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, {
    dry: 1,
    wet: spec.params.amount / 100,
  })
  const bandIn = createButterworth(ctx, 'highpass')
  const harmonics = createShaperPath(ctx, exciterCurve())
  const bandOut = createButterworth(ctx, 'highpass')
  const ceiling = createButterworth(ctx, 'lowpass')
  const dryTwin = createIdentityShaperPath(ctx)
  connectSeries([shell.input, bandIn, harmonics.input])
  connectSeries([harmonics.output, bandOut, ceiling, shell.wet])
  shell.input.connect(dryTwin.input)
  dryTwin.output.connect(shell.dry)

  const apply = (p: EffectParams<'exciter'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    const drive = dbToGain(p.driveDb)
    write(bandIn.frequency, p.frequencyHz)
    write(bandOut.frequency, p.frequencyHz)
    write(
      ceiling.frequency,
      Math.min(HARMONIC_CEILING_HZ, ctx.sampleRate * 0.45),
    )
    write(harmonics.input.gain, drive / SATURATION_DOMAIN)
    write(harmonics.output.gain, SATURATION_DOMAIN / drive)
    shell.setBalance({ dry: 1, wet: p.amount / 100 }, glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'exciter',
    env,
    shell,
    nodes: [bandIn, ...harmonics.nodes, bandOut, ceiling, ...dryTwin.nodes],
    apply: (params, glide) => apply(params as EffectParams<'exciter'>, glide),
  })
}
