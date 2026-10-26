// ============================================================
// Studio FX definitions — every insert effect and its parameter ranges
// ============================================================
//
// The single source of truth for what a Studio chain may contain. A saved or
// shared chain is untrusted input, so normalisation clamps every value against
// the ranges here and the effect graphs never see an out-of-range number.
//
// Defaults are chosen so that adding an effect never surprises: the EQ is
// flat, time-based effects start at a modest mix, and the dynamics start
// gentle. Presets carry the opinionated settings, not the defaults.

export type ParamUnit = 'dB' | 'Hz' | 'ms' | 's' | '%' | 'ratio' | 'Q'

export interface ParamDescriptor<Key extends string = string> {
  readonly key: Key
  readonly label: string
  readonly unit: ParamUnit
  readonly min: number
  readonly max: number
  readonly defaultValue: number
  /** Slider mapping hint: frequencies and times read best on a log scale. */
  readonly scale: 'linear' | 'log'
}

export interface EffectDefinition {
  readonly label: string
  readonly params: readonly ParamDescriptor[]
}

function param<const Key extends string>(
  key: Key,
  label: string,
  unit: ParamUnit,
  range: readonly [min: number, max: number],
  defaultValue: number,
  scale: 'linear' | 'log' = 'linear',
): ParamDescriptor<Key> {
  return { key, label, unit, min: range[0], max: range[1], defaultValue, scale }
}

const GAIN_RANGE = [-15, 15] as const
const Q_RANGE = [0.3, 6] as const
const MIX_RANGE = [0, 100] as const

