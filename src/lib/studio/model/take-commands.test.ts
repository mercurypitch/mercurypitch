// Studio take commands tests — Crop to this take keeps the take a clip plays, and a loop take's passes only while a comp plays them; Explode takes to new lanes moves each other take to a lane of its own right under the clip's lane; each is one undo step and leaves a valid song.
import { describe, expect, it } from 'vitest'
import { studioClipWithTakes } from './clip-takes'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioTrack } from './defaults'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import { studioCanCropTakes, studioClipCropped } from './take-commands'
import type { StudioAsset, StudioClip, StudioProject } from './types'

/**
 * A song of two lanes, Voice over Keys. Voice's clip-1 keeps three takes,
 * take-2 playing; each was sung 100 frames later into its file than the one
 * before and turned down 3 dB more.
 */
function threeTakes(active = 1) {
  const { project, asset, clip } = studioFixture()
  const assets: StudioAsset[] = [1, 2, 3].map((n) => ({
    ...asset,
    id: `take-${n}`,
    canonicalPcmId: `pcm-${n}`,
  }))
  const one: StudioClip = {
    ...clip,
    startFrame: 100,
    sourceInFrame: 0,
    sourceOutFrame: 600,
    fades: { curve: 'linear-amplitude' },
  }
  const list = assets.map((each, index) => ({
    ...one,
    assetId: each.id,
    sourceInFrame: index * 100,
    sourceOutFrame: 600 + index * 100,
    gainDb: -3 * (index + 1),
  }))
  const voice = { ...project.tracks[0], name: 'Voice', order: 0 }
  const keys = createStudioTrack({ id: 'keys', name: 'Keys', order: 1 })
  const song: StudioProject = {
    ...project,
    tracks: [voice, keys],
    clips: [studioClipWithTakes(list, active)],
  }
  return { song, assets, list }
}

const apply = (
  song: StudioProject,
  assets: readonly StudioAsset[],
  command: StudioCommand,
) => applyStudioCommand(song, command, { assets, now: TEST_NOW })

const explode: StudioCommand = {
  type: 'explode-takes',
  clipId: 'clip-1',
  lanes: [
    { id: 'lane-take-1', name: 'Take 1' },
    { id: 'lane-take-3', name: 'Take 3' },
  ],
  clipIds: ['clip-take-1', 'clip-take-3'],
}

describe('Crop to this take', () => {
  it('keeps the take the clip plays, alone, as one undo step', () => {
    const { song, assets, list } = threeTakes()
    const history = executeStudioCommand(
      createStudioHistory(song),
      { type: 'crop-takes', clipId: 'clip-1' },
      { assets, now: TEST_NOW },
    )
    expect(history.present.clips).toEqual([list[1]])
    expect(history.present.clips[0].takes).toBeUndefined()
    const undone = undoStudioCommand(history, { assets, now: TEST_NOW })
    expect(undone.present.clips).toEqual(song.clips)
    expect(undone.present.tracks).toEqual(song.tracks)
  })

  it('drops the other passes of a loop take unless a comp plays them, and refuses a clip with nothing to drop', () => {
    const { song, assets } = threeTakes()
    const { takes: _takes, activeTake: _active, ...base } = song.clips[0]
    // A loop take alone: three passes of 100 frames, the third playing.
    const alone: StudioClip = {
      ...base,
      sourceInFrame: 200,
      sourceOutFrame: 300,
      passes: { firstFrame: 0, frames: 100, count: 3 },
    }
    expect(studioCanCropTakes(alone)).toBe(true)
    const cropped = studioClipCropped(alone)
    expect(cropped.passes).toBeUndefined()
    expect(cropped).toMatchObject({ sourceInFrame: 200, sourceOutFrame: 300 })
    const comped: StudioClip = {
      ...alone,
      comp: [
        { fromSourceFrame: 200, toSourceFrame: 250, pass: 0 },
        { fromSourceFrame: 250, toSourceFrame: 300, pass: 2 },
      ],
    }
    expect(studioCanCropTakes(comped)).toBe(false)
    expect(() =>
      apply({ ...song, clips: [comped] }, assets, {
        type: 'crop-takes',
        clipId: 'clip-1',
      }),
    ).toThrow(/only take/)
  })
})

describe('Explode takes to new lanes', () => {
  it('moves each other take to a lane of its own right under the lane of the clip, where it sounded, and the clip keeps its take', () => {
    const { song, assets, list } = threeTakes()
    const after = apply(song, assets, explode)
    const lanes = [...after.tracks].sort((a, b) => a.order - b.order)
    expect(lanes.map((lane) => [lane.name, lane.role])).toEqual([
      ['Voice', song.tracks[0].role],
      ['Take 1', song.tracks[0].role],
      ['Take 3', song.tracks[0].role],
      ['Keys', song.tracks[1].role],
    ])
    expect(after.clips).toEqual([
      list[1],
      { ...list[0], id: 'clip-take-1', trackId: 'lane-take-1' },
      { ...list[2], id: 'clip-take-3', trackId: 'lane-take-3' },
    ])
  })

  it('is one undo step, and refuses a clip of one take or a lane short', () => {
    const { song, assets, list } = threeTakes()
    const history = executeStudioCommand(createStudioHistory(song), explode, {
      assets,
      now: TEST_NOW,
    })
    expect(history.present.tracks).toHaveLength(4)
    const undone = undoStudioCommand(history, { assets, now: TEST_NOW })
    expect(undone.present.clips).toEqual(song.clips)
    expect(undone.present.tracks).toEqual(song.tracks)
    expect(() => apply({ ...song, clips: [list[1]] }, assets, explode)).toThrow(
      /only take/,
    )
    expect(() =>
      apply(song, assets, { ...explode, clipIds: ['clip-take-1'] }),
    ).toThrow(/each other take/)
  })
})
