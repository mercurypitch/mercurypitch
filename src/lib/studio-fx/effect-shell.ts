// ============================================================
// Effect shell — bypass, dry/wet balance and latency twins for inserts
// ============================================================
//
// Every Studio effect is `input -> (processed path | unprocessed path) ->
// output`. Bypass and mix are the two gains at the end of those paths, moved
// with setTargetAtTime so toggling an effect never steps the waveform.
//
// The unprocessed path is a LATENCY TWIN of the processed one. Browsers give
// DynamicsCompressorNode a lookahead delay and an oversampled WaveShaperNode
// a resampling delay, and neither is reported. Summing a delayed path with an
// undelayed one comb-filters — parallel compression turns phasey and a split
// de-esser notches its own crossover. So any path that runs beside a
// compressor runs through its twin (`compressor-twin.ts`: the measured
// lookahead as a DelayNode, a null compressor until it is measured), and any
// path beside an oversampled shaper runs through an identical shaper with a
// straight-line curve: whatever the browser's delay is, both paths get it.

import type { MixGains, ShaperCurve } from './dsp'
import { BUTTERWORTH_Q_DB, BUTTERWORTH4_Q_DB, createIdentityCurve, DRY_ONLY, IDENTITY_DOMAIN, } from './dsp'
import type { EffectKind } from './effect-definitions'

/** What the chain lends each effect. */
export interface EffectEnv {
  /** True while audio flows in real time: writes glide instead of stepping. */
  readonly isLive: () => boolean
  /** Deferred work, such as a reverb impulse swap; returns a cancel. */
  readonly schedule: (callback: () => void, delayMs: number) => () => void
}

export interface EffectUnit {
  readonly kind: EffectKind
  readonly input: AudioNode
  readonly output: AudioNode
  setEnabled(enabled: boolean): void
  setParams(params: Readonly<Record<string, number>>): void
  /** Current gain reduction in dB (negative), 0 for effects without dynamics. */
  readReductionDb(): number
  /** Settle fresh compressors from `at` (settleRelease); absent without any. */
  settle?(at: number): void
  /**
   * Run beside the effect before it rather than after it (dynamic EQ,
   * chain.ts): take the detected signal from `source`, the input of the
   * first effect in the run, and pass this effect's own input through with
   * no delay. Null leads a run of its own. The chain calls it on every patch,
   * after it has cut every unit's output, so a tap from `source` is wired
   * afresh each time.
   */
  follow?(source: AudioNode | null): void
  dispose(): void
}

export const PARAM_GLIDE_SECONDS = 0.02
export const BYPASS_GLIDE_SECONDS = 0.012

/** Hold the instantaneous value before replacing automation on a live param. */
function holdAt(param: AudioParam, at: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(at)
    return
  }
  const held = param.value
  param.cancelScheduledValues(at)
  param.setValueAtTime(held, at)
}

/**
 * Glide `param` to `value` while audio is live; otherwise (construction, an
 * offline render being prepared, a suspended context) set it outright so a
 * render never opens with a ramp from the previous setting.
 */
export function writeParam(
  param: AudioParam,
  value: number,
  ctx: BaseAudioContext,
  glide: boolean,
  timeConstant: number = PARAM_GLIDE_SECONDS,
): void {
  const now = ctx.currentTime
  if (!glide) {
    param.cancelScheduledValues(now)
    param.setValueAtTime(value, now)
    return
  }
  holdAt(param, now)
  param.setTargetAtTime(value, now, timeConstant)
}

export function isOfflineContext(ctx: BaseAudioContext): boolean {
  return (
    typeof (ctx as Partial<OfflineAudioContext>).startRendering === 'function'
  )
}

/** Only a running real-time context has audio that a step could click. */
export function isRealtimeRunning(ctx: BaseAudioContext): boolean {
  return ctx.state === 'running' && !isOfflineContext(ctx)
}

export function connectSeries(nodes: readonly AudioNode[]): void {
  for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i])
}

export function disconnectAll(nodes: readonly AudioNode[]): void {
  for (const node of nodes) node.disconnect()
}

export interface EffectShell {
  readonly input: GainNode
  readonly output: GainNode
  /** End of the latency-matched unprocessed path. */
  readonly dry: GainNode
  /** End of the processed path. */
  readonly wet: GainNode
  readonly nodes: readonly AudioNode[]
  setEnabled(enabled: boolean, glide: boolean): void
  setBalance(balance: MixGains, glide: boolean): void
}

export function createEffectShell(
  ctx: BaseAudioContext,
  enabled: boolean,
  balance: MixGains,
): EffectShell {
  const input = ctx.createGain()
  const output = ctx.createGain()
  const dry = ctx.createGain()
  const wet = ctx.createGain()
  dry.connect(output)
  wet.connect(output)
  let isEnabled = enabled
  let current = balance

  const apply = (glide: boolean): void => {
    const target = isEnabled ? current : DRY_ONLY
    writeParam(dry.gain, target.dry, ctx, glide, BYPASS_GLIDE_SECONDS)
    writeParam(wet.gain, target.wet, ctx, glide, BYPASS_GLIDE_SECONDS)
  }
  apply(false)

  return {
    input,
    output,
    dry,
    wet,
    nodes: [input, output, dry, wet],
    setEnabled(next, glide) {
      if (next === isEnabled) return
      isEnabled = next
      apply(glide)
    },
    setBalance(next, glide) {
      if (next.dry === current.dry && next.wet === current.wet) return
      current = next
      apply(glide)
    },
  }
}

