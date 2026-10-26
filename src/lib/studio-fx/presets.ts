// ============================================================
// Studio FX presets — starting points for a vocal track and the master
// ============================================================
//
// Plain chain specs, normalised at load like any other spec, so a preset can
// never hand the engine a value the parameter ranges do not allow.

import type { ChainSpec } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { masterBusChain, masterChain } from './master'

export interface StudioFxPreset {
  readonly id: string
  readonly label: string
  readonly spec: ChainSpec
}

function preset(
  id: string,
  label: string,
  effects: readonly { kind: string; params: Record<string, number> }[],
): StudioFxPreset {
  return {
    id,
    label,
    spec: normalizeChainSpec({
      effects: effects.map((effect) => ({ ...effect, id: effect.kind })),
    }),
  }
}

export const STUDIO_FX_PRESETS: readonly StudioFxPreset[] = [
  preset('clean-vocal', 'Clean vocal', [
    {
      kind: 'eq',
      params: {
        lowCutHz: 90,
        lowMidHz: 350,
        lowMidDb: -2,
        lowMidQ: 1.2,
        highMidHz: 3500,
        highMidDb: 2,
        highMidQ: 0.9,
        highShelfHz: 11000,
        highShelfDb: 2,
      },
    },
    {
      kind: 'deesser',
      params: { frequencyHz: 6500, thresholdDb: -30, ratio: 5 },
    },
    {
      kind: 'compressor',
      params: {
        thresholdDb: -20,
        ratio: 3,
        attackMs: 8,
        releaseMs: 140,
        kneeDb: 6,
        makeupDb: 4,
      },
    },
    {
      kind: 'reverb',
      params: {
        decayS: 1.2,
        preDelayMs: 20,
        damping: 55,
        lowCutHz: 200,
        highCutHz: 9000,
        mix: 12,
      },
    },
  ]),
  preset('warm-vocal', 'Warm vocal', [
    {
      kind: 'eq',
      params: {
        lowCutHz: 80,
        lowShelfHz: 180,
        lowShelfDb: 2,
        highShelfHz: 9000,
        highShelfDb: -1,
      },
    },
    {
      kind: 'compressor',
      params: {
        thresholdDb: -22,
        ratio: 2.5,
        attackMs: 20,
        releaseMs: 200,
        kneeDb: 10,
        makeupDb: 4,
      },
    },
    { kind: 'saturation', params: { driveDb: 9, toneHz: 9000, mix: 60 } },
    {
      kind: 'reverb',
      params: {
        decayS: 1.6,
        preDelayMs: 25,
        damping: 65,
        lowCutHz: 180,
        highCutHz: 8000,
        mix: 15,
      },
    },
  ]),
  preset('radio-voice', 'Radio voice', [
    {
      kind: 'eq',
      params: {
        lowCutHz: 400,
        highMidHz: 2000,
        highMidDb: 4,
        highMidQ: 0.8,
        highCutHz: 4500,
      },
    },
    { kind: 'saturation', params: { driveDb: 14, toneHz: 7000, outputDb: -2 } },
    {
      kind: 'compressor',
      params: {
        thresholdDb: -28,
        ratio: 6,
        attackMs: 3,
        releaseMs: 80,
        kneeDb: 0,
        makeupDb: 8,
      },
    },
  ]),
  preset('big-room', 'Big room', [
    { kind: 'eq', params: { lowCutHz: 100 } },
    {
      kind: 'compressor',
      params: {
        thresholdDb: -18,
        ratio: 3,
        attackMs: 10,
        releaseMs: 120,
        kneeDb: 6,
        makeupDb: 3,
      },
    },
    {
      kind: 'delay',
      params: {
        timeMs: 380,
        feedback: 28,
        pingPong: 70,
        lowCutHz: 300,
        highCutHz: 5000,
        mix: 16,
      },
    },
    {
      kind: 'reverb',
      params: {
        decayS: 3.2,
        preDelayMs: 35,
        damping: 50,
        lowCutHz: 250,
        highCutHz: 11000,
        mix: 26,
      },
    },
  ]),
]

/**
 * The master as voiced (master.ts): subsonic cut, mono low end, trace
 * saturation, 1.35:1 glue at 72 % and a -1.5 dB ceiling, with no loudness
 * gain until a bounce has been measured.
 */
export const MASTER_CHAIN_PRESET: StudioFxPreset = {
  id: 'master',
  label: 'Master',
  spec: masterChain(),
}

export const MASTER_BUS_CHAIN: ChainSpec = masterBusChain()
