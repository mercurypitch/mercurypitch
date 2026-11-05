// Studio clip comp tests — a swipe plays another pass over a stretch as one undoable edit, and every edit keeps the comp on the clip it belongs to.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from './arrangement-plan'
import { studioClipComp, studioCompPassAt, studioCompSourceFrame, } from './clip-comp'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject } from './types'

const PASSES = { firstFrame: 200, frames: 1000, count: 3 }

/** A loop take of three 1000-frame passes from frame 200, its clip on the newest (2200 to 3200) at 100. */
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
      in: { fromSourceFrame: 2200, toSourceFrame: 2300 },
      out: { fromSourceFrame: 3100, toSourceFrame: 3200 },
    },
    passes: PASSES,
  }
  return { project: { ...project, clips: [looped] }, assets: [take] }
}

const apply = (
  project: StudioProject,
  command: StudioCommand,
  assets: readonly StudioAsset[],
) => applyStudioCommand(project, command, { assets, now: TEST_NOW })

const comp = (
  clipId: string,
  fromSourceFrame: number,
  toSourceFrame: number,
  pass: number,
): StudioCommand => ({
  type: 'comp-pass',
  clipId,
  fromSourceFrame,
  toSourceFrame,
  pass,
})

const clipOf = (project: StudioProject, id = 'clip-1') =>
  project.clips.find((clip) => clip.id === id)!

describe('comping a loop take', () => {
  it('plays another pass over the swiped stretch and the heard pass either side', () => {
    // Arrange
    const { project, assets } = loopTake()

    // Act
    const next = apply(project, comp('clip-1', 2400, 2700, 0), assets)

    // Assert
    expect(clipOf(next).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
      { fromSourceFrame: 2400, toSourceFrame: 2700, pass: 0 },
      { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
    ])
    expect(clipOf(next).sourceInFrame).toBe(2200)
    expect(next.revision).toBe(project.revision + 1)
  })

  it('reads which pass plays at a frame, and the frame of that pass that sounds', () => {
    const { project, assets } = loopTake()
    const clip = clipOf(apply(project, comp('clip-1', 2400, 2700, 0), assets))
    expect(studioCompPassAt(clip, 2399)).toBe(2)
    expect(studioCompPassAt(clip, 2400)).toBe(0)
    expect(studioCompSourceFrame(clip, 2500)).toBe(500)
    expect(studioCompSourceFrame(clip, 3000)).toBe(3000)
    // Beyond its edges a clip being trimmed plays its edge stretch's pass on.
    expect(studioCompPassAt(clip, 2100)).toBe(2)
    expect(studioClipComp(studioFixture().clip)).toBeNull()
  })

  it('merges a swipe into a neighbour on the same pass', () => {
    const { project, assets } = loopTake()
    const first = apply(project, comp('clip-1', 2400, 2700, 0), assets)

    const next = apply(first, comp('clip-1', 2700, 2900, 0), assets)

    expect(clipOf(next).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
      { fromSourceFrame: 2400, toSourceFrame: 2900, pass: 0 },
      { fromSourceFrame: 2900, toSourceFrame: 3200, pass: 2 },
    ])
  })

  it('writes over the stretches a swipe crosses', () => {
    const { project, assets } = loopTake()
    const first = apply(project, comp('clip-1', 2400, 2700, 0), assets)

    const next = apply(first, comp('clip-1', 2300, 2500, 1), assets)

    expect(clipOf(next).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2300, pass: 2 },
      { fromSourceFrame: 2300, toSourceFrame: 2500, pass: 1 },
      { fromSourceFrame: 2500, toSourceFrame: 2700, pass: 0 },
      { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
    ])
  })

  it('leaves the song as it was for a swipe of the pass already playing there', () => {
    const { project, assets } = loopTake()

    const next = apply(project, comp('clip-1', 2400, 2700, 2), assets)

    expect(next).toBe(project)
  })

  it('plays one pass whole, with no comp, when a swipe covers the clip', () => {
    const { project, assets } = loopTake()
    const comped = apply(project, comp('clip-1', 2400, 2700, 0), assets)

    const next = apply(comped, comp('clip-1', 2200, 3200, 1), assets)

    const clip = clipOf(next)
    expect(clip.comp).toBeUndefined()
    expect(clip.sourceInFrame).toBe(1200)
    expect(clip.sourceOutFrame).toBe(2200)
    expect(clip.fades.in).toEqual({
      fromSourceFrame: 1200,
      toSourceFrame: 1300,
    })
  })

  it('takes a swipe back with one undo, and redoes it with one redo', () => {
    const { project, assets } = loopTake()
    const options = { assets, now: TEST_NOW }
    const history = createStudioHistory(project)

    const swiped = executeStudioCommand(
      history,
      comp('clip-1', 2400, 2700, 0),
      options,
    )
    const undone = undoStudioCommand(swiped, options)
    const redone = redoStudioCommand(undone, options)

    expect(clipOf(undone.present).comp).toBeUndefined()
    expect(clipOf(redone.present).comp).toEqual(clipOf(swiped.present).comp)
  })

  it('refuses a stretch outside the clip, an empty one, a pass the take lacks and a clip with no passes', () => {
    const { project, assets } = loopTake()
    for (const command of [
      comp('clip-1', 2100, 2400, 0),
      comp('clip-1', 3000, 3300, 0),
      comp('clip-1', 2500, 2500, 0),
      comp('clip-1', 2400, 2700, 3),
      comp('clip-1', 2400, 2700, -1),
      comp('clip-1', 2400.5, 2700, 0),
    ])
      expect(() => apply(project, command, assets)).toThrow()
    const plain = studioFixture()
    expect(() =>
      apply(plain.project, comp('clip-1', 100, 200, 0), [plain.asset]),
    ).toThrow(/loop take/)
  })
})

