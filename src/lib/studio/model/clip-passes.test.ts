// Studio clip pass tests — a loop take keeps one audio, its clip plays one pass of it, and moves to another as one undoable edit.
import { describe, expect, it } from 'vitest'
import { laneFreezeKeys } from '../playback/lane-freeze'
import { compileStudioArrangement } from './arrangement-plan'
import { studioClipOnPass, studioClipPass, studioClipSourceBounds, studioFitPasses, } from './clip-passes'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject } from './types'
import { validateStudioProject } from './validation'

const PASSES = { firstFrame: 200, frames: 1000, count: 3 }

/** The fixture's take as a loop take: three passes of 1000 frames from frame 200 of one audio, the newest heard. */
function loopTake() {
  const { project, asset, clip } = studioFixture()
  const take: StudioAsset = {
    ...asset,
    id: 'take-1',
    normalizedFrameCount: 3500,
    canonicalPcmByteLength: 32 + 3500 * 4,
  }
  const looped: StudioClip = {
    ...clip,
    assetId: take.id,
    sourceInFrame: 2200,
    sourceOutFrame: 3200,
    fades: {
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 2200, toSourceFrame: 2400 },
      out: { fromSourceFrame: 3000, toSourceFrame: 3200 },
    },
    passes: PASSES,
  }
  return {
    project: { ...project, clips: [looped] },
    assets: [take],
    clip: looped,
  }
}

const apply = (
  project: StudioProject,
  command: StudioCommand,
  assets: readonly StudioAsset[],
) => applyStudioCommand(project, command, { assets, now: TEST_NOW })

