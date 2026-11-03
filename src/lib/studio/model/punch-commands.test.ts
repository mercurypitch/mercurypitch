// Studio punch command tests — a punch replaces what its lane plays under it in place, with short fades on the edges it cuts, as one edit.
import { describe, expect, it } from 'vitest'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { StudioPunchEdit } from './punch-commands'
import type { StudioAsset, StudioClip, StudioProject } from './types'

/** A lane with one clip of 1000 frames from frame 100, unfaded, and audio for a take. */
function lane() {
  const { project, asset, clip } = studioFixture()
  const original: StudioClip = { ...clip, fades: { curve: 'linear-amplitude' } }
  const take: StudioAsset = { ...asset, id: 'take-1', canonicalPcmId: 'pcm-2' }
  return {
    project: { ...project, clips: [original] },
    assets: [asset, take],
    original,
  }
}

/** The take's clip over song frames `from` to `to`, with its own 20-frame fades. */
function takeClip(from: number, to: number): StudioClip {
  const length = to - from
  return {
    id: 'take-clip',
    trackId: 'track-1',
    assetId: 'take-1',
    startFrame: from,
    sourceInFrame: 0,
    sourceOutFrame: length,
    gainDb: 0,
    fades: {
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 0, toSourceFrame: 20 },
      out: { fromSourceFrame: length - 20, toSourceFrame: length },
    },
  }
}

const punch = (from: number, to: number): StudioPunchEdit => ({
  type: 'punch-clip',
  clip: takeClip(from, to),
  afterClipId: 'clip-after',
  fadeFrames: 20,
})

const apply = (
  project: StudioProject,
  command: StudioCommand,
  assets: readonly StudioAsset[],
) => applyStudioCommand(project, command, { assets, now: TEST_NOW })

const byStart = (project: StudioProject) =>
  [...project.clips].sort((a, b) => a.startFrame - b.startFrame)

