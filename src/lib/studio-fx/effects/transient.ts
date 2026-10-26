// ============================================================
// Studio transient shaper — more or less hit, more or less ring
// ============================================================
//
// The drum-bus tool every mix engineer reaches for: it reshapes each hit
// whatever its level, which a compressor cannot. Two followers track the
// key's level, a fast one (two 100 Hz pole pairs) and a slow one (10 Hz),
// both in decibels. At a hit the fast one runs ahead; as the hit rings out
// it falls behind. That lead drives the gain of the audio path:
//
//   gain = 1 + attack * lead(0 .. 9 dB) + sustain * trail(0 .. 3 dB)
//
// each term a smoothstep. +100 % attack lifts the front of a hit (its first
// 15 ms fully, fading out by 40 ms) by 6 dB; sustain lifts or trims the ring
// from about 40 ms on. Because the followers are compared in decibels, a
// ghost note and a rimshot get the same shape — no threshold to set.
//
// A plain rectifier would ripple at twice a note's pitch, too slow for the
// fast follower to smooth on a held 41 Hz bass note, and in decibels that
// ripple wobbles the gain whatever the level. So the key is split into two
// copies 90 degrees apart (an allpass Hilbert pair) and rectified at four
// phases, 45 degrees apart: their sum is the signal's level with 3 % ripple
// at eight times the pitch, which the followers remove. Measured on a held
// 41 Hz note, the gain stays within 0.001 dB.
//
// The detector runs in mono (a linked stereo detector); a 3 ms lookahead on
// the audio path, matched on the bypass path, lets the lift land on the very
// first cycle of the hit.

import type { EffectSpecOf } from '@/lib/studio-fx/chain-spec'
import type { ShaperCurve } from '@/lib/studio-fx/dsp'
import { createLeadCurve, createLogEnvelopeCurve, createRectifierCurve, dbToGain, ENVELOPE_DOMAIN, QUADRATURE_ALLPASS, WET_ONLY, } from '@/lib/studio-fx/dsp'
import type { EffectParams } from '@/lib/studio-fx/effect-definitions'
import type { EffectEnv, EffectUnit } from '@/lib/studio-fx/effect-shell'
import { assembleUnit, connectSeries, createButterworth, createEffectShell, writeParam, } from '@/lib/studio-fx/effect-shell'

const KEY_HIGHPASS_HZ = 40
const FAST_HZ = 100
const SLOW_HZ = 10
const LOOKAHEAD_SECONDS = 0.003
/** How far +/-100 % moves the hit or the ring. */
const RANGE_DB = 6
/** The lead at which a hit gets the whole attack setting. */
const FULL_ATTACK_DB = 9
/** The trail at which a ring gets the whole sustain setting. */
const FULL_SUSTAIN_DB = 3

interface Curves {
  readonly rectifier: ShaperCurve
  readonly logEnvelope: ShaperCurve
  readonly attack: ShaperCurve
  readonly sustain: ShaperCurve
}

let curves: Curves | null = null

function transientCurves(): Curves {
  curves ??= {
    rectifier: createRectifierCurve(),
    logEnvelope: createLogEnvelopeCurve(),
    attack: createLeadCurve(FULL_ATTACK_DB),
    sustain: createLeadCurve(FULL_SUSTAIN_DB),
  }
  return curves
}

function shaper(ctx: BaseAudioContext, curve: ShaperCurve): WaveShaperNode {
  const node = ctx.createWaveShaper()
  node.curve = curve
  return node
}

function butterworth(
  ctx: BaseAudioContext,
  type: 'lowpass' | 'highpass',
  hz: number,
): BiquadFilterNode {
  const filter = createButterworth(ctx, type)
  filter.frequency.value = hz
  return filter
}

function gainOf(ctx: BaseAudioContext, value: number): GainNode {
  const node = ctx.createGain()
  node.gain.value = value
  return node
}

function lookahead(ctx: BaseAudioContext): DelayNode {
  const delay = ctx.createDelay(0.01)
  delay.delayTime.value = LOOKAHEAD_SECONDS
  return delay
}

/** -100..100 % as the gain offset at full effect: about -0.5 to +1.0. */
export function transientDepth(percent: number): number {
  return dbToGain((RANGE_DB * percent) / 100) - 1
}

function allpassChain(
  ctx: BaseAudioContext,
  coefficients: readonly number[],
  oneSampleLater: boolean,
): IIRFilterNode[] {
  return coefficients.map((a, index) => {
    const a2 = a * a
    const feedforward =
      oneSampleLater && index === 0 ? [0, a2, 0, -1] : [a2, 0, -1]
    return ctx.createIIRFilter(feedforward, [1, 0, -a2])
  })
}

