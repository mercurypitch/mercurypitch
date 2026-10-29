// ============================================================
// Studio dynamic EQ — one band, cut only while it is too loud
// ============================================================
//
// fx-lab's front end cleans a voice this way: mud, box, nasal and harsh zones
// are pulled back only while they are actually loud, so a take that does not
// need it passes untouched. Web Audio has no dynamic EQ or sidechain, so the
// band is taken out and put back:
//
//   out = D(x) - D(bp(x)) + (1 - m) D(bp(x)) + m C(bp(x))
//
// bp is a constant-peak bandpass at the band's centre, C a compressor on that
// band (its automatic makeup divided out) and D its twin, a delay of the
// same lookahead. While C is idle, C = D (to the compressor's own 1e-5 gain
// rounding) and the expression is D(x): flat, no phase step, nothing to notch. When C pulls the band down,
// only `m` of it is compressed, so the cut can never pass the range:
// m = 1 - 10^(-range/20), and at most the band falls to 1 - m.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin } from '@/lib/studio-fx/compressor-twin'
import { dbToGain, gainToDb, WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

const DYNEQ_KNEE_DB = 4

export function createDynamicEqUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'dyneq'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  const wholeTwin = createCompressorTwin(ctx)
  const bandTwin = createCompressorTwin(ctx)
  const removeBand = ctx.createGain()
  const keptBand = ctx.createGain()
  const compressor = ctx.createDynamicsCompressor()
  compressor.knee.value = DYNEQ_KNEE_DB
  const cancelAutoMakeup = ctx.createGain()
  const compressedBand = ctx.createGain()
  const sum = ctx.createGain()
  connectSeries([shell.input, wholeTwin, sum])
  shell.input.connect(band)
  connectSeries([band, bandTwin, removeBand, sum])
  bandTwin.connect(keptBand).connect(sum)
  connectSeries([band, compressor, cancelAutoMakeup, compressedBand, sum])
  sum.connect(shell.wet)
  const dryTwin = createCompressorTwin(ctx)
  connectSeries([shell.input, dryTwin, shell.dry])
  let share = 0

  const apply = (p: EffectParams<'dyneq'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    share = 1 - dbToGain(-p.rangeDb)
    write(band.frequency, p.frequencyHz)
    write(band.Q, p.q)
    write(compressor.threshold, p.thresholdDb)
    write(compressor.ratio, p.ratio)
    write(compressor.attack, p.attackMs / 1000)
    write(compressor.release, p.releaseMs / 1000)
    write(
      cancelAutoMakeup.gain,
      1 / compressorAutoMakeupGain(p.thresholdDb, DYNEQ_KNEE_DB, p.ratio),
    )
    write(removeBand.gain, -1)
    write(keptBand.gain, 1 - share)
    write(compressedBand.gain, share)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'dyneq',
    env,
    shell,
    nodes: [
      band,
      wholeTwin,
      bandTwin,
      removeBand,
      keptBand,
      compressor,
      cancelAutoMakeup,
      compressedBand,
      sum,
      dryTwin,
    ],
    apply: (params, glide) => apply(params as EffectParams<'dyneq'>, glide),
    // The cut the band actually gets, which the range bounds, rather than the
    // inner compressor's own reduction.
    readReductionDb: () =>
      gainToDb(1 - share + share * dbToGain(compressor.reduction)),
  })
}
