// ============================================================
// Studio limiter — fast compressor, soft ceiling, hard backstop
// ============================================================
//
// Three stages. A 20:1 compressor with a 1 ms attack, its threshold 1.5 dB
// under the ceiling, does the audible work; browsers give it a few
// milliseconds of lookahead, so it is usually down before a transient lands.
// What it lets through meets an oversampled soft-clip curve that is linear to
// 90 % of the ceiling and rounds off towards it. Oversampling keeps that
// rounding free of aliasing, but its downsampler rings: on a lone full-scale
// click it measured 0.9 dB over the ceiling (Chrome 153). The last stage is
// a hard clamp run without oversampling — no filter after it — which is an
// exact straight line below the ceiling and a wall at it. Output samples
// cannot exceed the ceiling.
//
// A safety limiter for a master bus, not a true-peak mastering limiter: the
// samples are bounded, the waveform between them is not.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin, settleCompressorTwins, } from '@/lib/studio-fx/compressor-twin'
import type { ShaperCurve } from '@/lib/studio-fx/dsp'
import { createHardClampCurve, createSoftClipCurve, dbToGain, HARD_CLAMP_DOMAIN, SOFT_CLIP_DOMAIN, WET_ONLY, } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, createIdentityShaperPath, createShaperPath, settleRelease, writeParam, } from '@/lib/studio-fx/effect-shell'

const LIMITER_HEADROOM_DB = 1.5
const LIMITER_RATIO = 20
const LIMITER_ATTACK_SECONDS = 0.001

let curves: { soft: ShaperCurve; hard: ShaperCurve } | null = null

function limiterCurves(): { soft: ShaperCurve; hard: ShaperCurve } {
  curves ??= { soft: createSoftClipCurve(), hard: createHardClampCurve() }
  return curves
}

export function createLimiterUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'limiter'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const drive = ctx.createGain()
  const compressor = ctx.createDynamicsCompressor()
  compressor.knee.value = 0
  compressor.ratio.value = LIMITER_RATIO
  compressor.attack.value = LIMITER_ATTACK_SECONDS
  const cancelAutoMakeup = ctx.createGain()
  const soft = createShaperPath(ctx, limiterCurves().soft)
  const hard = createShaperPath(ctx, limiterCurves().hard, 'none')
  const dryCompressor = createCompressorTwin(ctx)
  const dryShaper = createIdentityShaperPath(ctx)
  connectSeries([shell.input, drive, compressor, cancelAutoMakeup, soft.input])
  connectSeries([soft.output, hard.input])
  hard.output.connect(shell.wet)
  connectSeries([shell.input, dryCompressor, dryShaper.input])
  dryShaper.output.connect(shell.dry)

  let release = spec.params.releaseMs / 1000
  const apply = (p: EffectParams<'limiter'>, glide: boolean): void => {
    release = p.releaseMs / 1000
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    const threshold = p.ceilingDb - LIMITER_HEADROOM_DB
    const ceiling = dbToGain(p.ceilingDb)
    write(drive.gain, dbToGain(p.driveDb))
    write(compressor.threshold, threshold)
    write(compressor.release, p.releaseMs / 1000)
    write(
      cancelAutoMakeup.gain,
      1 / compressorAutoMakeupGain(threshold, 0, LIMITER_RATIO),
    )
    write(soft.input.gain, 1 / (ceiling * SOFT_CLIP_DOMAIN))
    write(soft.output.gain, ceiling * SOFT_CLIP_DOMAIN)
    write(hard.input.gain, 1 / (ceiling * HARD_CLAMP_DOMAIN))
    write(hard.output.gain, ceiling * HARD_CLAMP_DOMAIN)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'limiter',
    env,
    shell,
    nodes: [
      drive,
      compressor,
      cancelAutoMakeup,
      ...soft.nodes,
      ...hard.nodes,
      dryCompressor,
      ...dryShaper.nodes,
    ],
    apply: (params, glide) => apply(params as EffectParams<'limiter'>, glide),
    readReductionDb: () => compressor.reduction,
    settle: (at) => {
      settleRelease(compressor.release, at, release)
      settleCompressorTwins([dryCompressor], at)
    },
  })
}
