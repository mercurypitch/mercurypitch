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
//
// While its input is monitored (fx-profile.ts `zeroLatency`) the top band
// compresses on the monitor's compressor worklet (zero-latency-compressor.ts):
// the browser's own processing with no lookahead, at the same settings,
// after the same crossover. Nothing on any path is late, so no path needs a
// twin, and the singer hears an "s" turned down as playback turns it down,
// no later than dry. Until that worklet has loaded on the context, the
// de-esser passes its input straight through.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin, settleCompressorTwins, } from '@/lib/studio-fx/compressor-twin'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, settleRelease, writeParam, } from '@/lib/studio-fx/effect-shell'
import type { ZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createStraightThroughUnit } from './latency-only'

const DEESSER_KNEE_DB = 3
const DEESSER_ATTACK_SECONDS = 0.001
const DEESSER_RELEASE_SECONDS = 0.06

/** The crossover: two lowpasses for the body, two highpasses for the sibilant band. */
function createCrossover(ctx: BaseAudioContext) {
  return {
    low: [createButterworth(ctx, 'lowpass'), createButterworth(ctx, 'lowpass')],
    high: [
      createButterworth(ctx, 'highpass'),
      createButterworth(ctx, 'highpass'),
    ],
  } as const
}

/** The de-esser on a monitored input: the same split, its sibilant band compressed on the worklet with nothing looked ahead, and no twins. */
function createMonitoredDeesserUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'deesser'>,
  env: EffectEnv,
  compressor: ZeroLatencyCompressor,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const { low, high } = createCrossover(ctx)
  compressor.knee.value = DEESSER_KNEE_DB
  compressor.attack.value = DEESSER_ATTACK_SECONDS
  compressor.release.value = DEESSER_RELEASE_SECONDS
  const sum = ctx.createGain()
  connectSeries([shell.input, ...low, sum])
  connectSeries([shell.input, ...high, compressor.node, sum])
  sum.connect(shell.wet)
  shell.input.connect(shell.dry)
  const crossover = [...low, ...high]

  const apply = (p: EffectParams<'deesser'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    for (const filter of crossover) write(filter.frequency, p.frequencyHz)
    write(compressor.threshold, p.thresholdDb)
    write(compressor.ratio, p.ratio)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'deesser',
    env,
    shell,
    nodes: [...crossover, compressor.node, sum],
    apply: (params, glide) => apply(params as EffectParams<'deesser'>, glide),
    onDispose: () => compressor.dispose(),
  })
}

export function createDeesserUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'deesser'>,
  env: EffectEnv,
): EffectUnit {
  if (env.profile?.zeroLatency === true) {
    const monitored = createZeroLatencyCompressor(ctx)
    return monitored === null
      ? createStraightThroughUnit(ctx, spec)
      : createMonitoredDeesserUnit(ctx, spec, env, monitored)
  }
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const { low, high } = createCrossover(ctx)
  const lowTwin = createCompressorTwin(ctx)
  const compressor = ctx.createDynamicsCompressor()
  compressor.knee.value = DEESSER_KNEE_DB
  compressor.attack.value = DEESSER_ATTACK_SECONDS
  compressor.release.value = DEESSER_RELEASE_SECONDS
  const cancelAutoMakeup = ctx.createGain()
  const sum = ctx.createGain()
  const dryTwin = createCompressorTwin(ctx)
  connectSeries([shell.input, ...low, lowTwin, sum])
  connectSeries([shell.input, ...high, compressor, cancelAutoMakeup, sum])
  sum.connect(shell.wet)
  connectSeries([shell.input, dryTwin, shell.dry])
  const crossover = [...low, ...high]

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
    settle: (at) => {
      settleRelease(compressor.release, at, DEESSER_RELEASE_SECONDS)
      settleCompressorTwins([lowTwin, dryTwin], at)
    },
  })
}
