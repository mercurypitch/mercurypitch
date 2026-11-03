// Studio clip pass tests — a loop take's clip keeps its passes, plays one, and swaps it as one undoable edit.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from './arrangement-plan'
import { studioClipAssetIds, studioClipPass, studioSongAssetIds, } from './clip-passes'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset } from './types'
import { validateStudioProject } from './validation'

/** The fixture's take as a loop take of three passes, the newest heard. */
function loopTake() {
  const { project, asset, clip } = studioFixture()
  const pass = (n: number): StudioAsset => ({
    ...asset,
    id: `take-1-pass-${n}`,
    canonicalPcmId: `pcm-pass-${n}`,
  })
  const assets = [pass(1), pass(2), pass(3)]
  const passes = assets.map((value) => value.id)
  const looped = { ...clip, assetId: passes[2], passes }
  return { project: { ...project, clips: [looped] }, assets, clip: looped }
}

describe('Studio clip passes', () => {
  it('keeps every pass of a loop take, and only the heard asset of any other clip', () => {
    const { clip } = loopTake()
    expect(studioClipAssetIds(clip)).toEqual([
      'take-1-pass-1',
      'take-1-pass-2',
      'take-1-pass-3',
    ])
    expect(studioClipPass(clip)).toEqual({ number: 3, count: 3 })
    const plain = studioFixture().clip
    expect(studioClipAssetIds(plain)).toEqual(['asset-1'])
    expect(studioClipPass(plain)).toBeNull()
    expect(studioSongAssetIds([clip, plain]).size).toBe(4)
  })

  it('saves a loop take whose passes all cover the clip, and refuses any other', () => {
    const { project, assets } = loopTake()
    expect(validateStudioProject(project, assets)).toEqual(project)
    const refuses = (clip: object, owned = assets) =>
      expect(() =>
        validateStudioProject(
          { ...project, clips: [{ ...project.clips[0], ...clip }] },
          owned,
        ),
      ).toThrow()
    // The heard pass must be kept, every pass once, and at least two.
    refuses({ passes: ['take-1-pass-1', 'take-1-pass-2'] })
    refuses({ passes: ['take-1-pass-3', 'take-1-pass-3'] })
    refuses({ passes: ['take-1-pass-3'] })
    refuses({ passes: 'take-1-pass-3' })
    // A pass the song does not own, or one shorter than the clip, is refused.
    refuses({}, assets.slice(1))
    refuses({}, [
      { ...assets[0], normalizedFrameCount: 999 },
      ...assets.slice(1),
    ])
  })

  it('swaps the heard pass as one edit that Undo takes back, and plays the new one', () => {
    const { project, assets } = loopTake()
    const options = { assets, now: TEST_NOW }
    const history = createStudioHistory(project)
    const chosen = executeStudioCommand(
      history,
      { type: 'choose-pass', clipId: 'clip-1', assetId: 'take-1-pass-1' },
      options,
    )
    const [clip] = chosen.present.clips
    expect(clip).toEqual({ ...project.clips[0], assetId: 'take-1-pass-1' })
    const [lane] = compileStudioArrangement(chosen.present, assets).lanes
    expect(lane.segments.map((segment) => segment.assetId)).toEqual([
      'take-1-pass-1',
    ])
    const undone = undoStudioCommand(chosen, options)
    expect(undone.present.clips[0].assetId).toBe('take-1-pass-3')
  })

  it('refuses a pass the clip does not keep, and a pass for a clip with none', () => {
    const { project, assets } = loopTake()
    expect(() =>
      applyStudioCommand(
        project,
        { type: 'choose-pass', clipId: 'clip-1', assetId: 'asset-1' },
        { assets, now: TEST_NOW },
      ),
    ).toThrow()
    const plain = studioFixture()
    expect(() =>
      applyStudioCommand(
        plain.project,
        { type: 'choose-pass', clipId: 'clip-1', assetId: 'asset-1' },
        { assets: [plain.asset], now: TEST_NOW },
      ),
    ).toThrow()
  })

  it('keeps the passes on both halves of a split, each half choosing on its own', () => {
    const { project, assets } = loopTake()
    const options = { assets, now: TEST_NOW }
    const split = applyStudioCommand(
      project,
      {
        type: 'split-clip',
        clipId: 'clip-1',
        atFrame: 600,
        newClipId: 'clip-2',
      },
      options,
    )
    expect(split.clips.map((clip) => clip.passes)).toEqual([
      project.clips[0].passes,
      project.clips[0].passes,
    ])
    const chosen = applyStudioCommand(
      split,
      { type: 'choose-pass', clipId: 'clip-2', assetId: 'take-1-pass-2' },
      options,
    )
    expect(chosen.clips.map((clip) => clip.assetId)).toEqual([
      'take-1-pass-3',
      'take-1-pass-2',
    ])
  })
})