describe('Studio punch', () => {
  it('splits a clip under the range, drops the middle and puts the take in it, fading the cut edges', () => {
    const { project, assets, original } = lane()
    const [before, take, after] = byStart(
      apply(project, punch(400, 700), assets),
    )
    expect(before).toEqual({
      ...original,
      sourceOutFrame: 300,
      fades: {
        curve: 'linear-amplitude',
        out: { fromSourceFrame: 280, toSourceFrame: 300 },
      },
    })
    expect(take).toEqual(takeClip(400, 700))
    expect(after).toEqual({
      ...original,
      id: 'clip-after',
      startFrame: 700,
      sourceInFrame: 600,
      fades: {
        curve: 'linear-amplitude',
        in: { fromSourceFrame: 600, toSourceFrame: 620 },
      },
    })
  })

  it('trims a clip the range cuts at one edge, and drops one inside it', () => {
    const { project, assets, original } = lane()
    // Over the clip's end: its head stays, faded out at the in point.
    const head = byStart(apply(project, punch(900, 1300), assets))
    expect(head.map((clip) => clip.id)).toEqual(['clip-1', 'take-clip'])
    expect(head[0]).toMatchObject({
      startFrame: 100,
      sourceOutFrame: 800,
      fades: { out: { fromSourceFrame: 780, toSourceFrame: 800 } },
    })
    // Over its start: its tail stays, under its own id, faded in at the out point.
    const tail = byStart(apply(project, punch(0, 300), assets))
    expect(tail.map((clip) => clip.id)).toEqual(['take-clip', 'clip-1'])
    expect(tail[1]).toEqual({
      ...original,
      startFrame: 300,
      sourceInFrame: 200,
      fades: {
        curve: 'linear-amplitude',
        in: { fromSourceFrame: 200, toSourceFrame: 220 },
      },
    })
    // Over all of it: only the take is left.
    expect(apply(project, punch(100, 1100), assets).clips).toEqual([
      takeClip(100, 1100),
    ])
  })

  it('leaves other lanes, and clips beside the range, as they were', () => {
    const { project, assets, original } = lane()
    const neighbour = { ...original, id: 'clip-2', startFrame: 1100 }
    const other = { ...original, id: 'clip-3', trackId: 'track-2' }
    const song = {
      ...project,
      tracks: [
        ...project.tracks,
        { ...project.tracks[0], id: 'track-2', order: 1 },
      ],
      clips: [original, neighbour, other],
    }
    const punched = apply(song, punch(1100, 1150), assets)
    expect(punched.clips.find((clip) => clip.id === 'clip-1')).toEqual(original)
    expect(punched.clips.find((clip) => clip.id === 'clip-3')).toEqual(other)
    expect(punched.clips.find((clip) => clip.id === 'clip-2')).toMatchObject({
      startFrame: 1150,
      sourceInFrame: 50,
    })
  })

  it("fits the fades it adds beside the clip's own, and keeps one that already silences a cut edge", () => {
    const { project, assets, original } = lane()
    const faded = {
      ...original,
      fades: {
        curve: 'linear-amplitude' as const,
        in: { fromSourceFrame: 0, toSourceFrame: 290 },
        out: { fromSourceFrame: 700, toSourceFrame: 720 },
      },
    }
    const song = { ...project, clips: [faded] }
    const [before, , after] = byStart(apply(song, punch(400, 790), assets))
    // Its fade-in nearly fills what is left before the in point.
    expect(before.fades).toEqual({
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 0, toSourceFrame: 290 },
      out: { fromSourceFrame: 290, toSourceFrame: 300 },
    })
    // After the out point, its own fade-out comes 10 frames on.
    expect(after.fades).toEqual({
      curve: 'linear-amplitude',
      in: { fromSourceFrame: 690, toSourceFrame: 700 },
      out: { fromSourceFrame: 700, toSourceFrame: 720 },
    })
    // Its fade-out had silenced it before this out point: nothing to add.
    const [, , silent] = byStart(apply(song, punch(400, 850), assets))
    expect(silent.fades).toEqual(faded.fades)
  })

  it('leaves a fade under way across a cut as it was, rather than change what plays before or after the fades', () => {
    const { project, assets, original } = lane()
    // Fading out from 200 to 600 when the punch cuts it at 300.
    const fadingOut = {
      ...original,
      fades: {
        curve: 'linear-amplitude' as const,
        out: { fromSourceFrame: 200, toSourceFrame: 600 },
      },
    }
    const [before] = byStart(
      apply({ ...project, clips: [fadingOut] }, punch(400, 700), assets),
    )
    expect(before).toEqual({ ...fadingOut, sourceOutFrame: 300 })
    // Fading in from 500 to 900 when the punch hands back at 600.
    const fadingIn = {
      ...original,
      fades: {
        curve: 'linear-amplitude' as const,
        in: { fromSourceFrame: 500, toSourceFrame: 900 },
      },
    }
    const [, , after] = byStart(
      apply({ ...project, clips: [fadingIn] }, punch(400, 700), assets),
    )
    expect(after).toEqual({
      ...fadingIn,
      id: 'clip-after',
      startFrame: 700,
      sourceInFrame: 600,
    })
  })

  it('punches into a loop take, each part keeping its passes', () => {
    const { project, assets, original } = lane()
    const loop = {
      ...original,
      sourceInFrame: 1000,
      sourceOutFrame: 2000,
      passes: { firstFrame: 0, frames: 1000, count: 3 },
    }
    const long = { ...assets[0], normalizedFrameCount: 3000 }
    const song = { ...project, clips: [loop] }
    const parts = byStart(
      apply(song, punch(400, 700), [
        { ...long, canonicalPcmByteLength: 32 + 3000 * 4 },
        assets[1],
      ]),
    )
    expect(parts.map((clip) => clip.passes)).toEqual([
      loop.passes,
      undefined,
      loop.passes,
    ])
  })

  it('is one edit that Undo takes back whole', () => {
    const { project, assets } = lane()
    const options = { assets, now: TEST_NOW }
    const punched = executeStudioCommand(
      createStudioHistory(project),
      punch(400, 700),
      options,
    )
    expect(punched.present.clips).toHaveLength(3)
    expect(punched.present.revision).toBe(project.revision + 1)
    expect(undoStudioCommand(punched, options).present.clips).toEqual(
      project.clips,
    )
  })

  it('refuses a take for a lane the song does not have', () => {
    const { project, assets } = lane()
    expect(() =>
      apply(
        project,
        {
          ...punch(400, 700),
          clip: { ...takeClip(400, 700), trackId: 'gone' },
        },
        assets,
      ),
    ).toThrow()
  })
})
