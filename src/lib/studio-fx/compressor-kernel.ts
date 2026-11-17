// ============================================================
// Compressor kernel — the browsers' compressor, sample for sample, with no lookahead
// ============================================================
//
// A DynamicsCompressorNode plays everything 6 ms late (its pre-delay, 288
// frames at 48 kHz), and no setting takes that away, so a monitored input
// cannot run through one (fx-profile.ts MONITOR_FX_PROFILE). This is the
// node's own processing without the pre-delay, ported from Chromium's
// DynamicsCompressor::Process (third_party/blink/renderer/platform/audio/
// dynamics_compressor.cc), which is WebKit's DynamicsCompressorKernel, the
// one Gecko and WebKit run too. Each frame gets the gain the browser
// computes for it, applied to that frame instead of the frame 6 ms before
// it: a steady level comes out as playback's compressor plays it, and a
// change is caught up to 6 ms later than playback catches it.
//
// Kept step for step: the static curve (compressor-curve.ts); a peak
// detector that drops at once and recovers at 2 dB or more per 2.5 ms; a
// gain that heads for the detector's level from each 32-frame division,
// attacking faster the further it has to go and releasing at a rate set by
// four release zones; and the sine warp that rounds the gain's corners.
// The math runs in doubles where the browser runs floats, a difference
// near -100 dB.
//
// Left out: the automatic makeup gain, (1 / curve(0 dBFS)) ^ 0.6, which
// the Studio divides back out of every compressor anyway (compressor-curve.ts
// `compressorAutoMakeupGain`), and the reduction meter. A kernel starts
// settled, as a node that has heard silence for a while, so a new monitor
// needs no settling first (effect-shell.ts `settleRelease`).
import type { StaticCurve } from './compressor-curve'
import { createCompressorCurve } from './compressor-curve'

/** What the kernel compresses with, as a DynamicsCompressorNode's parameters read them for one render quantum. */
export interface CompressorKernelSettings {
  thresholdDb: number
  kneeDb: number
  ratio: number
  attackSeconds: number
  releaseSeconds: number
}

/** One of the kernel's parameters as an AudioWorkletNode declares it: a DynamicsCompressorNode's name, default and range. */
export interface CompressorParameter {
  readonly name: 'threshold' | 'knee' | 'ratio' | 'attack' | 'release'
  readonly defaultValue: number
  readonly minValue: number
  readonly maxValue: number
  readonly automationRate: 'k-rate'
}

/** The name the compressor's AudioWorkletProcessor registers under (src/workers/studio-compressor.worklet.ts). */
export const STUDIO_COMPRESSOR_PROCESSOR = 'studio-compressor'

/** What the page posts a compressor's processor when its unit is disposed: process() then says it is done. */
export const STUDIO_COMPRESSOR_DISPOSE = 'dispose'

/** DynamicsCompressorNode's parameters, read once a render quantum as the node reads its own. */
export const COMPRESSOR_PARAMETERS: readonly CompressorParameter[] = [
  {
    name: 'threshold',
    defaultValue: -24,
    minValue: -100,
    maxValue: 0,
    automationRate: 'k-rate',
  },
  {
    name: 'knee',
    defaultValue: 30,
    minValue: 0,
    maxValue: 40,
    automationRate: 'k-rate',
  },
  {
    name: 'ratio',
    defaultValue: 12,
    minValue: 1,
    maxValue: 20,
    automationRate: 'k-rate',
  },
  {
    name: 'attack',
    defaultValue: 0.003,
    minValue: 0,
    maxValue: 1,
    automationRate: 'k-rate',
  },
  {
    name: 'release',
    defaultValue: 0.25,
    minValue: 0,
    maxValue: 1,
    automationRate: 'k-rate',
  },
]