describe('Studio clip passes', () => {
  it('plays one pass of the take, the newest when it lands, and trims inside it', () => {
    const { clip } = loopTake()
    expect(studioClipPass(clip)).toEqual({ number: 3, count: 3 })
    expect(studioClipSourceBounds(clip, 3500)).toEqual({
      first: 2200,
      end: 3200,
    })
    const plain = studioFixture().clip
    expect(studioClipPass(plain)).toBeNull()
    expect(studioClipSourceBounds(plain, 1000)).toEqual({ first: 0, end: 1000 })
  })

  it('saves a loop take whose clip sits inside one of its passes, and refuses any other', () => {
    const { project, assets } = loopTake()
    expect(validateStudioProject(project, assets)).toEqual(project)
    const refuses = (clip: object, owned = assets) =>
      expect(() =>
        validateStudioProject(
          { ...project, clips: [{ ...project.clips[0], ...clip }] },
          owned,
        ),
      ).toThrow()
    // Two to 32 passes of at least a frame, as windows, not a list of files.
    refuses({ passes: { ...PASSES, count: 1 } })
    refuses({ passes: { ...PASSES, count: 33 } })
    refuses({ passes: { ...PASSES, frames: 0 } })
    refuses({ passes: { ...PASSES, firstFrame: -1 } })
    refuses({ passes: ['take-1-pass-1', 'take-1-pass-2'] })
    refuses({ passes: { ...PASSES, heard: 2 } })
    // The clip, and its fades, inside one pass.
    refuses({ sourceInFrame: 2100, fades: { curve: 'linear-amplitude' } })
    refuses({
      sourceInFrame: 3200,
      sourceOutFrame: 3300,
      fades: { curve: 'linear-amplitude' },
    })
    refuses({
      fades: {
        curve: 'linear-amplitude',
        in: { fromSourceFrame: 2100, toSourceFrame: 2400 },
      },
    })
    // Every pass is audio the song owns, not only the one heard.
    refuses(
      {
        sourceInFrame: 200,
        sourceOutFrame: 1200,
        fades: { curve: 'linear-amplitude' },
      },
      [
        {
          ...assets[0],
          normalizedFrameCount: 3199,
          canonicalPcmByteLength: 32 + 3199 * 4,
        },
      ],
    )
  })

  it('moves the clip to another pass as one edit, fades and all, that Undo takes back', () => {
    const { project, assets } = loopTake()
    const options = { assets, now: TEST_NOW }
    const chosen = executeStudioCommand(
      createStudioHistory(project),
      { type: 'choose-pass', clipId: 'clip-1', pass: 0 },
      options,
    )
    const [clip] = chosen.present.clips
    expect(clip).toEqual({
      ...project.clips[0],
      sourceInFrame: 200,
      sourceOutFrame: 1200,
      fades: {
        curve: 'linear-amplitude',
        in: { fromSourceFrame: 200, toSourceFrame: 400 },
        out: { fromSourceFrame: 1000, toSourceFrame: 1200 },
      },
    })
    expect(studioClipPass(clip)).toEqual({ number: 1, count: 3 })
    // Still the take's one audio, its first pass heard where the third was.
    const [lane] = compileStudioArrangement(chosen.present, assets).lanes
    expect(
      lane.segments.map(({ assetId, startFrame, sourceInFrame }) => ({
        assetId,
        startFrame,
        sourceInFrame,
      })),
    ).toEqual([{ assetId: 'take-1', startFrame: 100, sourceInFrame: 200 }])
    const undone = undoStudioCommand(chosen, options)
    expect(undone.present.clips[0]).toEqual(project.clips[0])
  })

  it('gives the lane a new freeze key when its clip plays another pass, so a frozen lane renders again', () => {
    const { project, assets } = loopTake()
    const choose = (from: StudioProject, pass: number) =>
      apply(from, { type: 'choose-pass', clipId: 'clip-1', pass }, assets)
    const before = laneFreezeKeys(project, assets)
    const [trackId] = [...before.keys()]
    const chosen = choose(project, 1)
    expect(laneFreezeKeys(chosen, assets).get(trackId)).not.toBe(
      before.get(trackId),
    )
    // The pass heard before brings its key back, and its render with it.
    expect(laneFreezeKeys(choose(chosen, 2), assets).get(trackId)).toBe(
      before.get(trackId),
    )
  })

  it('refuses a pass the clip does not keep, and a pass for a clip with none', () => {
    const { project, assets } = loopTake()
    for (const pass of [-1, 3, 1.5])
      expect(() =>
        apply(project, { type: 'choose-pass', clipId: 'clip-1', pass }, assets),
      ).toThrow()
    const plain = studioFixture()
    expect(() =>
      apply(plain.project, { type: 'choose-pass', clipId: 'clip-1', pass: 0 }, [
        plain.asset,
      ]),
    ).toThrow()
  })

  it('keeps the passes on both halves of a split, each half playing a pass of its own', () => {
    const { project, assets } = loopTake()
    const split = apply(
      project,
      {
        type: 'split-clip',
        clipId: 'clip-1',
        atFrame: 600,
        newClipId: 'clip-2',
      },
      assets,
    )
    expect(split.clips.map((clip) => clip.passes)).toEqual([PASSES, PASSES])
    const chosen = apply(
      split,
      { type: 'choose-pass', clipId: 'clip-2', pass: 1 },
      assets,
    )
    // The first half sings the third pass, the second half the second.
    expect(
      chosen.clips.map((clip) => [clip.sourceInFrame, clip.sourceOutFrame]),
    ).toEqual([
      [2200, 2700],
      [1700, 2200],
    ])
    expect(chosen.clips.map((clip) => studioClipPass(clip)?.number)).toEqual([
      3, 2,
    ])
  })

  it('trims a loop take only inside its pass', () => {
    const { project, assets } = loopTake()
    const trim = (command: StudioCommand) => apply(project, command, assets)
    expect(
      trim({ type: 'trim-tail', clipId: 'clip-1', sourceOutFrame: 3100 })
        .clips[0].sourceOutFrame,
    ).toBe(3100)
    expect(() =>
      trim({ type: 'trim-tail', clipId: 'clip-1', sourceOutFrame: 3201 }),
    ).toThrow()
    expect(() =>
      trim({ type: 'trim-head', clipId: 'clip-1', sourceInFrame: 2199 }),
    ).toThrow()
    // Moved to the first pass, its fades move with it.
    expect(studioClipOnPass(loopTake().clip, 0).fades.out).toEqual({
      fromSourceFrame: 1000,
      toSourceFrame: 1200,
    })
  })

  it('keeps only the passes a decoded take holds whole, the newest of them heard', () => {
    const heard = { sourceInFrame: 2200 }
    expect(studioFitPasses(heard, PASSES, 3500)).toEqual({
      sourceInFrame: 2200,
      sourceOutFrame: 3200,
      passes: PASSES,
    })
    // A frame short of the third pass: two are left, the second heard.
    expect(studioFitPasses(heard, PASSES, 3199)).toEqual({
      sourceInFrame: 1200,
      sourceOutFrame: 2200,
      passes: { ...PASSES, count: 2 },
    })
    // One whole pass is an ordinary clip; none, what there is.
    expect(studioFitPasses(heard, PASSES, 2199)).toEqual({
      sourceInFrame: 200,
      sourceOutFrame: 1200,
    })
    expect(studioFitPasses(heard, PASSES, 1100)).toEqual({
      sourceInFrame: 200,
      sourceOutFrame: 1100,
    })
  })
})
