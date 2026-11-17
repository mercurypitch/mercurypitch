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
//
// Bands run side by side, not one after another (chain.ts): in a run of
// dynamic EQs, each band after the first detects and corrects the run's own
// input x, and passes the signal it is handed through with no delay of its
// own. The run then adds one lookahead, not one per band:
//
//   out = D(x) + sum over bands of m (C(bp(x)) - D(bp(x)))
//
// While no band compresses this is D(x), as in series. When two bands cut at
// once, each measures x rather than what the band before it left, which
// differs from series only where their bandpasses overlap.
//
// While its input is monitored (fx-profile.ts `zeroLatency`) C is the
// monitor's compressor worklet (zero-latency-compressor.ts), the browser's
// own processing with no lookahead, at the same settings, and nothing is
// late, so D is a plain wire:
//
//   out = x + m (K(bp(x)) - bp(x))
//
// K settles the band as C does, up to 6 ms later, and while it is idle it
// passes the band at exactly 1, so the difference is exactly 0 and the
// expression x, to the bit. No node adds more than two signals: a sum of
// three can round differently in another order, and the order a node adds
// its inputs in can differ between two builds of the same chain. Runs form
// as in playback, so each band hears what it hears there. Until that worklet has
// loaded on the context, the band passes its input straight through.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { compressorAutoMakeupGain } from '@/lib/studio-fx/compressor-curve'
import { createCompressorTwin, settleCompressorTwins, } from '@/lib/studio-fx/compressor-twin'
import { dbToGain, gainToDb, WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createEffectShell, settleRelease, writeParam, } from '@/lib/studio-fx/effect-shell'
import type { ZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createZeroLatencyCompressor } from '@/lib/studio-fx/zero-latency-compressor'
import { createStraightThroughUnit } from './latency-only'

const DYNEQ_KNEE_DB = 4

/** The share of the band a range lets the compressor work on. */
const rangeShare = (rangeDb: number): number => 1 - dbToGain(-rangeDb)

/** The band's compressor settings, on a DynamicsCompressorNode or on the monitor's worklet. */
function writeBandSettings(
  compressor: Pick<
    DynamicsCompressorNode,
    'threshold' | 'ratio' | 'attack' | 'release'
  >,
  p: EffectParams<'dyneq'>,
  write: (param: AudioParam, value: number) => void,
): void {
  write(compressor.threshold, p.thresholdDb)
  write(compressor.ratio, p.ratio)
  write(compressor.attack, p.attackMs / 1000)
  write(compressor.release, p.releaseMs / 1000)
}

function createBand(ctx: BaseAudioContext): BiquadFilterNode {
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  return band
}

/** The band on a monitored input: compressed on the worklet with nothing looked ahead, so no path needs a twin. */
function createMonitoredDynamicEqUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'dyneq'>,
  env: EffectEnv,
  compressor: ZeroLatencyCompressor,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const band = createBand(ctx)
  compressor.knee.value = DYNEQ_KNEE_DB
  const negate = ctx.createGain()
  negate.gain.value = -1
  // K(bp) - bp: what the worklet takes from the band, exactly 0 while idle.
  const taken = ctx.createGain()
  const share = ctx.createGain()
  const sum = ctx.createGain()
  shell.input.connect(sum)
  shell.input.connect(band)
  connectSeries([band, negate, taken])
  connectSeries([band, compressor.node, taken, share, sum])
  sum.connect(shell.wet)
  shell.input.connect(shell.dry)
  let following = false
  const follow = (source: AudioNode | null): void => {
    const next = source !== null
    if (next !== following) {
      // Following, the band hears the run's input; its own passes on whole.
      if (next) shell.input.disconnect(band)
      else shell.input.connect(band)
      following = next
    }
    source?.connect(band)
  }

  const apply = (p: EffectParams<'dyneq'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    write(band.frequency, p.frequencyHz)
    write(band.Q, p.q)
    writeBandSettings(compressor, p, write)
    write(share.gain, rangeShare(p.rangeDb))
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'dyneq',
    env,
    shell,
    nodes: [band, negate, compressor.node, taken, share, sum],
    apply: (params, glide) => apply(params as EffectParams<'dyneq'>, glide),
    follow,
    onDispose: () => compressor.dispose(),
  })
}

export function createDynamicEqUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'dyneq'>,
  env: EffectEnv,
): EffectUnit {
  if (env.profile?.zeroLatency === true) {
    const monitored = createZeroLatencyCompressor(ctx)
    return monitored === null
      ? createStraightThroughUnit(ctx, spec)
      : createMonitoredDynamicEqUnit(ctx, spec, env, monitored)
  }
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const band = createBand(ctx)
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
  let following = false
  const follow = (source: AudioNode | null): void => {
    const next = source !== null
    if (next !== following) {
      if (following) {
        shell.input.disconnect(sum)
        shell.input.disconnect(shell.dry)
        shell.input.connect(band)
        connectSeries([shell.input, wholeTwin, sum])
        connectSeries([shell.input, dryTwin, shell.dry])
      } else {
        shell.input.disconnect(band)
        shell.input.disconnect(wholeTwin)
        shell.input.disconnect(dryTwin)
        wholeTwin.disconnect()
        dryTwin.disconnect()
        // What it is handed is already late by the run's lookahead.
        shell.input.connect(sum)
        shell.input.connect(shell.dry)
      }
      following = next
    }
    source?.connect(band)
  }
  let share = 0
  let release = spec.params.releaseMs / 1000

  const apply = (p: EffectParams<'dyneq'>, glide: boolean): void => {
    release = p.releaseMs / 1000
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    share = rangeShare(p.rangeDb)
    write(band.frequency, p.frequencyHz)
    write(band.Q, p.q)
    writeBandSettings(compressor, p, write)
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
    follow,
    settle: (at) => {
      settleRelease(compressor.release, at, release)
      settleCompressorTwins([wholeTwin, bandTwin, dryTwin], at)
    },
  })
}