const DIVISION_FRAMES = 32
/** How fast the detector recovers: 2 dB, or the attenuation if larger, per this long. */
const DETECTOR_RELEASE_SECONDS = 0.0025
const DETECTOR_RELEASE_FLOOR_DB = 2
/** At or above this attenuation the detector recovers at its 2 dB floor. */
const DETECTOR_FLOOR_ATTENUATION = 10 ** (-DETECTOR_RELEASE_FLOOR_DB / 20)
/** Input below this is silence to the detector: its attenuation is 1. */
const SILENCE = 0.0001
/** The gain releases this many dB per release-zone time. */
const RELEASE_SPACING_DB = 5
/** The warp's quarter turn. The browser's is pi / 2 as a 32-bit float, in both directions, so a detector at 1 is a gain of exactly 1 there as here. */
const HALF_PI = Math.PI / 2

const ZONE_1 = Math.fround(0.09)
const ZONE_2 = Math.fround(0.16)
const ZONE_3 = Math.fround(0.42)
const ZONE_4 = Math.fround(0.98)

/**
 * The release curve's coefficients for a release of one frame: a quartic
 * through the four zones at a gap to the detector of -12, -8, -4 and 0 dB
 * (Chromium's kABase to kEBase).
 */
const RELEASE_BASE = [
  0.9999999999999998 * ZONE_1 +
    1.8432219684323923e-16 * ZONE_2 -
    1.9373394351676423e-16 * ZONE_3 +
    8.824516011816245e-18 * ZONE_4,
  -1.5788320352845888 * ZONE_1 +
    2.3305837032074286 * ZONE_2 -
    0.9141194204840429 * ZONE_3 +
    0.1623677525612032 * ZONE_4,
  0.5334142869106424 * ZONE_1 -
    1.272736789213631 * ZONE_2 +
    0.9258856042207512 * ZONE_3 -
    0.18656310191776226 * ZONE_4,
  0.08783463138207234 * ZONE_1 -
    0.1694162967925622 * ZONE_2 +
    0.08588057951595272 * ZONE_3 -
    0.00429891410546283 * ZONE_4,
  -0.042416883008123074 * ZONE_1 +
    0.1115693827987602 * ZONE_2 -
    0.09764676325265872 * ZONE_3 +
    0.028494263462021576 * ZONE_4,
] as const

const linearToDb = (linear: number): number => 20 * Math.log10(linear)
const dbToLinear = (db: number): number => 10 ** (db / 20)
const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback

export interface CompressorKernel {
  /**
   * Compress one render quantum: `input` holds its channels (none for
   * silence, one copied to both sides), `output` the two channels to fill,
   * as long as the quantum. The gain is the same on both sides, from the
   * louder of the two.
   */
  process(
    input: readonly Float32Array[],
    output: readonly Float32Array[],
    settings: Readonly<CompressorKernelSettings>,
  ): void
}

