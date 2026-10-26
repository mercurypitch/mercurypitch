// Studio edge golden vectors prove edits share one bounded, non-multiplying safety policy.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { applyStudioCommand } from '../model/commands'
import { studioFixture } from '../model/model.test-fixtures'
import { STUDIO_EDGE_POLICY_VERSION, studioSegmentGain } from './edge-envelope'

describe('Studio edge policy', () => {
  it('freezes half-cosine 3ms boundary samples and short-group behavior', () => {
    const { project, asset } = studioFixture()
    const segment = {
      ...compileStudioArrangement(project, [asset]).lanes[0].segments[0],
      gainDb: 0,
      preparationGainDb: 0,
      fades: { curve: 'linear-amplitude' as const },
    }
    expect(STUDIO_EDGE_POLICY_VERSION).toBe('studio-edges-3ms-v1')
    expect(
      [100, 136, 172, 208, 244, 956, 1028, 1100].map((frame) =>
        studioSegmentGain(segment, frame),
      ),
    ).toEqual([
      0,
      (1 - Math.SQRT1_2) / 2,
      (1 - Math.cos(Math.PI / 2)) / 2,
      (1 - Math.cos((3 * Math.PI) / 4)) / 2,
      1,
      1,
      (1 - Math.cos(Math.PI / 2)) / 2,
      0,
    ])
    const short = { ...segment, groupEndFrame: 200, sourceOutFrame: 100 }
    expect(studioSegmentGain(short, 100)).toBe(0)
    expect(studioSegmentGain(short, 150)).toBe(1)
    expect(studioSegmentGain(short, 200)).toBe(0)
  })

  it('keeps the stronger explicit fade rather than multiplying fade envelopes', () => {
    const { project, asset } = studioFixture()
    const segment = {
      ...compileStudioArrangement(project, [asset]).lanes[0].segments[0],
      gainDb: 0,
      preparationGainDb: 0,
      fades: {
        curve: 'linear-amplitude' as const,
        in: { fromSourceFrame: 0, toSourceFrame: 300 },
      },
    }
    expect(studioSegmentGain(segment, 172)).toBeCloseTo(0.24, 12)
    expect(studioSegmentGain(segment, 244)).toBeCloseTo(0.48, 12)
  })

  it('coalesces a split before range clipping so neither the seam nor seek gets a safety dip', () => {
    const { project, asset } = studioFixture()
    const split = applyStudioCommand(
      project,
      {
        type: 'split-clip',
        clipId: 'clip-1',
        atFrame: 200,
        newClipId: 'right',
      },
      { assets: [asset] },
    )
    const before = compileStudioArrangement(project, [asset]).lanes[0]
      .segments[0]
    const ranged = compileStudioArrangement(split, [asset], {
      startFrame: 199,
      endFrame: 1000,
    }).lanes[0].segments[0]
    expect(ranged).toMatchObject({
      groupStartFrame: 100,
      groupEndFrame: 1100,
      clipIds: ['clip-1', 'right'],
    })
    for (let frame = 199; frame < 1000; frame++)
      expect(studioSegmentGain(ranged, frame)).toBe(
        studioSegmentGain(before, frame),
      )
  })

  it('preserves retained trim samples outside the safety window', () => {
    const { project, asset } = studioFixture()
    const trimmed = applyStudioCommand(
      project,
      { type: 'trim-head', clipId: 'clip-1', sourceInFrame: 150 },
      { assets: [asset] },
    )
    const before = compileStudioArrangement(project, [asset]).lanes[0]
      .segments[0]
    const after = compileStudioArrangement(trimmed, [asset]).lanes[0]
      .segments[0]
    expect(studioSegmentGain(after, 250)).toBe(0)
    for (let frame = 394; frame < 1100; frame++)
      expect(studioSegmentGain(after, frame)).toBe(
        studioSegmentGain(before, frame),
      )
  })
})
