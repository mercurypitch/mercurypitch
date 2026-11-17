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
//
// While its input is monitored (fx-profile.ts `zeroLatency`) it compresses
// with no lookahead: the browser's own processing on a worklet
// (zero-latency-compressor.ts), at the same settings and makeup, so the
// singer hears their voice squeezed and lifted as playback squeezes and
// lifts it, and no later than dry. Its unprocessed path needs no twin
// there. Until that worklet has loaded on the context, the compressor
// passes its input straight through, as the monitor's did before.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin, settleCompressorTwins, } from '@/lib/studio-fx/compressor-twin'
import { dbToGain, linearMix } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, settleRelease, writeParam, } from '@/lib/studio-fx/effect-shell'
import type { ZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createStraightThroughUnit } from './latency-only'

/** A compressor's parameters, on a DynamicsCompressorNode or on the monitor's worklet. */
type CompressorParams = Pick<
  DynamicsCompressorNode,
  'threshold' | 'knee' | 'ratio' | 'attack' | 'release'
>

function writeSettings(
  compressor: CompressorParams,
  p: EffectParams<'compressor'>,
  write: (param: AudioParam, value: number) => void,
): void {
  write(compressor.threshold, p.thresholdDb)
  write(compressor.knee, p.kneeDb)
  write(compressor.ratio, p.ratio)
  write(compressor.attack, p.attackMs / 1000)
  write(compressor.release, p.releaseMs / 1000)
}

/** The compressor on a monitored input: its settings and makeup, nothing looked ahead, and the mix's unprocessed path undelayed. */
function createMonitoredCompressorUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'compressor'>,
  env: EffectEnv,
  compressor: ZeroLatencyCompressor,
): EffectUnit {
  const shell = createEffectShell(
    ctx,
    spec.enabled,
    linearMix(spec.params.mix / 100),
  )
  const makeup = ctx.createGain()
  connectSeries([shell.input, compressor.node, makeup, shell.wet])
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'compressor'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    writeSettings(compressor, p, write)
    write(makeup.gain, dbToGain(p.makeupDb))
    shell.setBalance(linearMix(p.mix / 100), glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'compressor',
    env,
    shell,
    nodes: [compressor.node, makeup],
    apply: (params, glide) =>
      apply(params as EffectParams<'compressor'>, glide),
    onDispose: () => compressor.dispose(),
  })
}

export function createCompressorUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'compressor'>,
  env: EffectEnv,
): EffectUnit {
  if (env.profile?.zeroLatency === true) {
    const monitored = createZeroLatencyCompressor(ctx)
    return monitored === null
      ? createStraightThroughUnit(ctx, spec)
      : createMonitoredCompressorUnit(ctx, spec, env, monitored)
  }
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

  let release = spec.params.releaseMs / 1000
  const apply = (p: EffectParams<'compressor'>, glide: boolean): void => {
    release = p.releaseMs / 1000
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    writeSettings(compressor, p, write)
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
    settle: (at) => {
      settleRelease(compressor.release, at, release)
      settleCompressorTwins([dryTwin], at)
    },
  })
}
