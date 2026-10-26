// ============================================================
// Mix macros — a few beginner controls that move every chain at once
// ============================================================
//
// Five sliders, each -100..100, where 0 is the mix as the role chains are
// voiced:
//
//   space   reverb and echo level (none at -100, double at +100) and reverb
//           length (x0.67 .. x1.5)
//   tone    a tilt — a 4 kHz shelf of +-3 dB against a 250 Hz shelf of
//           -+1.5 dB, on every chain's `tone` stage — with the air and the
//           reverb's brightness following
//   punch   serial compression harder or softer, parallel compression and
//           transient attack up or down
//   warmth  saturation drive and blend, including the master's trace
//           saturation
//   width   stereo width and Haas spread on every track that has them, and a
//           touch on the master
//
// A macro never adds or removes an effect. It only moves values on effects
// every chain already carries — found by kind, plus the `tone` stage by id —
// so a live chain glides to the new sound without a click, and the same
// macros always bounce to the same audio. Values are always derived from the
// chain as voiced, never from a previous macro result, so moving a slider
// back returns exactly to where it was.
//
// A flavour is a named set of slider positions; Lo-fi also shapes the master
// EQ, which no slider reaches.

import type { ChainSpec, ParamValues } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { clamp } from './dsp'
import type { EffectKind } from './effect-definitions'

export const MACRO_KEYS = ['space', 'tone', 'punch', 'warmth', 'width'] as const

export type MacroKey = (typeof MACRO_KEYS)[number]

export type MixMacros = { readonly [K in MacroKey]: number }

export const MACRO_LABELS: Readonly<
  Record<MacroKey, { label: string; low: string; high: string }>
> = {
  space: { label: 'Space', low: 'Dry', high: 'Big' },
  tone: { label: 'Tone', low: 'Dark', high: 'Bright' },
  punch: { label: 'Punch', low: 'Soft', high: 'Punchy' },
  warmth: { label: 'Warmth', low: 'Clean', high: 'Driven' },
  width: { label: 'Width', low: 'Narrow', high: 'Wide' },
}

export const NEUTRAL_MACROS: MixMacros = {
  space: 0,
  tone: 0,
  punch: 0,
  warmth: 0,
  width: 0,
}

/** Any stored macro set, every value clamped to -100..100, missing ones 0. */
export function normalizeMacros(raw: unknown): MixMacros {
  const source =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {}
  const read = (key: MacroKey): number => {
    const value = source[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? clamp(value, -100, 100)
      : 0
  }
  return {
    space: read('space'),
    tone: read('tone'),
    punch: read('punch'),
    warmth: read('warmth'),
    width: read('width'),
  }
}

/** The macros as fractions, -1..1. */
type Amounts = MixMacros

type Adjust = (p: ParamValues, m: Amounts) => ParamValues

const ADJUSTERS: Partial<Record<EffectKind, Adjust>> = {
  reverb: (p, m) => ({
    ...p,
    mix: p.mix * (1 + m.space),
    decayS: p.decayS * 1.5 ** m.space,
    damping: p.damping - 15 * m.tone,
  }),
  delay: (p, m) => ({
    ...p,
    mix: p.mix * (1 + m.space),
    feedback: p.feedback + 10 * m.space,
  }),
  exciter: (p, m) => ({ ...p, amount: p.amount * (1 + 0.8 * m.tone) }),
  transient: (p, m) => ({
    ...p,
    attack: p.attack + 35 * m.punch,
    sustain: p.sustain - 10 * m.punch,
  }),
  compressor: (p, m) =>
    p.mix < 100
      ? { ...p, mix: p.mix * (1 + 0.6 * m.punch) }
      : {
          ...p,
          ratio: p.ratio * 1.35 ** m.punch,
          thresholdDb: p.thresholdDb - 3 * m.punch,
          makeupDb: p.makeupDb + 1.5 * m.punch,
        },
  saturation: (p, m) => ({
    ...p,
    driveDb: p.driveDb + 4 * m.warmth,
    mix: p.mix * (1 + m.warmth),
  }),
  stereo: (p, m) => ({
    ...p,
    widthPct: p.widthPct * (1 + 0.35 * m.width),
    haasAmount: p.haasAmount * (1 + m.width),
  }),
}

/** Every chain's tilt stage, flat until the tone macro tilts it. */
export const TONE_STAGE_ID = 'tone'

function toneParams(m: Amounts): ParamValues {
  return { brightnessDb: 3 * m.tone }
}

function isNeutral(macros: MixMacros): boolean {
  return MACRO_KEYS.every((key) => macros[key] === 0)
}

/** `spec` (a chain as voiced) with the macros applied, clamped to range. */
export function applyMixMacros(spec: ChainSpec, macros: MixMacros): ChainSpec {
  const safe = normalizeMacros(macros)
  if (isNeutral(safe)) return spec
  const m: Amounts = {
    space: safe.space / 100,
    tone: safe.tone / 100,
    punch: safe.punch / 100,
    warmth: safe.warmth / 100,
    width: safe.width / 100,
  }
  return normalizeChainSpec({
    effects: spec.effects.map((effect) => {
      const params: ParamValues = effect.params
      if (effect.id === TONE_STAGE_ID) {
        return { ...effect, params: { ...params, ...toneParams(m) } }
      }
      const adjust = ADJUSTERS[effect.kind]
      return adjust === undefined
        ? effect
        : { ...effect, params: adjust(params, m) }
    }),
  })
}

/** One track's macros: the song's, with the track's own space offset. */
export function trackMacros(
  song: MixMacros,
  track: { readonly space?: number } = {},
): MixMacros {
  return { ...song, space: clamp(song.space + (track.space ?? 0), -100, 100) }
}

export interface MixFlavour {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly macros: MixMacros
  /** Master EQ values no slider reaches. */
  readonly masterEq?: ParamValues
}

export const MIX_FLAVOURS: readonly MixFlavour[] = [
  {
    id: 'natural',
    label: 'Natural',
    description: 'Balanced and clear, as every chain is voiced.',
    macros: NEUTRAL_MACROS,
  },
  {
    id: 'warm',
    label: 'Warm',
    description: 'A softer top, a rounder bottom and some tape.',
    macros: { space: 15, tone: -45, punch: -20, warmth: 55, width: 0 },
  },
  {
    id: 'bright',
    label: 'Bright',
    description: 'Modern pop: crisp, forward and tight.',
    macros: { space: -10, tone: 45, punch: 25, warmth: 0, width: 20 },
  },
  {
    id: 'big',
    label: 'Big',
    description: 'Wide, with long tails and room around everything.',
    macros: { space: 75, tone: 10, punch: 5, warmth: 10, width: 45 },
  },
  {
    id: 'punchy',
    label: 'Punchy',
    description: 'Hard-hitting drums, driven and close.',
    macros: { space: -35, tone: 15, punch: 65, warmth: 35, width: 10 },
  },
  {
    id: 'intimate',
    label: 'Intimate',
    description: 'Dry and close, as if the band were in the room.',
    macros: { space: -65, tone: -10, punch: -15, warmth: 10, width: -35 },
  },
  {
    id: 'lofi',
    label: 'Lo-fi',
    description: 'Band-limited, saturated and narrow, like an old tape.',
    macros: { space: 20, tone: -60, punch: 20, warmth: 90, width: -60 },
    masterEq: {
      lowCutHz: 120,
      lowMidHz: 1000,
      lowMidDb: 2,
      lowMidQ: 0.7,
      highCutHz: 6500,
    },
  },
]

export function findFlavour(id: string): MixFlavour | undefined {
  return MIX_FLAVOURS.find((flavour) => flavour.id === id)
}