export const EFFECT_DEFINITIONS = {
  gain: {
    label: 'Gain',
    params: [param('gainDb', 'Gain', 'dB', [-24, 36], 0)],
  },
  eq: {
    label: 'EQ',
    params: [
      // 24 dB/octave; off at 20 Hz.
      param('lowCutHz', 'Low cut', 'Hz', [20, 600], 20, 'log'),
      param('lowShelfHz', 'Low shelf', 'Hz', [40, 500], 120, 'log'),
      param('lowShelfDb', 'Low shelf gain', 'dB', GAIN_RANGE, 0),
      param('lowMidHz', 'Low mid', 'Hz', [120, 2000], 400, 'log'),
      param('lowMidDb', 'Low mid gain', 'dB', GAIN_RANGE, 0),
      param('lowMidQ', 'Low mid width', 'Q', Q_RANGE, 1, 'log'),
      param('highMidHz', 'High mid', 'Hz', [800, 8000], 3000, 'log'),
      param('highMidDb', 'High mid gain', 'dB', GAIN_RANGE, 0),
      param('highMidQ', 'High mid width', 'Q', Q_RANGE, 1, 'log'),
      param('highShelfHz', 'High shelf', 'Hz', [3000, 16000], 10000, 'log'),
      param('highShelfDb', 'High shelf gain', 'dB', GAIN_RANGE, 0),
      // 12 dB/octave; off at 20 kHz.
      param('highCutHz', 'High cut', 'Hz', [2000, 20000], 20000, 'log'),
    ],
  },
  tilt: {
    label: 'Tone',
    params: [
      // Shelves at 4 kHz (this much) and 250 Hz (half as much the other way).
      param('brightnessDb', 'Brightness', 'dB', [-6, 6], 0),
    ],
  },
  dyneq: {
    label: 'Dynamic EQ',
    params: [
      param('frequencyHz', 'Frequency', 'Hz', [60, 12000], 280, 'log'),
      param('q', 'Width', 'Q', Q_RANGE, 1, 'log'),
      param('thresholdDb', 'Threshold', 'dB', [-60, 0], -24),
      param('ratio', 'Ratio', 'ratio', [1, 20], 2, 'log'),
      param('rangeDb', 'Range', 'dB', [0, 24], 4),
      param('attackMs', 'Attack', 'ms', [0.1, 200], 20, 'log'),
      param('releaseMs', 'Release', 'ms', [10, 1000], 200, 'log'),
    ],
  },
  deesser: {
    label: 'De-esser',
    params: [
      param('frequencyHz', 'Frequency', 'Hz', [2500, 12000], 6500, 'log'),
      param('thresholdDb', 'Threshold', 'dB', [-60, 0], -30),
      param('ratio', 'Ratio', 'ratio', [1, 20], 6, 'log'),
    ],
  },
  compressor: {
    label: 'Compressor',
    params: [
      param('thresholdDb', 'Threshold', 'dB', [-60, 0], -18),
      param('ratio', 'Ratio', 'ratio', [1, 20], 3, 'log'),
      param('attackMs', 'Attack', 'ms', [0.1, 200], 10, 'log'),
      param('releaseMs', 'Release', 'ms', [10, 1000], 120, 'log'),
      param('kneeDb', 'Knee', 'dB', [0, 30], 6),
      param('makeupDb', 'Makeup', 'dB', [0, 24], 0),
      param('mix', 'Mix', '%', MIX_RANGE, 100),
    ],
  },
  transient: {
    label: 'Transient shaper',
    params: [
      // +100 % lifts each hit by up to 6 dB; -100 % softens it by up to 6 dB.
      param('attack', 'Attack', '%', [-100, 100], 0),
      param('sustain', 'Sustain', '%', [-100, 100], 0),
    ],
  },
  saturation: {
    label: 'Saturation',
    params: [
      // Below 0 dB only the highest peaks are rounded: a master's trace colour.
      param('driveDb', 'Drive', 'dB', [-12, 24], 6),
      param('toneHz', 'Tone', 'Hz', [2000, 20000], 20000, 'log'),
      param('outputDb', 'Output', 'dB', [-24, 12], 0),
      param('mix', 'Mix', '%', MIX_RANGE, 100),
    ],
  },
  exciter: {
    label: 'Air',
    params: [
      // The band that is excited; its octaves are the air that is added.
      param('frequencyHz', 'Frequency', 'Hz', [1000, 10000], 3500, 'log'),
      param('driveDb', 'Drive', 'dB', [0, 36], 24),
      param('amount', 'Amount', '%', MIX_RANGE, 30),
    ],
  },
  stereo: {
    label: 'Stereo',
    params: [
      // Side level: 0 % folds to mono, 100 % leaves the image as it is.
      param('widthPct', 'Width', '%', [0, 200], 100),
      // Below this the side is removed, so the low end stays centred; off at 20 Hz.
      param('monoBelowHz', 'Mono below', 'Hz', [20, 300], 20, 'log'),
      // A short Haas pair behind the centre, for width from a mono source.
      param('haasMs', 'Haas delay', 'ms', [4, 30], 14),
      param('haasAmount', 'Haas level', '%', MIX_RANGE, 0),
    ],
  },
  delay: {
    label: 'Delay',
    params: [
      param('timeMs', 'Time', 'ms', [10, 2000], 250, 'log'),
      param('feedback', 'Feedback', '%', [0, 95], 25),
      param('pingPong', 'Ping-pong', '%', [0, 100], 0),
      param('lowCutHz', 'Low cut', 'Hz', [20, 2000], 150, 'log'),
      param('highCutHz', 'High cut', 'Hz', [1000, 20000], 8000, 'log'),
      param('mix', 'Mix', '%', MIX_RANGE, 20),
      // How far the echoes dip while the dry is sounding; 100 % is -12 dB.
      param('duck', 'Duck', '%', MIX_RANGE, 0),
    ],
  },
  reverb: {
    label: 'Reverb',
    params: [
      param('decayS', 'Decay', 's', [0.3, 8], 1.6, 'log'),
      param('preDelayMs', 'Pre-delay', 'ms', [0, 200], 15),
      param('damping', 'Damping', '%', [0, 100], 50),
      param('lowCutHz', 'Low cut', 'Hz', [20, 1000], 150, 'log'),
      param('highCutHz', 'High cut', 'Hz', [2000, 20000], 12000, 'log'),
      param('mix', 'Mix', '%', MIX_RANGE, 18),
      // How far the return dips while the dry is sounding; 100 % is -12 dB.
      param('duck', 'Duck', '%', MIX_RANGE, 0),
    ],
  },
  limiter: {
    label: 'Limiter',
    params: [
      param('driveDb', 'Input', 'dB', [0, 18], 0),
      param('ceilingDb', 'Ceiling', 'dB', [-12, 0], -1),
      param('releaseMs', 'Release', 'ms', [10, 1000], 100, 'log'),
    ],
  },
} as const satisfies Record<string, EffectDefinition>

export type EffectKind = keyof typeof EFFECT_DEFINITIONS

/** The order a vocal chain usually runs in; UIs offer effects in this order. */
export const EFFECT_KINDS: readonly EffectKind[] = [
  'gain',
  'eq',
  'tilt',
  'dyneq',
  'deesser',
  'compressor',
  'transient',
  'saturation',
  'exciter',
  'stereo',
  'delay',
  'reverb',
  'limiter',
]

export type ParamKey<K extends EffectKind> =
  (typeof EFFECT_DEFINITIONS)[K]['params'][number]['key']

export type EffectParams<K extends EffectKind> = {
  readonly [P in ParamKey<K>]: number
}

export function isEffectKind(value: unknown): value is EffectKind {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(EFFECT_DEFINITIONS, value)
  )
}

export function paramDescriptors(kind: EffectKind): readonly ParamDescriptor[] {
  return EFFECT_DEFINITIONS[kind].params
}
