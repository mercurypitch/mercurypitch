// ============================================================
// Studio delay — filtered feedback echo, from centred to ping-pong
// ============================================================
//
// Two delay lines, one per side, each with a low cut and a high cut inside
// its feedback loop so the repeats thin out and darken as they fade. The
// input is summed to mono and feeds the left line; `pingPong` decides how
// much it also feeds the right line directly, and how the feedback is split
// between each line's own loop and the opposite line:
//
//   pingPong 0   — both lines hear the input and repeat themselves: centred
//                  echoes.
//   pingPong 100 — only the left line hears the input and every repeat
//                  crosses over: echoes bounce left, right, left.
//
// Feedback tops out at 95 % and the loop filters only remove energy, so the
// loop cannot run away. Every cycle passes through a DelayNode of at least
// 10 ms, more than the one render quantum Web Audio needs to close a cycle.
//
// `duck` keys the echoes from the dry signal, as the reverb does: they sit
// back under a sung line and come forward in the gaps between phrases — the
// standard way a vocal delay stays audible without blurring the words.
//
// KNOWN LIMIT: Chrome adds one render quantum (128 frames, 2.7 ms at 48 kHz)
// each time a repeat goes round a feedback cycle — measured on Chrome 153, not
// specified. The first echo is exact; the n-th lands (n-1) quanta late. Which
// node of a two-delay cycle absorbs the quantum is the browser's choice, so
// it cannot be compensated in the graph. Sample-exact repeats need the loop
// inside an AudioWorklet.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import { equalPowerMix } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, highCutFrequency, lowCutFrequency, writeParam, } from '@/lib/studio-fx/effect-shell'
import { createDucker } from './ducker'

const MAX_DELAY_SECONDS = 2.5
const TIME_GLIDE_SECONDS = 0.05

interface DelayLine {
  readonly delay: DelayNode
  readonly lowCut: BiquadFilterNode
  readonly highCut: BiquadFilterNode
  readonly out: GainNode
  readonly self: GainNode
  readonly cross: GainNode
}

function createDelayLine(ctx: BaseAudioContext): DelayLine {
  const line: DelayLine = {
    delay: ctx.createDelay(MAX_DELAY_SECONDS),
    lowCut: createButterworth(ctx, 'highpass'),
    highCut: createButterworth(ctx, 'lowpass'),
    out: ctx.createGain(),
    self: ctx.createGain(),
    cross: ctx.createGain(),
  }
  connectSeries([line.delay, line.lowCut, line.highCut, line.out])
  connectSeries([line.out, line.self, line.delay])
  line.out.connect(line.cross)
  return line
}

function lineNodes(line: DelayLine): AudioNode[] {
  return [
    line.delay,
    line.lowCut,
    line.highCut,
    line.out,
    line.self,
    line.cross,
  ]
}

/** Stereo or mono in, mono out: the speakers down-mix, (L + R) / 2. */
function createMonoSum(ctx: BaseAudioContext): GainNode {
  const mono = ctx.createGain()
  mono.channelCount = 1
  mono.channelCountMode = 'explicit'
  mono.channelInterpretation = 'speakers'
  return mono
}

export function createDelayUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'delay'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(
    ctx,
    spec.enabled,
    equalPowerMix(spec.params.mix / 100),
  )
  const mono = createMonoSum(ctx)
  const feedRight = ctx.createGain()
  const left = createDelayLine(ctx)
  const right = createDelayLine(ctx)
  const merger = ctx.createChannelMerger(2)
  const ducker = createDucker(ctx)
  shell.input.connect(mono)
  mono.connect(left.delay)
  connectSeries([mono, feedRight, right.delay])
  left.cross.connect(right.delay)
  right.cross.connect(left.delay)
  left.out.connect(merger, 0, 0)
  right.out.connect(merger, 0, 1)
  connectSeries([merger, ducker.ducked, shell.wet])
  shell.input.connect(ducker.key)
  shell.input.connect(shell.dry)

  const apply = (p: EffectParams<'delay'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    const spread = p.pingPong / 100
    const feedback = p.feedback / 100
    for (const line of [left, right]) {
      writeParam(
        line.delay.delayTime,
        p.timeMs / 1000,
        ctx,
        glide,
        TIME_GLIDE_SECONDS,
      )
      write(line.lowCut.frequency, lowCutFrequency(p.lowCutHz))
      write(
        line.highCut.frequency,
        highCutFrequency(p.highCutHz, ctx.sampleRate),
      )
      write(line.self.gain, feedback * (1 - spread))
      write(line.cross.gain, feedback * spread)
    }
    write(feedRight.gain, 1 - spread)
    ducker.setDepth(p.duck / 100, glide)
    shell.setBalance(equalPowerMix(p.mix / 100), glide)
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'delay',
    env,
    shell,
    nodes: [
      mono,
      feedRight,
      merger,
      ...ducker.nodes,
      ...lineNodes(left),
      ...lineNodes(right),
    ],
    apply: (params, glide) => apply(params as EffectParams<'delay'>, glide),
  })
}
