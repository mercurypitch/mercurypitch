// Cloudway reward compiler tests — optional discoveries stay finite and route-independent.

import { describe, expect, it } from 'vitest'
import { compileCloudwayDiscoveryRewards } from './compile-cloudway-rewards'

const encounters = [
  { id: 'required-song', optional: false },
  { id: 'side-goblet', optional: true },
  { id: 'side-coupe', optional: true },
] as const

function rewards(): unknown {
  return {
    revision: 1,
    discoveries: [
      { encounterId: 'side-goblet', coinIds: ['alcove-sun'] },
      { encounterId: 'side-coupe', coinIds: ['alcove-moon'] },
    ],
  }
}

describe('Cloudway discovery rewards', () => {
  it('compiles finite coins for optional encounters only', () => {
    expect(
      compileCloudwayDiscoveryRewards(rewards(), encounters, 'course.rewards'),
    ).toEqual({
      revision: 1,
      discoveries: [
        { encounterId: 'side-goblet', coinIds: ['alcove-sun'] },
        { encounterId: 'side-coupe', coinIds: ['alcove-moon'] },
      ],
      grading: [],
    })
  })

  it.each([
    [
      'required encounter',
      {
        revision: 1,
        discoveries: [
          { encounterId: 'required-song', coinIds: ['route-coin'] },
        ],
      },
      'optional encounter',
    ],
    [
      'unknown encounter',
      {
        revision: 1,
        discoveries: [{ encounterId: 'missing', coinIds: ['missing-coin'] }],
      },
      'unknown encounter',
    ],
    [
      'duplicate encounter',
      {
        revision: 1,
        discoveries: [
          { encounterId: 'side-goblet', coinIds: ['first'] },
          { encounterId: 'side-goblet', coinIds: ['second'] },
        ],
      },
      'duplicates rewarded encounter',
    ],
    [
      'duplicate coin',
      {
        revision: 1,
        discoveries: [
          { encounterId: 'side-goblet', coinIds: ['same-coin'] },
          { encounterId: 'side-coupe', coinIds: ['same-coin'] },
        ],
      },
      'duplicates finite coin',
    ],
    [
      'empty coin list',
      {
        revision: 1,
        discoveries: [{ encounterId: 'side-goblet', coinIds: [] }],
      },
      'at least one coin',
    ],
    [
      'unstable coin id',
      {
        revision: 1,
        discoveries: [{ encounterId: 'side-goblet', coinIds: ['Not Stable'] }],
      },
      'lowercase letters',
    ],
    [
      'unsupported grading surface',
      {
        revision: 1,
        discoveries: [],
        grading: [],
      },
      'grading is not supported',
    ],
  ])('rejects %s', (_label, source, message) => {
    expect(() =>
      compileCloudwayDiscoveryRewards(source, encounters, 'course.rewards'),
    ).toThrow(message)
  })
})