export function createCompressorKernel(sampleRate: number): CompressorKernel {
  const detectorReleaseFrames = DETECTOR_RELEASE_SECONDS * sampleRate
  /** The detector's recovery per frame at its 2 dB floor, the rate nearly every frame takes. */
  const floorRecovery =
    dbToLinear(DETECTOR_RELEASE_FLOOR_DB / detectorReleaseFrames) - 1
  let detectorAverage = 1
  let compressorGain = 1
  /** The largest gap to the detector met while attacking; -1 while releasing. */
  let maxAttackDiffDb = -1
  let curve: StaticCurve = (x) => x
  let curveFor: readonly number[] = []
  /** The release curve's coefficients at the release last read, in frames. */
  const release = new Float64Array(RELEASE_BASE.length)
  let releaseFor = Number.NaN

  /** The curve for these settings, built again only when one of them moves. */
  function curveOf(settings: Readonly<CompressorKernelSettings>): StaticCurve {
    const { thresholdDb, kneeDb, ratio } = settings
    if (
      curveFor[0] !== thresholdDb ||
      curveFor[1] !== kneeDb ||
      curveFor[2] !== ratio
    ) {
      curve = createCompressorCurve(thresholdDb, kneeDb, ratio)
      curveFor = [thresholdDb, kneeDb, ratio]
    }
    return curve
  }

  /** The attenuation the static curve asks of a frame whose louder side is `level`. */
  function attenuationAt(shape: StaticCurve, level: number): number {
    return level <= SILENCE ? 1 : shape(level) / level
  }

  /** How far the detector recovers this frame, toward an `attenuation` above it. */
  function detectorRecovery(attenuation: number): number {
    if (attenuation >= DETECTOR_FLOOR_ATTENUATION) return floorRecovery
    return dbToLinear(-linearToDb(attenuation) / detectorReleaseFrames) - 1
  }

  /** The release curve for a release of `seconds`. */
  function releaseCurve(seconds: number): Float64Array {
    if (seconds !== releaseFor) {
      const frames = sampleRate * seconds
      for (const [index, base] of RELEASE_BASE.entries())
        release[index] = frames * base
      releaseFor = seconds
    }
    return release
  }

  /** The gain's rate toward `target` over the next division: a factor above 1 while releasing, a share of the gap while attacking. */
  function envelopeRate(
    target: number,
    attackFrames: number,
    release: Float64Array,
  ): number {
    const releasing = target > compressorGain
    let diffDb =
      target === 0 ? (releasing ? -1 : 1) : linearToDb(compressorGain / target)
    if (releasing) {
      maxAttackDiffDb = -1
      diffDb = finiteOr(diffDb, -1)
      // The further below the detector the gain is, the faster it releases.
      const x = 0.25 * (Math.min(0, Math.max(-12, diffDb)) + 12)
      const x2 = x * x
      const frames =
        release[0] +
        release[1] * x +
        release[2] * x2 +
        release[3] * x2 * x +
        release[4] * x2 * x2
      return dbToLinear(RELEASE_SPACING_DB / frames)
    }
    diffDb = finiteOr(diffDb, 1)
    if (maxAttackDiffDb === -1 || maxAttackDiffDb < diffDb)
      maxAttackDiffDb = diffDb
    const share = 0.25 / Math.max(0.5, maxAttackDiffDb)
    return 1 - share ** (1 / attackFrames)
  }

  /** One frame through the detector and the gain, heading for `target` at `rate`: the gain the frame plays at. */
  function frameGain(
    level: number,
    shape: StaticCurve,
    target: number,
    rate: number,
  ): number {
    const attenuation = attenuationAt(shape, level)
    detectorAverage +=
      (attenuation - detectorAverage) *
      (attenuation > detectorAverage ? detectorRecovery(attenuation) : 1)
    detectorAverage = finiteOr(Math.min(1, detectorAverage), 1)
    if (rate < 1) compressorGain += (target - compressorGain) * rate
    else {
      // As C++'s std::min(1.0f, gain): a gain that is not a number releases to 1.
      const released = compressorGain * rate
      compressorGain = released < 1 ? released : 1
    }
    return compressorGain === 1 ? 1 : Math.sin(HALF_PI * compressorGain)
  }

  /** Zeros: the input of a quantum with nothing connected. */
  let silence = new Float32Array(0)
  /** Where a second side goes when the output has only one. */
  let unheard = new Float32Array(0)

  return {
    process(input, output, settings) {
      const shape = curveOf(settings)
      const attackFrames = Math.max(0.001, settings.attackSeconds) * sampleRate
      const release = releaseCurve(settings.releaseSeconds)
      const left = output[0]
      const frames = left.length
      if (silence.length < frames) silence = new Float32Array(frames)
      if (unheard.length < frames) unheard = new Float32Array(frames)
      const right = output[1] ?? unheard
      const fromLeft = input[0] ?? silence
      const fromRight = input[1] ?? fromLeft
      for (let division = 0; division < frames; division += DIVISION_FRAMES) {
        detectorAverage = finiteOr(detectorAverage, 1)
        // Pre-warped, so the sine warp lands on the detector's level.
        const target = Math.asin(detectorAverage) / HALF_PI
        const rate = envelopeRate(target, attackFrames, release)
        const end = Math.min(frames, division + DIVISION_FRAMES)
        for (let frame = division; frame < end; frame++) {
          const l = fromLeft[frame]
          const r = fromRight[frame]
          const gain = frameGain(
            Math.max(Math.abs(l), Math.abs(r)),
            shape,
            target,
            rate,
          )
          left[frame] = l * gain
          right[frame] = r * gain
        }
      }
    },
  }
}
