// Interior authoring tests — invalid imported decorations cannot escape certified scroll contacts.
import { describe, expect, it } from 'vitest'
import { CLOUDWAY_CRYSTAL_PROMENADE_STUDY } from '../content/cloudway-laboratory'
import { crystalInteriorStudySource } from '../content/crystal-interior-study'
import { compileStudioDocument } from './cloudway-studio'
import { compileCloudwayInteriors } from './compile-cloudway-interiors'

const platforms = CLOUDWAY_CRYSTAL_PROMENADE_STUDY.platforms
const valid = { platformId: 'scroll-deck', preset: 'resonance-veins', seed: 42 }
const compile = (value: unknown) =>
  compileCloudwayInteriors(value, platforms, 'interiors')

describe('certified crystal interior authoring', () => {
  it('keeps old documents unchanged and accepts each bounded preset through the real studio compiler', () => {
    expect(compile(undefined)).toBeUndefined()
    expect(compile([])).toEqual([])
    for (const preset of [
      'resonance-veins',
      'frost-roots',
      'aurora-heart',
    ] as const) {
      const [level] = compileStudioDocument(crystalInteriorStudySource(preset))
      expect(level?.presentation?.crystalInteriors).toEqual([
        { ...valid, preset, seed: 270926 },
      ])
    }
    expect(
      compile([
        {
          ...valid,
          intensity: 0,
          speed: 4,
          palette: { primary: 0, secondary: 0xffffff, accent: 0x123456 },
        },
      ]),
    ).toMatchObject([{ intensity: 0, speed: 4 }])
  })

  it.each([
    { platformId: 'missing' },
    { platformId: 'scroll-approach' },
    { preset: 'script' },
    { seed: -1 },
    { seed: 1.5 },
    { seed: 2 ** 32 },
    { seed: Number.NaN },
    { speed: -0.1 },
    { intensity: 4.1 },
    { palette: { primary: 0 } },
    { palette: { primary: 0, secondary: -1, accent: 0 } },
    { palette: { primary: 0, secondary: 0, accent: 0xffffff + 1 } },
    { envelope: { width: 99 } },
  ])('rejects imported unsafe settings %j', (patch) => {
    expect(() => compile([{ ...valid, ...patch }])).toThrow()
  })

  it('rejects repeated ownership and excessive effect counts before rendering', () => {
    expect(() => compile([valid, valid])).toThrow()
    expect(() => compile(Array.from({ length: 17 }, () => valid))).toThrow(
      'at most 16',
    )
  })
})
