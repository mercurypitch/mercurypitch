// ============================================================
// Studio de-esser — split-band compression of the sibilant band
// ============================================================
//
// Web Audio has no sidechain input, so instead of keying a full-band
// compressor from the sibilance, the signal is split at `frequencyHz` with a
// Linkwitz-Riley crossover (two Butterworths per side, which sum back to flat
// magnitude), only the upper band is compressed, and the bands are summed.
// The compressor hears and acts on the top band alone, so an "s" is turned
// down while the body of the voice is left untouched.
//
// The low band runs through a compressor twin so both bands carry the same
// lookahead delay; without it the sum would notch right at the crossover.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin } from '@/lib/studio-fx/compressor-twin'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

const DEESSER_KNEE_DB = 3
const DEESSER_ATTACK_SECONDS = 0.001
const DEESSER_RELEASE_SECONDS = 0.06

export function createDeesserUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'deesser'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const lowA = createButterworth(ctx, 'lowpass')
  const lowB = createButterworth(ctx, 'lowpass')
  const highA = createButterworth(ctx, 'highpass')
  const highB = createButterworth(ctx, 'highpass')
  const lowTwin = createCompressorTwin(ctx)
  const compressor = ctx.createDynamicsCompressor()
  compressor.knee.value = DEESSER_KNEE_DB
  compressor.attack.value = DEESSER_ATTACK_SECONDS
  compressor.release.value = DEESSER_RELEASE_SECONDS
  const cancelAutoMakeup = ctx.createGain()
  const sum = ctx.createGain()
  const dryTwin = createCompressorTwin(ctx)
  connectSeries([shell.input, lowA, lowB, lowTwin, sum])
  connectSeries([shell.input, highA, highB, compressor, cancelAutoMakeup, sum])
  sum.connect(shell.wet)
  connectSeries([shell.input, dryTwin, shell.dry])
  const crossover = [lowA, lowB, highA, highB]

  const apply = (p: EffectParams<'deesser'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    for (const filter of crossover) write(filter.frequency, p.frequencyHz)
    write(compressor.threshold, p.thresholdDb)
    write(compressor.ratio, p.ratio)
    write(
      cancelAutoMakeup.gain,
      1 / compressorAutoMakeupGain(p.thresholdDb, DEESSER_KNEE_DB, p.ratio),
    )
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'deesser',
    env,
    shell,
    nodes: [...crossover, lowTwin, compressor, cancelAutoMakeup, sum, dryTwin],
    apply: (params, glide) => apply(params as EffectParams<'deesser'>, glide),
    readReductionDb: () => compressor.reduction,
  })
}
