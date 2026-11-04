// Studio comp validation tests — a saved comp covers its clip in order, stretch after stretch, each on a pass the take has.
import { describe, expect, it } from 'vitest'
import { studioFixture } from './model.test-fixtures'
import type { StudioAsset, StudioClip, StudioCompSegment } from './types'
import { validateStudioClip, validateStudioProject } from './validation'

const PASSES = { firstFrame: 200, frames: 1000, count: 3 }

/** A loop take's clip on its newest pass, 2200 to 3200, with `comp`. */
function comped(comp: unknown): StudioClip {
  const { clip } = studioFixture()
  return {
    ...clip,
    assetId: 'take-1',
    sourceInFrame: 2200,
    sourceOutFrame: 3200,
    fades: { curve: 'linear-amplitude' },
    passes: PASSES,
    comp: comp as StudioCompSegment[],
  }
}

const GOOD = [
  { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
  { fromSourceFrame: 2400, toSourceFrame: 2700, pass: 0 },
  { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 1 },
]

describe('Studio comp validation', () => {
  it('accepts a comp that covers its clip stretch after stretch', () => {
    expect(validateStudioClip(comped(GOOD)).comp).toEqual(GOOD)
  })

  it('keeps a comped clip in a saved song with its take', () => {
    const { project, asset } = studioFixture()
    const take: StudioAsset = {
      ...asset,
      id: 'take-1',
      normalizedFrameCount: 3500,
      canonicalPcmByteLength: 32 + 3500 * 4,
    }
    const clip = comped(GOOD)
    expect(
      validateStudioProject({ ...project, clips: [clip] }, [take]).clips[0]
        .comp,
    ).toEqual(GOOD)
  })

  it.each([
    ['a gap', [GOOD[0], { ...GOOD[1], fromSourceFrame: 2450 }, GOOD[2]]],
    ['an overlap', [GOOD[0], { ...GOOD[1], fromSourceFrame: 2350 }, GOOD[2]]],
    ['a late start', [{ ...GOOD[0], fromSourceFrame: 2210 }, GOOD[1], GOOD[2]]],
    ['an early end', [GOOD[0], GOOD[1], { ...GOOD[2], toSourceFrame: 3100 }]],
    ['a pass the take lacks', [GOOD[0], GOOD[1], { ...GOOD[2], pass: 3 }]],
    ['a negative pass', [GOOD[0], { ...GOOD[1], pass: -1 }, GOOD[2]]],
    [
      'a fractional frame',
      [GOOD[0], { ...GOOD[1], toSourceFrame: 2700.5 }, GOOD[2]],
    ],
    [
      'an empty stretch',
      [
        GOOD[0],
        { ...GOOD[1], toSourceFrame: 2400 },
        { ...GOOD[2], fromSourceFrame: 2400 },
      ],
    ],
    ['neighbours on one pass', [GOOD[0], GOOD[1], { ...GOOD[2], pass: 0 }]],
    ['one stretch', [{ fromSourceFrame: 2200, toSourceFrame: 3200, pass: 1 }]],
    ['an unknown field', [GOOD[0], { ...GOOD[1], gainDb: 0 }, GOOD[2]]],
    ['not a list', { fromSourceFrame: 2200, toSourceFrame: 3200, pass: 1 }],
  ])('refuses %s', (_name, comp) => {
    expect(() => validateStudioClip(comped(comp))).toThrow()
  })

  it('refuses a comp on a clip that is no loop take', () => {
    const { passes: _passes, ...plain } = comped(GOOD)
    expect(() => validateStudioClip(plain)).toThrow(/loop take/)
  })

  it('refuses more stretches than a comp keeps', () => {
    const many = Array.from({ length: 600 }, (_, index) => ({
      fromSourceFrame: 2200 + index,
      toSourceFrame: 2201 + index,
      pass: index % 2,
    }))
    const clip = { ...comped(many), sourceOutFrame: 2800 }
    expect(() => validateStudioClip(clip)).toThrow(/stretches/)
  })
})
