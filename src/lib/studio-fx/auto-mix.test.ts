import { describe, expect, it } from 'vitest'
import { autoMixChain, balanceTrimDb, levelMatchGainDb, REFERENCE_LUFS, roleChain, } from './auto-mix'
import { normalizeChainSpec } from './chain-spec'
import type { SampledAudio } from './loudness'
import { TRACK_ROLES } from './role-chains'

describe('levelMatchGainDb', () => {
  it('brings any clip to the reference loudness', () => {
    expect(levelMatchGainDb(-30)).toBe(12)
    expect(levelMatchGainDb(-9)).toBe(-9)
  })

  it('stops at +36 dB, where only hiss would be raised, and at -24 dB', () => {
    expect(levelMatchGainDb(-80)).toBe(36)
    expect(levelMatchGainDb(20)).toBe(-24)
  })

  it('leaves silence alone rather than amplifying it without limit', () => {
    expect(levelMatchGainDb(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})

describe('roleChain', () => {
  it.each(TRACK_ROLES)(
    'opens %s with the level match and ends with the tone stage and its balance',
    (role) => {
      const chain = roleChain(role, { measuredLufs: -26 })
      expect(chain.effects[0]).toMatchObject({
        id: 'level-match',
        kind: 'gain',
        params: { gainDb: 8 },
      })
      expect(chain.effects.slice(-2).map((effect) => effect.id)).toEqual([
        'tone',
        'balance',
      ])
    },
  )

  it.each(TRACK_ROLES)(
    'gives %s a chain that is already normalised (no value was out of range)',
    (role) => {
      const chain = roleChain(role, { bpm: 120 })
      expect(normalizeChainSpec(chain)).toEqual(chain)
    },
  )

  it('leaves the tone stage flat until a macro tilts it', () => {
    const tone = roleChain('piano').effects.at(-2)!
    expect(tone).toMatchObject({ kind: 'tilt', params: { brightnessDb: 0 } })
  })

  it('builds the voice the way fx-lab does, then adds a ducked echo before the space', () => {
    const ids = roleChain('voice').effects.map((effect) => effect.id)
    expect(ids).toEqual([
      'level-match',
      'cleanup-eq',
      'mud',
      'box',
      'character',
      'nasal',
      'harsh',
      'air',
      'safety',
      'echo',
      'space',
      'tone',
      'balance',
    ])
  })

  it('adds the track level to its role balance', () => {
    const balance = (levelDb?: number) =>
      roleChain('bass', { levelDb }).effects.at(-1)!.params as {
        gainDb: number
      }
    expect(balance().gainDb).toBe(-4)
    expect(balance(3).gainDb).toBe(-1)
  })

  it('applies macros to the chain as voiced, never to a previous result', () => {
    const plain = roleChain('voice', { bpm: 100 })
    const back = roleChain('voice', {
      bpm: 100,
      macros: { space: 0, tone: 0, punch: 0, warmth: 0, width: 0 },
    })
    expect(back).toEqual(plain)
    const wet = roleChain('voice', {
      bpm: 100,
      macros: { space: 100, tone: 0, punch: 0, warmth: 0, width: 0 },
    })
    const mix = (chain: typeof plain) =>
      (
        chain.effects.find((effect) => effect.id === 'space')!.params as {
          mix: number
        }
      ).mix
    expect(mix(wet)).toBe(2 * mix(plain))
  })
})

describe('autoMixChain', () => {
  it('measures the clip and level-matches its chain to the reference', () => {
    const data = new Float32Array(48000 * 3)
    // A full-scale 997 Hz sine on both speakers is 0 LUFS; 0.1 of it is -20.
    for (let i = 0; i < data.length; i++)
      data[i] = 0.1 * Math.sin((2 * Math.PI * 997 * i) / 48000)
    const clip: SampledAudio = {
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => data,
    }
    const levelMatch = autoMixChain('acoustic-guitar', clip).effects[0]
      .params as { gainDb: number }
    expect(levelMatch.gainDb).toBeCloseTo(REFERENCE_LUFS + 20, 1)
  })
})

describe('balanceTrimDb', () => {
  it('lands a processed track at its role’s balance', () => {
    // Drums belong 2 dB under the reference; a chain that left them at -24
    // LUFS needs 4 dB back.
    expect(balanceTrimDb('drums', -24)).toBe(4)
    expect(balanceTrimDb('voice', -16)).toBe(-2)
  })

  it('stops at 12 dB either way and leaves silence alone', () => {
    expect(balanceTrimDb('voice', -60)).toBe(12)
    expect(balanceTrimDb('voice', 10)).toBe(-12)
    expect(balanceTrimDb('voice', Number.NEGATIVE_INFINITY)).toBe(0)
  })

  it('is folded into the balance stage with the track level', () => {
    const chain = roleChain('keys', { trimDb: 2.5, levelDb: -1 })
    expect(chain.effects.at(-1)!.params).toMatchObject({ gainDb: -8 + 2.5 - 1 })
  })
})