interface Part {
  readonly output: AudioNode
  readonly nodes: readonly AudioNode[]
}

/** key -> 90-degree pair -> four rectified phases -> a ripple-free level. */
function createQuadratureLevel(ctx: BaseAudioContext, source: AudioNode): Part {
  const key = gainOf(ctx, 1 / ENVELOPE_DOMAIN)
  key.channelCount = 1
  key.channelCountMode = 'explicit'
  const keyFilter = butterworth(ctx, 'highpass', KEY_HIGHPASS_HZ)
  const chainA = allpassChain(ctx, QUADRATURE_ALLPASS[0], true)
  const chainB = allpassChain(ctx, QUADRATURE_ALLPASS[1], false)
  connectSeries([source, key, keyFilter, ...chainA])
  connectSeries([keyFilter, ...chainB])
  const inPhase = chainA[chainA.length - 1]
  const quadrature = chainB[chainB.length - 1]
  const negated = gainOf(ctx, -1)
  const at45 = gainOf(ctx, Math.SQRT1_2)
  const at135 = gainOf(ctx, Math.SQRT1_2)
  quadrature.connect(negated)
  inPhase.connect(at45)
  quadrature.connect(at45)
  inPhase.connect(at135)
  negated.connect(at135)
  // Four rectified phases average 8/pi of the level.
  const level = gainOf(ctx, Math.PI / 8)
  const rectifiers = [inPhase, quadrature, at45, at135].map((phase) => {
    const rectifier = shaper(ctx, transientCurves().rectifier)
    connectSeries([phase, rectifier, level])
    return rectifier
  })
  return {
    output: level,
    nodes: [
      key,
      keyFilter,
      ...chainA,
      ...chainB,
      negated,
      at45,
      at135,
      ...rectifiers,
      level,
    ],
  }
}

interface Detector {
  readonly attackDepth: GainNode
  readonly sustainDepth: GainNode
  readonly nodes: readonly AudioNode[]
}

/** level -> fast and slow followers in dB -> lead -> hit and ring amounts. */
function createDetector(ctx: BaseAudioContext, source: AudioNode): Detector {
  const level = createQuadratureLevel(ctx, source)
  const c = transientCurves()
  const fastA = butterworth(ctx, 'lowpass', FAST_HZ)
  const fastB = butterworth(ctx, 'lowpass', FAST_HZ)
  const slow = butterworth(ctx, 'lowpass', SLOW_HZ)
  const logFast = shaper(ctx, c.logEnvelope)
  const logSlow = shaper(ctx, c.logEnvelope)
  const negateSlow = gainOf(ctx, -1)
  const lead = ctx.createGain()
  const hit = shaper(ctx, c.attack)
  const negateLead = gainOf(ctx, -1)
  const ring = shaper(ctx, c.sustain)
  const attackDepth = gainOf(ctx, 0)
  const sustainDepth = gainOf(ctx, 0)
  connectSeries([level.output, fastA, fastB, logFast, lead])
  connectSeries([level.output, slow, logSlow, negateSlow, lead])
  connectSeries([lead, hit, attackDepth])
  connectSeries([lead, negateLead, ring, sustainDepth])
  return {
    attackDepth,
    sustainDepth,
    nodes: [
      ...level.nodes,
      fastA,
      fastB,
      slow,
      logFast,
      logSlow,
      negateSlow,
      lead,
      hit,
      negateLead,
      ring,
      attackDepth,
      sustainDepth,
    ],
  }
}

export function createTransientUnit(
  ctx: BaseAudioContext,
  spec: EffectSpecOf<'transient'>,
  env: EffectEnv,
): EffectUnit {
  const shell = createEffectShell(ctx, spec.enabled, WET_ONLY)
  const wetLookahead = lookahead(ctx)
  const dryLookahead = lookahead(ctx)
  const vca = ctx.createGain()
  connectSeries([shell.input, wetLookahead, vca, shell.wet])
  connectSeries([shell.input, dryLookahead, shell.dry])

  const detector = createDetector(ctx, shell.input)
  detector.attackDepth.connect(vca.gain)
  detector.sustainDepth.connect(vca.gain)

  const apply = (p: EffectParams<'transient'>, glide: boolean): void => {
    const write = (param: AudioParam, value: number): void =>
      writeParam(param, value, ctx, glide)
    write(detector.attackDepth.gain, transientDepth(p.attack))
    write(detector.sustainDepth.gain, transientDepth(p.sustain))
  }
  apply(spec.params, false)

  return assembleUnit({
    kind: 'transient',
    env,
    shell,
    nodes: [wetLookahead, dryLookahead, vca, ...detector.nodes],
    apply: (params, glide) => apply(params as EffectParams<'transient'>, glide),
  })
}
