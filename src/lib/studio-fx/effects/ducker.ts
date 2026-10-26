// ============================================================
// Ducker — dip a return while the dry signal is sounding
// ============================================================
//
// fx-lab keys its vocal reverb from the dry voice ("vocal-keyed bloom"): the
// return sits back while a word is sung and blooms in the gaps, so the space
// never washes the words out. Web Audio has no sidechain input, but an
// AudioParam can be driven by audio, so the key is turned into a control
// signal and added to the return's gain:
//
//   key -> |x| -> 2 Hz lowpass -> smoothstep(-40 .. -27 dBFS) -> x -depth
//       -> returnGain.gain   (intrinsic value 1)
//
// The thresholds are fixed because the chain is normalised first: a track
// that has been level-matched to the reference loudness puts a sung word well
// past -27 dBFS of average level and a gap between phrases well under
// -40 dBFS, while the dips between syllables stay above it. The gain can
// only fall to 1 - depth, never below zero.

import type { ShaperCurve } from '@/lib/studio-fx/dsp'
import { createDuckCurve, createRectifierCurve, dbToGain, ENVELOPE_DOMAIN, } from '@/lib/studio-fx/dsp'
import { connectSeries, createButterworth, writeParam, } from '@/lib/studio-fx/effect-shell'

/**
 * One Butterworth pole pair at 2 Hz: slow enough to hold through the gap
 * between two syllables, quick enough to let the return bloom within about
 * 100 ms of the end of a phrase.
 */
const SMOOTHING_HZ = 2

/** The deepest a duck goes at 100 %. */
export const MAX_DUCK_DB = 12

let curves: { rectifier: ShaperCurve; duck: ShaperCurve } | null = null

function duckerCurves(): { rectifier: ShaperCurve; duck: ShaperCurve } {
  curves ??= { rectifier: createRectifierCurve(), duck: createDuckCurve() }
  return curves
}

export interface Ducker {
  /** Feed the key (the dry signal) here. */
  readonly key: AudioNode
  /** Route the return through this node. */
  readonly ducked: GainNode
  readonly nodes: readonly AudioNode[]
  /** 0..1 of `MAX_DUCK_DB`. */
  setDepth(amount: number, glide: boolean): void
}

export function createDucker(ctx: BaseAudioContext): Ducker {
  const key = ctx.createGain()
  key.gain.value = 1 / ENVELOPE_DOMAIN
  const rectifier = ctx.createWaveShaper()
  rectifier.curve = duckerCurves().rectifier
  const smoothing = createButterworth(ctx, 'lowpass')
  smoothing.frequency.value = SMOOTHING_HZ
  const amount = ctx.createWaveShaper()
  amount.curve = duckerCurves().duck
  const depth = ctx.createGain()
  depth.gain.value = 0
  const ducked = ctx.createGain()
  connectSeries([key, rectifier, smoothing, amount, depth])
  depth.connect(ducked.gain)

  return {
    key,
    ducked,
    nodes: [key, rectifier, smoothing, amount, depth, ducked],
    setDepth(value, glide) {
      const floor = dbToGain(-MAX_DUCK_DB * Math.min(1, Math.max(0, value)))
      writeParam(depth.gain, -(1 - floor), ctx, glide)
    },
  }
}
