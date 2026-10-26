import { describe, expect, it } from 'vitest'
import type { EffectSpecOf } from './chain-spec'
import { normalizeChainSpec } from './chain-spec'
import { masterBusChain, masterChain, masterGainDb } from './master'
import { findFlavour, NEUTRAL_MACROS } from './mix-macros'

describe('masterGainDb', () => {
  it('reports gains the actual gain effect can apply without silent clamping', () => {
    const gain = masterGainDb({
      integratedLufs: -65,
      samplePeakDb: -60,
      truePeakDb: -60,
    })
    expect(gain).toBe(36)
    expect(
      masterChain({ gainDb: gain }).effects.find(
        (effect): effect is EffectSpecOf<'gain'> =>
          effect.kind === 'gain' && effect.id === 'loudness',
      )?.params.gainDb,
    ).toBe(gain)
  })

  it('moves the mix to the target loudness when the peaks allow it', () => {
    expect(
      masterGainDb({ integratedLufs: -20, samplePeakDb: -12, truePeakDb: -12 }),
    ).toBe(6)
  })

  it('never buys loudness with more than 5 dB of limiting', () => {
    // -20 LUFS with peaks at -1 dBTP: +6 dB would push them 6.5 dB into the
    // -1.5 dB ceiling, so the gain stops at +4.5 and the mix stays intact.
    expect(
      masterGainDb({ integratedLufs: -20, samplePeakDb: -1, truePeakDb: -1 }),
    ).toBeCloseTo(4.5, 9)
  })

  it('follows a chosen target and leaves silence untouched', () => {
    expect(
      masterGainDb(
        { integratedLufs: -20, samplePeakDb: -12, truePeakDb: -12 },
        { targetLufs: -16 },
      ),
    ).toBe(4)
    expect(
      masterGainDb({
        integratedLufs: Number.NEGATIVE_INFINITY,
        samplePeakDb: Number.NEGATIVE_INFINITY,
        truePeakDb: Number.NEGATIVE_INFINITY,
      }),
    ).toBe(0)
  })
})

describe('master bus', () => {
  it('cuts subsonics, monos the low end, then runs trace saturation and 1.35:1 glue at 72 %', () => {
    const bus = masterBusChain()
    expect(bus.effects.map((effect) => effect.id)).toEqual([
      'master-eq',
      'master-width',
      'trace',
      'glue',
    ])
    expect(bus.effects[0].params).toMatchObject({ lowCutHz: 25 })
    expect(bus.effects[1].params).toMatchObject({ monoBelowHz: 100 })
    expect(bus.effects[2].params).toMatchObject({ driveDb: -6 })
    expect(bus.effects[3].params).toMatchObject({ ratio: 1.35, mix: 72 })
  })

  it('ends the full master with the loudness gain and a -1.5 dB ceiling', () => {
    const master = masterChain({ gainDb: 4.5 })
    expect(master.effects.slice(-2)).toMatchObject([
      { id: 'loudness', params: { gainDb: 4.5 } },
      { id: 'ceiling', kind: 'limiter', params: { ceilingDb: -1.5 } },
    ])
    expect(normalizeChainSpec(master)).toEqual(master)
  })

  it('takes the Lo-fi band limit from its flavour, which no macro reaches', () => {
    const lofi = findFlavour('lofi')!
    const bus = masterBusChain({ macros: lofi.macros, masterEq: lofi.masterEq })
    expect(bus.effects[0].params).toMatchObject({
      lowCutHz: 120,
      highCutHz: 6500,
    })
  })

  it('lets warmth drive the trace saturation and width open the master a little', () => {
    const bus = masterBusChain({
      macros: { ...NEUTRAL_MACROS, warmth: 100, width: 100 },
    })
    expect(bus.effects[2].params).toMatchObject({ driveDb: -2 })
    expect(bus.effects[1].params).toMatchObject({ widthPct: 135 })
  })
})
