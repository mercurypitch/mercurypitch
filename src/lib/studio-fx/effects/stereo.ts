// ============================================================
// Studio stereo — width, a mono low end and mono-safe Haas widening
// ============================================================
//
// Mid/side: mid = (L + R) / 2 and side = (L - R) / 2, then L = mid + side'
// and R = mid - side'. Width scales the side: 0 % folds the track to mono,
// 100 % leaves the image alone, 200 % doubles the side.
//
// Below `monoBelowHz` the side is removed with a 24 dB/octave highpass, so
// kick and bass energy stays in the centre whatever the width — the mastering
// move that keeps a mix solid on a phone speaker, a club system and a vinyl
// cutter alike.
//
// Haas widening adds a delayed, band-limited (180 Hz - 15 kHz) copy of the mid
// to the SIDE, not to one channel: the left channel gets +d and the right -d.
// Each channel then carries a complementary comb, which the ear hears as
// width, while the mono fold-down (L + R) / 2 cancels d exactly. A mono-safe
// widener: a track widened here never comb-filters on a mono speaker.
// fx-lab widens with delays in the same 8-30 ms range and the same band.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { WET_ONLY } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createButterworth4, createEffectShell, highCutFrequency, lowCutFrequency, writeParam, } from '@/lib/studio-fx/effect-shell'

const HAAS_LOW_HZ = 180
const HAAS_HIGH_HZ = 15000
/** The Haas copy at 100 %: -6 dB of the mid, a +3.5 / -6 dB comb per side. */
export const HAAS_MAX_GAIN = 0.5
const MAX_HAAS_SECONDS = 0.05
const TIME_GLIDE_SECONDS = 0.05

function gainOf(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain()
  node.gain.value = value
  return node
}

/** A mono track arrives as L = R here, not as L = signal and R = silence. */
function createStereoUpmix(ctx: BaseAudioContext): GainNode {
  const upmix = ctx.createGain()
  upmix.channelCount = 2
  upmix.channelCountMode = 'explicit'
  upmix.channelInterpretation = 'speakers'
  return upmix
}

interface HaasPath {
  readonly delay: DelayNode
  readonly level: GainNode
  readonly nodes: readonly AudioNode[]
}

function createHaasPath(
  ctx: BaseAudioContext,
  mid: AudioNode,
  side: AudioNode,
): HaasPath {
  const highpass = createButterworth(ctx, 'highpass')
  highpass.frequency.value = HAAS_LOW_HZ
  const lowpass = createButterworth(ctx, 'lowpass')
  lowpass.frequency.value = highCutFrequency(HAAS_HIGH_HZ, ctx.sampleRate)
  const delay = ctx.createDelay(MAX_HAAS_SECONDS)
  const level = gainOf(ctx, 0)
  connectSeries([mid, highpass, lowpass, delay, level, side])
  return { delay, level, nodes: [highpass, lowpass, delay, level] }
}

export function createStereoUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'stereo'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const upmix = createStereoUpmix(ctx)
  const splitter = ctx.createChannelSplitter(2)
  const mid = gainOf(ctx, 0.5)
  const side = gainOf(ctx, 0.5)
  const negateRight = gainOf(ctx, -1)
  const width = ctx.createGain()
  const sideBus = ctx.createGain()
  const monoLow = createButterworth4(ctx, 'highpass')
  const negateSide = gainOf(ctx, -1)
  const left = ctx.createGain()
  const right = ctx.createGain()
  const merger = ctx.createChannelMerger(2)

  connectSeries([shell.input, upmix, splitter])
  splitter.connect(mid, 0)
  splitter.connect(mid, 1)
  splitter.connect(side, 0)
  splitter.connect(negateRight, 1)
  negateRight.connect(side)
  connectSeries([side, width, sideBus, ...monoLow])
  const haas = createHaasPath(ctx, mid, sideBus)
  mid.connect(left)
  mid.connect(right)
  monoLow[1].connect(left)
  connectSeries([monoLow[1], negateSide, right])
  left.connect(merger, 0, 0)
  right.connect(merger, 0, 1)
  merger.connect(shell.wet)
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'stereo'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    write(width.gain, p.widthPct / 100)
    for (const stage of monoLow) {
      write(stage.frequency, lowCutFrequency(p.monoBelowHz))
    }
    writeParam(
      haas.delay.delayTime,
      p.haasMs / 1000,
      ctx,
      glide,
      TIME_GLIDE_SECONDS,
    )
    write(haas.level.gain, (p.haasAmount / 100) * HAAS_MAX_GAIN)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'stereo',
    env,
    shell,
    nodes: [
      upmix,
      splitter,
      mid,
      side,
      negateRight,
      width,
      sideBus,
      ...monoLow,
      negateSide,
      left,
      right,
      merger,
      ...haas.nodes,
    ],
    apply: (params, glide) => apply(params as EffectParams<'stereo'>, glide),
  })
}
