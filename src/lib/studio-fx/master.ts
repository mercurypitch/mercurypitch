// ============================================================
// Master — the bus chain, the loudness gain and the ceiling
// ============================================================
//
// After fx-lab's master: a subsonic cut, a mono low end, trace saturation
// (drive below 0 dB rounds only the highest peaks), light 1.35:1 glue blended
// at 72 % so tails keep breathing, then one measured gain toward the target
// loudness and a sample ceiling. Studio verifies estimated true peak after
// encoding and applies a separate safety attenuation. The gain never buys
// loudness with more than a set amount of limiting: past that, the song is
// delivered quieter and intact rather than squashed.
//
// The same spec runs live (with the gain measured from the last bounce) and
// offline (`renderMasteredMix`, which measures first), so what plays is what
// exports.

import type { ChainSpec, ParamValues } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { clamp } from './dsp'
import type { LoudnessMeasurement } from './loudness'
import { measureLoudness } from './loudness'
import type { MixMacros } from './mix-macros'
import { applyMixMacros, NEUTRAL_MACROS } from './mix-macros'
import type { RenderThroughChainOptions } from './render'
import { renderThroughChain } from './render'

/** Streaming-platform loudness for an exported song. */
export const DEFAULT_TARGET_LUFS = -14

export const MASTER_CEILING_DB = -1.5
const MAX_LIMITING_DB = 5
// These match the actual gain effect; larger values would silently clamp in the graph.
export const MASTER_MIN_GAIN_DB = -24
export const MASTER_MAX_GAIN_DB = 36

export interface LoudnessPreset {
  readonly id: string
  readonly label: string
  readonly targetLufs: number
  readonly maxLimitingDb: number
}

export const LOUDNESS_PRESETS: readonly LoudnessPreset[] = [
  { id: 'gentle', label: 'Gentle', targetLufs: -16, maxLimitingDb: 3 },
  {
    id: 'streaming',
    label: 'Streaming',
    targetLufs: DEFAULT_TARGET_LUFS,
    maxLimitingDb: MAX_LIMITING_DB,
  },
  { id: 'loud', label: 'Loud', targetLufs: -11, maxLimitingDb: 8 },
]

export interface MasterOptions {
  readonly targetLufs?: number
  readonly ceilingDb?: number
  /** Loudness is never bought with more than this much peak reduction. */
  readonly maxLimitingDb?: number
}

export interface MasterSound {
  readonly macros?: MixMacros
  /** A flavour's master EQ values (see `MixFlavour.masterEq`). */
  readonly masterEq?: ParamValues
}

/** The master bus without the loudness gain and ceiling. */
export function masterBusChain(sound: MasterSound = {}): ChainSpec {
  const spec = normalizeChainSpec({
    effects: [
      {
        id: 'master-eq',
        kind: 'eq',
        params: { lowCutHz: 25, ...sound.masterEq },
      },
      {
        id: 'master-width',
        kind: 'stereo',
        params: { widthPct: 100, monoBelowHz: 100, haasAmount: 0 },
      },
      { id: 'trace', kind: 'saturation', params: { driveDb: -6, mix: 100 } },
      {
        id: 'glue',
        kind: 'compressor',
        params: {
          thresholdDb: -12,
          ratio: 1.35,
          attackMs: 28,
          releaseMs: 220,
          kneeDb: 5,
          makeupDb: 0,
          mix: 72,
        },
      },
    ],
  })
  return applyMixMacros(spec, sound.macros ?? NEUTRAL_MACROS)
}

/** The whole master: bus, loudness gain and ceiling. */
export function masterChain(
  options: MasterSound & {
    readonly gainDb?: number
    readonly ceilingDb?: number
    readonly safetyGainDb?: number
  } = {},
): ChainSpec {
  return normalizeChainSpec({
    effects: [
      ...masterBusChain(options).effects,
      ...masterFinishChain(
        options.gainDb ?? 0,
        options.ceilingDb ?? MASTER_CEILING_DB,
        options.safetyGainDb,
      ).effects,
    ],
  })
}

