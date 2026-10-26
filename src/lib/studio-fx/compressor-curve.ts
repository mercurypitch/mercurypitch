// ============================================================
// Compressor curve — the hidden makeup gain of DynamicsCompressorNode
// ============================================================
//
// Every shipping DynamicsCompressorNode boosts its output by an automatic
// makeup gain: (1 / curve(0 dBFS)) ^ 0.6, where curve is the static
// compression curve (Web Audio spec, "computing the makeup gain"). With a
// -24 dB threshold at 4:1 that is +10.8 dB — a compressor that makes
// everything below its threshold louder, and a de-esser band that comes back
// hotter than the band it was split from.
//
// The Studio divides that gain back out so a compressor sits at unity below
// threshold and makeup is an explicit control. Below the knee the curve is
// fixed by the spec; the knee's shape is left to the browser, and Blink,
// Gecko and WebKit all run WebKit's DynamicsCompressorKernel, whose
// exponential knee is reproduced here step for step (including its 15-step
// geometric search for the knee constant).

import { dbToGain, gainToDb } from './dsp'

type StaticCurve = (x: number) => number

function createKneeCurve(linearThreshold: number) {
  return (x: number, k: number): number =>
    x < linearThreshold
      ? x
      : linearThreshold + (1 - Math.exp(-k * (x - linearThreshold))) / k
}

/** WebKit's knee constant: the k whose knee ends at a slope of 1 / ratio. */
function kneeConstant(
  thresholdDb: number,
  kneeDb: number,
  desiredSlope: number,
): number {
  const linearThreshold = dbToGain(thresholdDb)
  const kneeCurve = createKneeCurve(linearThreshold)
  const x = dbToGain(thresholdDb + kneeDb)
  const slopeAt = (k: number): number => {
    if (x < linearThreshold) return 1
    const x2 = x * 1.001
    const rise = gainToDb(kneeCurve(x2, k)) - gainToDb(kneeCurve(x, k))
    return rise / (gainToDb(x2) - gainToDb(x))
  }
  let minK = 0.1
  let maxK = 10000
  let k = 5
  for (let i = 0; i < 15; i++) {
    if (slopeAt(k) < desiredSlope) maxK = k
    else minK = k
    k = Math.sqrt(minK * maxK)
  }
  return k
}

function createStaticCurve(
  thresholdDb: number,
  kneeDb: number,
  ratio: number,
): StaticCurve {
  const slope = 1 / ratio
  const kneeCurve = createKneeCurve(dbToGain(thresholdDb))
  const k = kneeConstant(thresholdDb, kneeDb, slope)
  const kneeEndDb = thresholdDb + kneeDb
  const kneeEnd = dbToGain(kneeEndDb)
  const kneeEndOutDb = gainToDb(kneeCurve(kneeEnd, k))
  return (x) =>
    x < kneeEnd
      ? kneeCurve(x, k)
      : dbToGain(kneeEndOutDb + slope * (gainToDb(x) - kneeEndDb))
}

/** The browser's clamps, applied before the curve is evaluated. */
function clampCompressorSettings(
  thresholdDb: number,
  kneeDb: number,
  ratio: number,
): [number, number, number] {
  return [
    Math.min(0, Math.max(-100, thresholdDb)),
    Math.min(40, Math.max(0, kneeDb)),
    Math.min(20, Math.max(1, ratio)),
  ]
}

/** The linear makeup gain a DynamicsCompressorNode applies on its own. */
export function compressorAutoMakeupGain(
  thresholdDb: number,
  kneeDb: number,
  ratio: number,
): number {
  const [threshold, knee, clampedRatio] = clampCompressorSettings(
    thresholdDb,
    kneeDb,
    ratio,
  )
  if (clampedRatio === 1) return 1
  const fullRangeGain = createStaticCurve(threshold, knee, clampedRatio)(1)
  return Math.pow(1 / fullRangeGain, 0.6)
}

/** Static output level, in dBFS, for a steady input level (before makeup). */
export function compressorStaticOutputDb(
  inputDb: number,
  thresholdDb: number,
  kneeDb: number,
  ratio: number,
): number {
  const [threshold, knee, clampedRatio] = clampCompressorSettings(
    thresholdDb,
    kneeDb,
    ratio,
  )
  return gainToDb(
    createStaticCurve(threshold, knee, clampedRatio)(dbToGain(inputDb)),
  )
}
