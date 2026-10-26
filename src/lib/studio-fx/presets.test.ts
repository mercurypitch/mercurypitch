import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from './chain-spec'
import { MASTER_CHAIN_PRESET, STUDIO_FX_PRESETS } from './presets'
import { estimateTailSeconds, measureChainLatencyFrames } from './render'

describe('Studio FX presets', () => {
  it('are already normalised, so loading one changes nothing', () => {
    for (const preset of [...STUDIO_FX_PRESETS, MASTER_CHAIN_PRESET]) {
      expect(normalizeChainSpec(preset.spec)).toEqual(preset.spec)
      expect(preset.spec.effects.length).toBeGreaterThan(0)
    }
  })

  it('have unique ids', () => {
    const ids = STUDIO_FX_PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keep every value they were written with (none was clamped)', () => {
    const clean = STUDIO_FX_PRESETS.find(
      (preset) => preset.id === 'clean-vocal',
    )!
    const compressor = clean.spec.effects.find(
      (effect) => effect.kind === 'compressor',
    )!
    expect(compressor.params).toMatchObject({
      thresholdDb: -20,
      ratio: 3,
      makeupDb: 4,
    })
  })

  it('end the master chain in a limiter 1.5 dB under full scale', () => {
    const last = MASTER_CHAIN_PRESET.spec.effects.at(-1)!
    expect(last.kind).toBe('limiter')
    expect(last.params).toMatchObject({ ceilingDb: -1.5 })
  })
})

describe('estimateTailSeconds', () => {
  it('adds the tails of effects in series and ignores bypassed ones', () => {
    const spec = normalizeChainSpec({
      effects: [
        { kind: 'delay', params: { timeMs: 100, feedback: 0 } },
        { kind: 'reverb', params: { decayS: 2, preDelayMs: 50 } },
        { kind: 'reverb', enabled: false, params: { decayS: 8 } },
      ],
    })
    expect(estimateTailSeconds(spec)).toBeCloseTo(0.1 + 2.05 + 0.05, 9)
  })

  it('keeps a small margin for a chain with no time-based effects', () => {
    expect(
      estimateTailSeconds(normalizeChainSpec({ effects: [{ kind: 'eq' }] })),
    ).toBe(0.05)
  })

  it('never asks for more than 30 seconds', () => {
    const spec = normalizeChainSpec({
      effects: [{ kind: 'delay', params: { timeMs: 2000, feedback: 95 } }],
    })
    expect(estimateTailSeconds(spec)).toBe(30)
  })
})

describe('measureChainLatencyFrames', () => {
  it('reports no latency for an empty chain without rendering anything', async () => {
    const createContext = () => {
      throw new Error('should not render')
    }
    await expect(
      measureChainLatencyFrames({ effects: [] }, 48000, createContext),
    ).resolves.toBe(0)
  })
})
