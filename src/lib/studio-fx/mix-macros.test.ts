import { describe, expect, it } from 'vitest'
import { roleChain } from './auto-mix'
import type { ChainSpec } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { masterBusChain } from './master'
import type { MixMacros } from './mix-macros'
import { applyMixMacros, MACRO_KEYS, MIX_FLAVOURS, NEUTRAL_MACROS, normalizeMacros, trackMacros, } from './mix-macros'
import { TRACK_ROLES } from './role-chains'

function macros(change: Partial<MixMacros>): MixMacros {
  return { ...NEUTRAL_MACROS, ...change }
}

function param(chain: ChainSpec, id: string, key: string): number {
  const effect = chain.effects.find((e) => e.id === id)
  if (effect === undefined) throw new Error(`no ${id}`)
  return (effect.params as Record<string, number>)[key]
}

const voice = roleChain('voice', { bpm: 120 })
const drums = roleChain('drums', { bpm: 120 })

describe('applyMixMacros', () => {
  it('returns the chain untouched when every macro is at zero', () => {
    expect(applyMixMacros(voice, NEUTRAL_MACROS)).toBe(voice)
  })

  it.each(TRACK_ROLES)(
    'never adds, removes or reorders an effect of %s, so a live chain only glides',
    (role) => {
      const base = roleChain(role, { bpm: 90 })
      const extreme = applyMixMacros(
        base,
        macros({ space: 100, tone: -100, punch: 100, warmth: 100, width: 100 }),
      )
      const shape = (chain: ChainSpec) =>
        chain.effects.map((e) => `${e.id}:${e.kind}:${String(e.enabled)}`)
      expect(shape(extreme)).toEqual(shape(base))
      expect(normalizeChainSpec(extreme)).toEqual(extreme)
    },
  )

  it('takes the reverb and echo out at -100 space and doubles them at +100', () => {
    const dry = applyMixMacros(voice, macros({ space: -100 }))
    expect(param(dry, 'space', 'mix')).toBe(0)
    expect(param(dry, 'echo', 'mix')).toBe(0)
    const big = applyMixMacros(voice, macros({ space: 100 }))
    expect(param(big, 'space', 'mix')).toBe(2 * param(voice, 'space', 'mix'))
    expect(param(big, 'space', 'decayS')).toBeCloseTo(
      1.5 * param(voice, 'space', 'decayS'),
      9,
    )
  })

  it('tilts the tone stage: 3 dB brighter at +100, 3 dB darker at -100', () => {
    const bright = applyMixMacros(voice, macros({ tone: 100 }))
    expect(param(bright, 'tone', 'brightnessDb')).toBe(3)
    const dark = applyMixMacros(voice, macros({ tone: -100 }))
    expect(param(dark, 'tone', 'brightnessDb')).toBe(-3)
    expect(param(dark, 'air', 'amount')).toBeLessThan(
      param(voice, 'air', 'amount'),
    )
  })

  it('makes punch hit harder: more transient attack, harder bus glue, more smash', () => {
    const punchy = applyMixMacros(drums, macros({ punch: 100 }))
    expect(param(punchy, 'punch', 'attack')).toBe(60)
    expect(param(punchy, 'glue', 'ratio')).toBeCloseTo(4 * 1.35, 9)
    expect(param(punchy, 'glue', 'thresholdDb')).toBe(-21)
    expect(param(punchy, 'smash', 'mix')).toBeCloseTo(48, 9)
    const soft = applyMixMacros(drums, macros({ punch: -100 }))
    expect(param(soft, 'glue', 'ratio')).toBeLessThan(4)
  })

  it('drives the saturation harder and blends more of it with warmth', () => {
    const warm = applyMixMacros(drums, macros({ warmth: 50 }))
    expect(param(warm, 'tape', 'driveDb')).toBe(6)
    expect(param(warm, 'tape', 'mix')).toBeCloseTo(52.5, 9)
  })

  it('widens what is already stereo and leaves a mono bass mono', () => {
    const bass = roleChain('bass')
    const wide = macros({ width: 100 })
    expect(param(applyMixMacros(bass, wide), 'spread', 'widthPct')).toBe(0)
    const keys = roleChain('keys')
    expect(param(applyMixMacros(keys, wide), 'spread', 'widthPct')).toBeCloseTo(
      125 * 1.35,
      9,
    )
    expect(param(applyMixMacros(keys, wide), 'spread', 'haasAmount')).toBe(50)
  })
})

describe('normalizeMacros', () => {
  it('clamps every value to -100..100 and fills missing ones with 0', () => {
    expect(
      normalizeMacros({ space: 500, tone: -300, punch: Number.NaN }),
    ).toEqual({ space: 100, tone: -100, punch: 0, warmth: 0, width: 0 })
    expect(normalizeMacros(null)).toEqual(NEUTRAL_MACROS)
  })
})

describe('trackMacros', () => {
  it('adds a track’s own space to the song’s, within range', () => {
    const song = macros({ space: 60, tone: 20 })
    expect(trackMacros(song, { space: 30 })).toEqual(
      macros({ space: 90, tone: 20 }),
    )
    expect(trackMacros(song, { space: 80 }).space).toBe(100)
    expect(trackMacros(song)).toEqual(song)
  })
})

describe('MIX_FLAVOURS', () => {
  it('have unique ids, in-range macros, and differ from each other', () => {
    const ids = MIX_FLAVOURS.map((flavour) => flavour.id)
    expect(new Set(ids).size).toBe(ids.length)
    const shapes = new Set(
      MIX_FLAVOURS.map((flavour) => JSON.stringify(flavour.macros)),
    )
    expect(shapes.size).toBe(MIX_FLAVOURS.length)
    for (const flavour of MIX_FLAVOURS) {
      expect(normalizeMacros(flavour.macros)).toEqual(flavour.macros)
      expect(Object.keys(flavour.macros).sort()).toEqual([...MACRO_KEYS].sort())
    }
  })

  // Studio playback moves a running chain to a new flavour in place
  // (StudioFxChain.setSpec). A different effect list would mean a re-patch.
  it('never add, remove or reorder an effect, in any role or on the master', () => {
    const shape = (chain: ChainSpec) =>
      chain.effects.map((effect) => `${effect.id}:${effect.kind}`)
    const extremes = [
      ...MIX_FLAVOURS.map((flavour) => flavour.macros),
      macros({ space: 100, tone: 100, punch: 100, warmth: 100, width: 100 }),
      macros({
        space: -100,
        tone: -100,
        punch: -100,
        warmth: -100,
        width: -100,
      }),
    ]
    for (const role of TRACK_ROLES) {
      const chain = roleChain(role, { bpm: 96 })
      for (const values of extremes)
        expect(shape(applyMixMacros(chain, values))).toEqual(shape(chain))
    }
    const master = masterBusChain()
    for (const flavour of MIX_FLAVOURS)
      expect(
        shape(
          masterBusChain({
            macros: flavour.macros,
            masterEq: flavour.masterEq,
          }),
        ),
      ).toEqual(shape(master))
  })

  it('start from Natural, the chains as voiced', () => {
    expect(MIX_FLAVOURS[0]).toMatchObject({
      id: 'natural',
      macros: NEUTRAL_MACROS,
    })
  })
})