export interface UnitParts {
  readonly kind: EffectKind
  readonly env: EffectEnv
  readonly shell: EffectShell
  /** Every node the effect created besides the shell's own four. */
  readonly nodes: readonly AudioNode[]
  readonly apply: (
    params: Readonly<Record<string, number>>,
    glide: boolean,
  ) => void
  readonly readReductionDb?: () => number
  readonly settle?: (at: number) => void
  readonly follow?: (source: AudioNode | null) => void
  readonly onDispose?: () => void
}

/** Wrap an effect's graph in the unit interface the chain drives. */
export function assembleUnit(parts: UnitParts): EffectUnit {
  const { env, shell } = parts
  let disposed = false
  return {
    kind: parts.kind,
    input: shell.input,
    output: shell.output,
    setEnabled(enabled) {
      if (!disposed) shell.setEnabled(enabled, env.isLive())
    },
    setParams(params) {
      if (!disposed) parts.apply(params, env.isLive())
    },
    readReductionDb: () => (disposed ? 0 : (parts.readReductionDb?.() ?? 0)),
    follow:
      parts.follow &&
      ((source) => {
        if (!disposed) parts.follow?.(source)
      }),
    settle:
      parts.settle &&
      ((at) => {
        if (!disposed) parts.settle?.(at)
      }),
    dispose() {
      if (disposed) return
      disposed = true
      parts.onDispose?.()
      disconnectAll([...shell.nodes, ...parts.nodes])
    },
  }
}

/** A DynamicsCompressorNode that never compresses: same lookahead, unity gain. */
export function createNullCompressor(
  ctx: BaseAudioContext,
): DynamicsCompressorNode {
  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = 0
  compressor.knee.value = 0
  compressor.ratio.value = 1
  compressor.attack.value = 0.003
  compressor.release.value = 0.25
  return compressor
}

/**
 * A new DynamicsCompressorNode starts about 10 dB down and takes some
 * 240 ms of rendering, silence included, to come up to unity: its detector
 * starts at zero and climbs at the release rate. With release at 1 ms for
 * its first 40 ms, 60 ms of silence leave it within 0.02 dB in Chromium,
 * and every role chain within 0.04 dB of one settled for 2 s (against 1.9 dB
 * under with no settle). Live graphs settle their compressors this way, so
 * Play need not wait a quarter second first.
 */
export const FAST_SETTLE_SECONDS = 0.04
const FAST_RELEASE_SECONDS = 0.001

/** Run `param` (a compressor's release) at 1 ms from `at`, then back at `release`. */
export function settleRelease(
  param: AudioParam,
  at: number,
  release: number,
): void {
  param.cancelScheduledValues(at)
  param.setValueAtTime(FAST_RELEASE_SECONDS, at)
  param.setValueAtTime(release, at + FAST_SETTLE_SECONDS)
}

export interface ShaperPath {
  readonly input: GainNode
  readonly output: GainNode
  readonly shaper: WaveShaperNode
  readonly nodes: readonly AudioNode[]
}

/** Pre-gain, shaper, post-gain — the scaled-domain wrapper. */
export function createShaperPath(
  ctx: BaseAudioContext,
  curve: ShaperCurve,
  oversample: OverSampleType = '4x',
): ShaperPath {
  const input = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  const output = ctx.createGain()
  shaper.curve = curve
  shaper.oversample = oversample
  input.connect(shaper)
  shaper.connect(output)
  return { input, output, shaper, nodes: [input, shaper, output] }
}

/** The latency twin of any 4x shaper: the same resampling, a straight line. */
export function createIdentityShaperPath(ctx: BaseAudioContext): ShaperPath {
  const path = createShaperPath(ctx, createIdentityCurve())
  path.input.gain.value = 1 / IDENTITY_DOMAIN
  path.output.gain.value = IDENTITY_DOMAIN
  return path
}

/** At or below this a low cut is off; a 0 Hz highpass is a straight wire. */
export const LOW_CUT_OFF_HZ = 20

/** At or above this a high cut is off; a Nyquist lowpass is a straight wire. */
export const HIGH_CUT_OFF_HZ = 20000

/**
 * A 20 Hz highpass still takes 0.26 dB off 40 Hz, so "Low cut 20 Hz" would
 * not be flat. At the end of its range a cut is switched out instead: Web
 * Audio defines a 0 Hz highpass and a Nyquist lowpass as pass-through.
 */
export function lowCutFrequency(hz: number): number {
  return hz <= LOW_CUT_OFF_HZ ? 0 : hz
}

export function highCutFrequency(hz: number, sampleRate: number): number {
  const nyquist = sampleRate / 2
  return hz >= HIGH_CUT_OFF_HZ ? nyquist : Math.min(hz, nyquist)
}

function createPassFilter(
  ctx: BaseAudioContext,
  type: 'lowpass' | 'highpass',
  qDb: number,
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = qDb
  return filter
}

/** A 12 dB/octave Butterworth lowpass or highpass (see `BUTTERWORTH_Q_DB`). */
export function createButterworth(
  ctx: BaseAudioContext,
  type: 'lowpass' | 'highpass',
): BiquadFilterNode {
  return createPassFilter(ctx, type, BUTTERWORTH_Q_DB)
}

/** A 24 dB/octave Butterworth: two biquads to run in series. */
export function createButterworth4(
  ctx: BaseAudioContext,
  type: 'lowpass' | 'highpass',
): readonly [BiquadFilterNode, BiquadFilterNode] {
  return [
    createPassFilter(ctx, type, BUTTERWORTH4_Q_DB[0]),
    createPassFilter(ctx, type, BUTTERWORTH4_Q_DB[1]),
  ]
}
