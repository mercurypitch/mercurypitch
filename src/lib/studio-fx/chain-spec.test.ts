import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { createEffectSpec, defaultEffectParams, insertEffect, MAX_CHAIN_EFFECTS, moveEffect, normalizeChainSpec, removeEffect, updateEffect, } from './chain-spec'
import { EFFECT_DEFINITIONS, EFFECT_KINDS } from './effect-definitions'

describe('normalizeChainSpec', () => {
  it('turns anything that is not a chain into an empty chain', () => {
    for (const input of [undefined, null, 42, 'eq', [], { effects: 'eq' }]) {
      expect(normalizeChainSpec(input)).toEqual({ version: 1, effects: [] })
    }
  })

  it('drops effects of unknown kinds and keeps the rest in order', () => {
    const spec = normalizeChainSpec({
      effects: [{ kind: 'reverb' }, { kind: 'flanger' }, null, { kind: 'eq' }],
    })
    expect(spec.effects.map((effect) => effect.kind)).toEqual(['reverb', 'eq'])
  })

  it('clamps out-of-range values and fills missing or non-numeric ones with defaults', () => {
    const [effect] = normalizeChainSpec({
      effects: [
        {
          kind: 'compressor',
          params: {
            thresholdDb: -400,
            ratio: 99,
            attackMs: 'fast',
            mix: Number.NaN,
          },
        },
      ],
    }).effects
    expect(effect.params).toMatchObject({
      thresholdDb: -60,
      ratio: 20,
      attackMs: 10,
      mix: 100,
    })
  })

  it('makes ids unique, keeping a valid given id and naming the duplicates after their kind', () => {
    const spec = normalizeChainSpec({
      effects: [
        { kind: 'eq', id: 'vocal-eq' },
        { kind: 'eq', id: 'vocal-eq' },
        { kind: 'eq', id: 'has spaces' },
        { kind: 'reverb' },
      ],
    })
    expect(spec.effects.map((effect) => effect.id)).toEqual([
      'vocal-eq',
      'eq',
      'eq-2',
      'reverb',
    ])
  })

  it('treats a missing enabled flag as enabled but keeps an explicit false', () => {
    const spec = normalizeChainSpec({
      effects: [{ kind: 'eq' }, { kind: 'delay', enabled: false }],
    })
    expect(spec.effects.map((effect) => effect.enabled)).toEqual([true, false])
  })

  it(`caps a chain at ${MAX_CHAIN_EFFECTS} effects`, () => {
    const spec = normalizeChainSpec({
      effects: Array.from({ length: 40 }, () => ({ kind: 'eq' })),
    })
    expect(spec.effects).toHaveLength(MAX_CHAIN_EFFECTS)
  })

  it('is idempotent for any input', () => {
    const effectArbitrary = fc.record({
      kind: fc.constantFrom(...EFFECT_KINDS, 'chorus'),
      id: fc.oneof(fc.string(), fc.constantFrom('eq', 'a', 'b')),
      enabled: fc.oneof(fc.boolean(), fc.constant(undefined)),
      params: fc.dictionary(
        fc.constantFrom('mix', 'thresholdDb', 'decayS', 'timeMs', 'lowCutHz'),
        fc.oneof(fc.double(), fc.integer({ min: -1e6, max: 1e6 })),
      ),
    })
    fc.assert(
      fc.property(fc.array(effectArbitrary, { maxLength: 24 }), (effects) => {
        const once = normalizeChainSpec({ effects })
        expect(normalizeChainSpec(once)).toEqual(once)
      }),
    )
  })
})

describe('effect definitions', () => {
  it('give every parameter a default inside its own range', () => {
    for (const kind of EFFECT_KINDS) {
      for (const param of EFFECT_DEFINITIONS[kind].params) {
        expect(param.min).toBeLessThan(param.max)
        expect(param.defaultValue).toBeGreaterThanOrEqual(param.min)
        expect(param.defaultValue).toBeLessThanOrEqual(param.max)
      }
    }
  })

  it('start the EQ flat so adding one changes nothing', () => {
    const eq = defaultEffectParams('eq')
    expect([eq.lowShelfDb, eq.lowMidDb, eq.highMidDb, eq.highShelfDb]).toEqual([
      0, 0, 0, 0,
    ])
    expect([eq.lowCutHz, eq.highCutHz]).toEqual([20, 20000])
  })
})

describe('chain edits', () => {
  const base = normalizeChainSpec({
    effects: [{ kind: 'eq' }, { kind: 'compressor' }, { kind: 'reverb' }],
  })

  it('creates an effect with an id the chain does not use yet', () => {
    const chain = insertEffect(base, createEffectSpec('eq', base))
    expect(chain.effects.map((effect) => effect.id)).toEqual([
      'eq',
      'compressor',
      'reverb',
      'eq-2',
    ])
  })

  it('inserts at a position, clamped into the chain', () => {
    const delay = createEffectSpec('delay', base)
    expect(insertEffect(base, delay, 1).effects.map((e) => e.kind)).toEqual([
      'eq',
      'delay',
      'compressor',
      'reverb',
    ])
    expect(insertEffect(base, delay, -5).effects[0].kind).toBe('delay')
  })

  it('moves an effect and leaves the chain alone for an unknown id', () => {
    expect(moveEffect(base, 'reverb', 0).effects.map((e) => e.id)).toEqual([
      'reverb',
      'eq',
      'compressor',
    ])
    expect(moveEffect(base, 'nope', 0)).toBe(base)
  })

  it('removes an effect by id', () => {
    expect(removeEffect(base, 'compressor').effects.map((e) => e.id)).toEqual([
      'eq',
      'reverb',
    ])
  })

  it('updates one effect, merging and clamping its parameters', () => {
    const chain = updateEffect(base, 'reverb', {
      enabled: false,
      params: { mix: 250, decayS: 2 },
    })
    const reverb = chain.effects[2]
    expect(reverb.enabled).toBe(false)
    expect(reverb.params).toMatchObject({ mix: 100, decayS: 2, preDelayMs: 15 })
    expect(chain.effects[0]).toBe(base.effects[0])
  })
})