describe('edits to a comped clip', () => {
  function comped() {
    const { project, assets } = loopTake()
    return {
      project: apply(project, comp('clip-1', 2400, 2700, 0), assets),
      assets,
    }
  }

  it('replaces the comp with the whole pass Choose pass picks, as one undo', () => {
    const { project, assets } = comped()
    const options = { assets, now: TEST_NOW }
    const history = createStudioHistory(project)

    const chosen = executeStudioCommand(
      history,
      { type: 'choose-pass', clipId: 'clip-1', pass: 0 },
      options,
    )
    const undone = undoStudioCommand(chosen, options)

    expect(clipOf(chosen.present).comp).toBeUndefined()
    expect(clipOf(chosen.present).sourceInFrame).toBe(200)
    expect(clipOf(undone.present)).toEqual(clipOf(project))
  })

  it('plays the pass a comp is counted on whole when Choose pass picks it', () => {
    const { project, assets } = comped()

    const next = apply(
      project,
      { type: 'choose-pass', clipId: 'clip-1', pass: 2 },
      assets,
    )

    expect(clipOf(next).comp).toBeUndefined()
    expect(clipOf(next).sourceInFrame).toBe(2200)
  })

  it('cuts the comp at a split, each half keeping its own stretches', () => {
    const { project, assets } = comped()

    const next = apply(
      project,
      {
        type: 'split-clip',
        clipId: 'clip-1',
        atFrame: 100 + 450,
        newClipId: 'r',
      },
      assets,
    )

    expect(clipOf(next).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
      { fromSourceFrame: 2400, toSourceFrame: 2650, pass: 0 },
    ])
    expect(clipOf(next, 'r').comp).toEqual([
      { fromSourceFrame: 2650, toSourceFrame: 2700, pass: 0 },
      { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
    ])
  })

  it('plays the one pass a split half keeps whole, and plans the split as before it', () => {
    const { project, assets } = comped()
    const before = compileStudioArrangement(project, assets).lanes[0].segments

    const next = apply(
      project,
      {
        type: 'split-clip',
        clipId: 'clip-1',
        atFrame: 100 + 800,
        newClipId: 'r',
      },
      assets,
    )

    const right = clipOf(next, 'r')
    expect(right.comp).toBeUndefined()
    expect(right.sourceInFrame).toBe(3000)
    const after = compileStudioArrangement(next, assets).lanes[0].segments
    const sound = (segments: typeof before) =>
      segments.map(({ clipIds: _ids, ...rest }) => rest)
    expect(sound(after)).toEqual(sound(before))
  })

  it('clips the comp to a trim, and plays the edge stretch on into a trim back out', () => {
    const { project, assets } = comped()

    const trimmed = apply(
      project,
      { type: 'trim-head', clipId: 'clip-1', sourceInFrame: 2450 },
      assets,
    )
    const out = apply(
      trimmed,
      { type: 'trim-head', clipId: 'clip-1', sourceInFrame: 2250 },
      assets,
    )
    const tail = apply(
      project,
      { type: 'trim-tail', clipId: 'clip-1', sourceOutFrame: 2600 },
      assets,
    )

    expect(clipOf(trimmed).comp).toEqual([
      { fromSourceFrame: 2450, toSourceFrame: 2700, pass: 0 },
      { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
    ])
    expect(clipOf(out).comp).toEqual([
      { fromSourceFrame: 2250, toSourceFrame: 2700, pass: 0 },
      { fromSourceFrame: 2700, toSourceFrame: 3200, pass: 2 },
    ])
    expect(clipOf(tail).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
      { fromSourceFrame: 2400, toSourceFrame: 2600, pass: 0 },
    ])
  })

  it('keeps the comp on a duplicate and a paste', () => {
    const { project, assets } = comped()

    const next = apply(
      project,
      {
        type: 'duplicate-clip',
        clipId: 'clip-1',
        newClipId: 'copy',
        newTrackId: 'lane-copy',
      },
      assets,
    )

    expect(clipOf(next, 'copy').comp).toEqual(clipOf(project).comp)
  })

  it('cuts the comp where a punch takes over the middle of the clip', () => {
    const { project, assets } = comped()
    const take: StudioClip = {
      id: 'punch',
      trackId: 'track-1',
      assetId: 'take-1',
      startFrame: 100 + 250,
      sourceInFrame: 0,
      sourceOutFrame: 300,
      gainDb: 0,
      fades: { curve: 'linear-amplitude' },
    }

    const next = apply(
      project,
      { type: 'punch-clip', clip: take, afterClipId: 'after', fadeFrames: 20 },
      assets,
    )

    expect(clipOf(next).comp).toEqual([
      { fromSourceFrame: 2200, toSourceFrame: 2400, pass: 2 },
      { fromSourceFrame: 2400, toSourceFrame: 2450, pass: 0 },
    ])
    expect(clipOf(next, 'after').comp).toBeUndefined()
    expect(clipOf(next, 'after').sourceInFrame).toBe(2750)
  })
})