interface ResolvedMasterOptions {
  readonly target: number
  readonly ceiling: number
  readonly maxLimiting: number
}

function resolve(options: MasterOptions): ResolvedMasterOptions {
  return {
    target: options.targetLufs ?? DEFAULT_TARGET_LUFS,
    ceiling: options.ceilingDb ?? MASTER_CEILING_DB,
    maxLimiting: options.maxLimitingDb ?? MAX_LIMITING_DB,
  }
}

/** The most gain a mix with this true peak may take: the limiting cap. */
function peakAllowedGainDb(
  measurement: LoudnessMeasurement,
  resolved: ResolvedMasterOptions,
): number {
  return resolved.ceiling + resolved.maxLimiting - measurement.truePeakDb
}

/**
 * fx-lab's master gain: the move to the target loudness, unless reaching it
 * would push the true peak more than `maxLimitingDb` into the ceiling — then
 * the mix is delivered quieter and intact rather than squashed.
 */
export function masterGainDb(
  measurement: LoudnessMeasurement,
  options: MasterOptions = {},
): number {
  if (!Number.isFinite(measurement.integratedLufs)) return 0
  const resolved = resolve(options)
  const toTarget = resolved.target - measurement.integratedLufs
  return clamp(
    Math.min(toTarget, peakAllowedGainDb(measurement, resolved)),
    MASTER_MIN_GAIN_DB,
    MASTER_MAX_GAIN_DB,
  )
}

export interface MasteredMix {
  readonly buffer: AudioBuffer
  readonly gainDb: number
  /** The bus output, before the loudness gain and limiter. */
  readonly before: LoudnessMeasurement
  /** The delivered master. */
  readonly after: LoudnessMeasurement
}

/** Limiting takes a little loudness back; a second pass tops it up. */
const MAX_GAIN_PASSES = 3
const LOUDNESS_TOLERANCE_DB = 0.2

export function masterFinishChain(
  gainDb: number,
  ceilingDb: number,
  safetyGainDb = 0,
): ChainSpec {
  return normalizeChainSpec({
    effects: [
      { id: 'loudness', kind: 'gain', params: { gainDb } },
      {
        id: 'ceiling',
        kind: 'limiter',
        params: { ceilingDb, releaseMs: 100 },
      },
      ...(safetyGainDb < 0
        ? [
            {
              id: 'peak-safety',
              kind: 'gain',
              params: { gainDb: safetyGainDb },
            },
          ]
        : []),
    ],
  })
}

/**
 * Master a rendered mix for export: the bus, a measurement, one linear gain
 * toward the target, and the ceiling. Every pass is offline and
 * latency-compensated, so the master stays on the grid. The limiter shaves a
 * little loudness off the peaks it catches, so the delivered master is
 * measured and, while the cap on limiting allows, the gain is topped up.
 */
export async function renderMasteredMix(
  mix: AudioBuffer,
  options: MasterOptions &
    MasterSound &
    Pick<RenderThroughChainOptions, 'createContext'> = {},
): Promise<MasteredMix> {
  const render = { createContext: options.createContext, tailSeconds: 0 }
  const resolved = resolve(options)
  const bussed = await renderThroughChain(mix, masterBusChain(options), render)
  const before = measureLoudness(bussed)
  const finish = async (gain: number) => {
    const buffer = await renderThroughChain(
      bussed,
      masterFinishChain(gain, resolved.ceiling),
      render,
    )
    return { buffer, gainDb: gain, before, after: measureLoudness(buffer) }
  }
  let mastered = await finish(masterGainDb(before, options))
  const cap = Math.min(MASTER_MAX_GAIN_DB, peakAllowedGainDb(before, resolved))
  for (let pass = 1; pass < MAX_GAIN_PASSES; pass++) {
    const short = resolved.target - mastered.after.integratedLufs
    if (!Number.isFinite(short) || Math.abs(short) <= LOUDNESS_TOLERANCE_DB) {
      break
    }
    const next = Math.min(cap, mastered.gainDb + short)
    if (Math.abs(next - mastered.gainDb) < 0.05) break
    mastered = await finish(next)
  }
  return mastered
}
