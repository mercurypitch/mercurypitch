// Studio clip takes: a take recorded over takes stacks on them, every take lines up with the others through every edit, and the song refuses a take it cannot play.
// Over TESTING.md's 600 lines (3.5): every edit a take must survive reads
// against the one fixture of takes above its cases, and split, each part
// would copy it.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from './arrangement-plan'
import { studioCompSourceFrame } from './clip-comp'
import { STUDIO_MAX_CLIP_TAKES, studioClipActiveTake, studioClipAssetIds, studioClipTakeBounds, studioClipTakeCount, studioClipTakeList, studioClipTakeStep, studioClipTakeSteps, studioClipWithTakes, studioSongAssetIds, studioStackTargets, } from './clip-takes'
import type { StudioCommand } from './commands'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import type { SourceKind, StudioAsset, StudioClip, StudioProject, } from './types'
import { validateStudioProject } from './validation'

function recorded(
  base: StudioAsset,
  id: string,
  frames: number,
  kind: SourceKind = 'recording',
): StudioAsset {
  return {
    ...base,
    id,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: frames * 4 + 32,
    canonicalPcmId: `pcm-${id}`,
    provenance: { kind, importedAt: TEST_NOW },
  }
}

/** One lane with one recorded take, frames 100 to 900 of the song, and the audio of more takes ready. */
function takesFixture() {
  const base = studioFixture()
  const assets = [
    recorded(base.asset, 'take-1', 1200),
    recorded(base.asset, 'take-2', 1500),
    recorded(base.asset, 'take-3', 1500),
    recorded(base.asset, 'backing', 3000, 'file'),
  ]
  const first: StudioClip = {
    id: 'clip-1',
    trackId: 'track-1',
    assetId: 'take-1',
    startFrame: 100,
    sourceInFrame: 200,
    sourceOutFrame: 1000,
    gainDb: -3,
    fades: { curve: 'linear-amplitude' },
  }
  const project: StudioProject = { ...base.project, clips: [first] }
  return { project, assets, first }
}

/** A take as it lands on track-1: `assetId`'s audio from `sourceIn`, `frames` long, from song frame `start`. */
function landed(
  assetId: string,
  start: number,
  sourceIn: number,
  frames: number,
): StudioClip {
  return {
    id: `${assetId}-clip`,
    trackId: 'track-1',
    assetId,
    startFrame: start,
    sourceInFrame: sourceIn,
    sourceOutFrame: sourceIn + frames,
    gainDb: 0,
    fades: { curve: 'linear-amplitude' },
  }
}

const IDS = ['new-1', 'new-2', 'new-3', 'new-4', 'new-5', 'new-6']

function stack(
  project: StudioProject,
  assets: readonly StudioAsset[],
  clip: StudioClip,
  newClipIds: readonly string[] = IDS,
): StudioProject {
  return applyStudioCommand(
    project,
    { type: 'stack-take', clip, newClipIds },
    { assets, now: TEST_NOW },
  )
}

function apply(
  project: StudioProject,
  assets: readonly StudioAsset[],
  command: StudioCommand,
): StudioProject {
  return applyStudioCommand(project, command, { assets, now: TEST_NOW })
}

/** The song's clips by where they start, as [start, end, playing asset, take count]. */
function laneOf(project: StudioProject) {
  return [...project.clips]
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((clip) => [
      clip.startFrame,
      clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame,
      clip.assetId,
      studioClipTakeCount(clip),
    ])
}

const clipAt = (project: StudioProject, start: number) =>
  project.clips.find((clip) => clip.startFrame === start)!

/** The frame of each take's audio heard at song frame `frame`: what keeps takes lined up. */
function heardAt(clip: StudioClip, frame: number): Record<string, number> {
  return Object.fromEntries(
    studioClipTakeList(clip).map((take) => [
      take.assetId,
      take.sourceInFrame + frame - take.startFrame,
    ]),
  )
}

describe('a clip of one take', () => {
  it('is its own take list, and packs back unchanged', () => {
    const { first } = takesFixture()
    expect(studioClipTakeList(first)).toEqual([first])
    expect(studioClipWithTakes([first], 0)).toEqual(first)
    expect(studioClipTakeCount(first)).toBe(1)
    expect(studioClipActiveTake(first)).toBe(0)
    expect(studioClipAssetIds(first)).toEqual(['take-1'])
  })
})

describe('stacking a take recorded over takes', () => {
  it('from the same frame and longer: the stretch they share plays the new take, its extra is a clip of its own', () => {
    const { project, assets } = takesFixture()
    const next = stack(project, assets, landed('take-2', 100, 300, 1100))
    expect(laneOf(next)).toEqual([
      [100, 900, 'take-2', 2],
      [900, 1200, 'take-2', 1],
    ])
    const shared = clipAt(next, 100)
    expect(shared).toMatchObject({
      id: 'clip-1',
      sourceInFrame: 300,
      sourceOutFrame: 1100,
      gainDb: 0,
      activeTake: 1,
      takes: [{ assetId: 'take-1', offsetFrames: -100, gainDb: -3 }],
    })
    // Each take sounds where it sounded before the stack.
    expect(heardAt(shared, 500)).toEqual({ 'take-1': 600, 'take-2': 700 })
    expect(clipAt(next, 900)).toMatchObject({
      id: 'take-2-clip',
      sourceInFrame: 1100,
    })
    expect(next.tracks).toHaveLength(1)
  })

  it('shorter: the old take plays on after the stretch they share, as it did', () => {
    const { project, assets } = takesFixture()
    const next = stack(project, assets, landed('take-2', 100, 300, 400))
    expect(laneOf(next)).toEqual([
      [100, 500, 'take-2', 2],
      [500, 900, 'take-1', 1],
    ])
    expect(clipAt(next, 500)).toMatchObject({ id: 'new-1', sourceInFrame: 600 })
  })

  it('starting before the clip: the new take plays alone up to it', () => {
    const { project, assets } = takesFixture()
    const next = stack(project, assets, landed('take-2', 0, 300, 600))
    expect(laneOf(next)).toEqual([
      [0, 100, 'take-2', 1],
      [100, 600, 'take-2', 2],
      [600, 900, 'take-1', 1],
    ])
    expect(clipAt(next, 0).id).toBe('take-2-clip')
    expect(clipAt(next, 100).id).toBe('clip-1')
  })

  it('over two clips: each shared stretch stacks, and the gap between them plays the new take alone', () => {
    const { project, assets, first } = takesFixture()
    const two = {
      ...project,
      clips: [
        { ...first, sourceOutFrame: 600 },
        {
          ...first,
          id: 'clip-2',
          startFrame: 700,
          sourceInFrame: 0,
          sourceOutFrame: 300,
        },
      ],
    }
    const next = stack(two, assets, landed('take-2', 300, 300, 600))
    expect(laneOf(next)).toEqual([
      [100, 300, 'take-1', 1],
      [300, 500, 'take-2', 2],
      [500, 700, 'take-2', 1],
      [700, 900, 'take-2', 2],
      [900, 1000, 'take-1', 1],
    ])
    expect(clipAt(next, 100).id).toBe('clip-1')
    expect(clipAt(next, 700).id).toBe('clip-2')
    expect(clipAt(next, 500).id).toBe('take-2-clip')
    // The two shared stretches line their old takes up as before.
    expect(heardAt(clipAt(next, 300), 400)['take-1']).toBe(500)
    expect(heardAt(clipAt(next, 700), 800)['take-1']).toBe(100)
  })

  it('a third take is the newest of three, all in the order they were sung', () => {
    const { project, assets } = takesFixture()
    const two = stack(project, assets, landed('take-2', 100, 300, 800))
    const three = stack(two, assets, landed('take-3', 100, 50, 800))
    const clip = clipAt(three, 100)
    expect(studioClipTakeList(clip).map((take) => take.assetId)).toEqual([
      'take-1',
      'take-2',
      'take-3',
    ])
    expect(studioClipActiveTake(clip)).toBe(2)
    expect(heardAt(clip, 100)).toEqual({
      'take-1': 200,
      'take-2': 300,
      'take-3': 50,
    })
    expect(studioClipAssetIds(clip)).toEqual(['take-3', 'take-1', 'take-2'])
  })

  it('plays only the newest take, and undo gives the clip back as it was', () => {
    const { project, assets } = takesFixture()
    const plan = compileStudioArrangement(
      stack(project, assets, landed('take-2', 100, 300, 800)),
      assets,
    )
    expect(plan.lanes[0].segments.map((segment) => segment.assetId)).toEqual([
      'take-2',
    ])

    const history = executeStudioCommand(
      createStudioHistory(project),
      {
        type: 'stack-take',
        clip: landed('take-2', 100, 300, 800),
        newClipIds: IDS,
      },
      { assets, now: TEST_NOW },
    )
    const undone = undoStudioCommand(history, { assets, now: TEST_NOW })
    expect(undone.present.clips).toEqual(project.clips)
  })

  it('refuses a stack that runs out of the ids it was given', () => {
    const { project, assets } = takesFixture()
    expect(() =>
      stack(project, assets, landed('take-2', 300, 300, 200), []),
    ).toThrow('Too few clip ids')
  })
})

describe('the clips a take may stack on', () => {
  const kindOf = (assets: readonly StudioAsset[]) => (id: string) =>
    assets.find((asset) => asset.id === id)?.provenance.kind

  it('are the takes under it; a free stretch has none', () => {
    const { project, assets, first } = takesFixture()
    expect(
      studioStackTargets(project, 'track-1', 0, 200, kindOf(assets)),
    ).toEqual([first])
    expect(
      studioStackTargets(project, 'track-1', 900, 1200, kindOf(assets)),
    ).toEqual([])
  })

  it('are none over a picked file, a MIDI clip, a full clip or audio not known', () => {
    const { project, assets, first } = takesFixture()
    const over = (clip: StudioClip, known = assets) =>
      studioStackTargets(
        { ...project, clips: [clip] },
        'track-1',
        0,
        200,
        kindOf(known),
      )
    expect(over({ ...first, assetId: 'backing' })).toBeNull()
    expect(
      over({ ...first, midi: { sequenceId: 's', renderKey: 'k' } }),
    ).toBeNull()
    expect(over(first, [])).toBeNull()
    const full = studioClipWithTakes(
      Array.from({ length: STUDIO_MAX_CLIP_TAKES }, () => first),
      0,
    )
    expect(over(full)).toBeNull()
  })
})

describe('edits of a clip of several takes', () => {
  function stacked() {
    const fixture = takesFixture()
    const project = stack(
      fixture.project,
      fixture.assets,
      landed('take-2', 100, 300, 800),
    )
    return { ...fixture, project, clip: clipAt(project, 100) }
  }

  it('a split gives both halves every take, lined up', () => {
    const { project, assets } = stacked()
    const next = apply(project, assets, {
      type: 'split-clip',
      clipId: 'clip-1',
      atFrame: 400,
      newClipId: 'right',
    })
    const left = clipAt(next, 100)
    const right = clipAt(next, 400)
    expect(studioClipTakeCount(left)).toBe(2)
    expect(studioClipTakeCount(right)).toBe(2)
    expect(heardAt(left, 300)).toEqual({ 'take-1': 400, 'take-2': 500 })
    expect(heardAt(right, 600)).toEqual({ 'take-1': 700, 'take-2': 800 })
  })

  it('a trim moves every take with the clip, and stops where any take runs out of audio', () => {
    const { project: base, assets, first } = takesFixture()
    // The clip from song frame 500, so its head has room to grow.
    const project = stack(
      { ...base, clips: [{ ...first, startFrame: 500 }] },
      assets,
      landed('take-2', 500, 300, 800),
    )
    const framesOf = (id: string) =>
      assets.find((asset) => asset.id === id)?.normalizedFrameCount
    // take-1 reaches its frame 0 where take-2 is at 100; take-1 ends at
    // 1200, where take-2 is at 1300, short of its own end at 1500.
    expect(studioClipTakeBounds(clipAt(project, 500), framesOf)).toEqual({
      first: 100,
      end: 1300,
    })
    const trimmed = apply(project, assets, {
      type: 'trim-head',
      clipId: 'clip-1',
      sourceInFrame: 100,
    })
    expect(heardAt(clipAt(trimmed, 300), 300)).toEqual({
      'take-1': 0,
      'take-2': 100,
    })
    expect(() =>
      apply(project, assets, {
        type: 'trim-head',
        clipId: 'clip-1',
        sourceInFrame: 99,
      }),
    ).toThrow(/takes\[0\]\.sourceInFrame/)
  })

  it('a punch over it fades every take at the edges it cuts, so a take chosen there later meets them too', () => {
    const { project, assets } = stacked()
    const punched = apply(project, assets, {
      type: 'punch-clip',
      clip: landed('take-3', 400, 0, 200),
      afterClipId: 'after',
      fadeFrames: 24,
    })
    const before = clipAt(punched, 100)
    const after = clipAt(punched, 600)
    // Before the punch: song 100 to 400, take-2 at 300 to 600, take-1 at 200 to 500.
    expect(studioClipTakeList(before).map((take) => take.fades.out)).toEqual([
      { fromSourceFrame: 476, toSourceFrame: 500 },
      { fromSourceFrame: 576, toSourceFrame: 600 },
    ])
    // After it: song 600 to 900, take-2 from 800, take-1 from 700.
    expect(studioClipTakeList(after).map((take) => take.fades.in)).toEqual([
      { fromSourceFrame: 700, toSourceFrame: 724 },
      { fromSourceFrame: 800, toSourceFrame: 824 },
    ])
    expect(studioClipActiveTake(before)).toBe(1)
    expect(studioClipActiveTake(after)).toBe(1)
  })

  it('a pass chosen for the playing loop take leaves the other takes where they sound', () => {
    const { project, assets, first } = takesFixture()
    const loop = {
      ...landed('take-2', 100, 900, 400),
      passes: { firstFrame: 100, frames: 400, count: 3 },
    }
    const next = stack(project, assets, loop)
    const before = heardAt(clipAt(next, 100), 300)['take-1']
    const chosen = apply(next, assets, {
      type: 'choose-pass',
      clipId: first.id,
      pass: 0,
    })
    const clip = clipAt(chosen, 100)
    expect(clip.sourceInFrame).toBe(100)
    expect(heardAt(clip, 300)).toEqual({ 'take-1': before, 'take-2': 300 })
  })

  it('a take not playing whose shared stretch lies in one pass of its comp plays that pass whole, sounding as before', () => {
    const { project, assets, first } = takesFixture()
    // take-1 as a loop take of two passes, comped: pass 2, then pass 1.
    const comped: StudioClip = {
      ...first,
      sourceInFrame: 400,
      sourceOutFrame: 800,
      passes: { firstFrame: 0, frames: 400, count: 2 },
      comp: [
        { fromSourceFrame: 400, toSourceFrame: 600, pass: 1 },
        { fromSourceFrame: 600, toSourceFrame: 800, pass: 0 },
      ],
    }
    // Song frame 400 sounds frame 700 of pass 1, frame 300 of the file.
    const next = stack(
      { ...project, clips: [comped] },
      assets,
      landed('take-2', 300, 300, 400),
    )
    const shared = clipAt(next, 300)
    const [waiting] = studioClipTakeList(shared)
    expect(waiting.assetId).toBe('take-1')
    // Its stretch kept one pass, so it plays that pass whole.
    expect(waiting.comp).toBeUndefined()
    expect(heardAt(shared, 400)['take-1']).toBe(300)
    expect(() => validateStudioProject(next, assets)).not.toThrow()
  })

  it('a take not playing keeps a comp of several stretches through a stack, a split and a trim, sounding as before', () => {
    const { project, assets, first } = takesFixture()
    // take-1 as a loop take of three passes, comped over pass 2's window:
    // pass 1, then pass 3, then pass 2. Song frames 100 to 500.
    const comped: StudioClip = {
      ...first,
      sourceInFrame: 400,
      sourceOutFrame: 800,
      passes: { firstFrame: 0, frames: 400, count: 3 },
      comp: [
        { fromSourceFrame: 400, toSourceFrame: 500, pass: 0 },
        { fromSourceFrame: 500, toSourceFrame: 650, pass: 2 },
        { fromSourceFrame: 650, toSourceFrame: 800, pass: 1 },
      ],
    }
    const takeOne = (clip: StudioClip) =>
      studioClipTakeList(clip).find((take) => take.assetId === 'take-1')!
    // take-1's file frame heard at song frames 150, 300 and 420, one in
    // each stretch, and the stretches of each clip's take-1, left to right.
    const heard = (song: StudioProject) =>
      [150, 300, 420].map((frame) => {
        const take = takeOne(
          song.clips.find(
            (clip) =>
              clip.startFrame <= frame &&
              frame <
                clip.startFrame + clip.sourceOutFrame - clip.sourceInFrame,
          )!,
        )
        return studioCompSourceFrame(
          take,
          take.sourceInFrame + frame - take.startFrame,
        )
      })
    const stretches = (song: StudioProject) =>
      [...song.clips]
        .sort((a, b) => a.startFrame - b.startFrame)
        .map((clip) => takeOne(clip).comp?.length)

    const stacked = stack(
      { ...project, clips: [comped] },
      assets,
      landed('take-2', 100, 300, 400),
    )
    const split = apply(stacked, assets, {
      type: 'split-clip',
      clipId: first.id,
      atFrame: 250,
      newClipId: 'right',
    })
    const trimmed = apply(split, assets, {
      type: 'trim-tail',
      clipId: 'right',
      sourceOutFrame: 650,
    })

    expect(heard({ ...project, clips: [comped] })).toEqual([50, 1000, 720])
    expect(clipAt(stacked, 100).assetId).toBe('take-2')
    expect(stretches(stacked)).toEqual([3])
    expect(stretches(split)).toEqual([2, 2])
    expect(stretches(trimmed)).toEqual([2, 2])
    for (const song of [stacked, split, trimmed])
      expect(heard(song)).toEqual([50, 1000, 720])
    expect(() => validateStudioProject(trimmed, assets)).not.toThrow()
  })
})

describe('the song with clips of several takes', () => {
  it('counts every take audio as its own', () => {
    const { project, assets } = takesFixture()
    const next = stack(project, assets, landed('take-2', 100, 300, 400))
    expect([...studioSongAssetIds(next)].sort()).toEqual(['take-1', 'take-2'])
  })

  it('refuses takes that are not whole, a take past its audio or not owned, and takes on a MIDI clip', () => {
    const { project, assets, first } = takesFixture()
    const two = studioClipWithTakes(
      [
        first,
        {
          ...first,
          assetId: 'take-2',
          sourceInFrame: 300,
          sourceOutFrame: 1100,
        },
      ],
      1,
    )
    const song = (clip: unknown) => ({ ...project, clips: [clip] })
    expect(() => validateStudioProject(song(two), assets)).not.toThrow()
    const { activeTake: _active, ...unplayed } = two
    expect(() => validateStudioProject(song(unplayed), assets)).toThrow(
      'together',
    )
    expect(() =>
      validateStudioProject(song({ ...two, activeTake: 2 }), assets),
    ).toThrow("The playing take is not one of the clip's")
    expect(() =>
      validateStudioProject(song({ ...two, takes: [] }), assets),
    ).toThrow('A clip keeps 2 to')
    const past = {
      ...two,
      takes: [{ ...two.takes![0], offsetFrames: 300 }],
    }
    expect(() => validateStudioProject(song(past), assets)).toThrow(
      'Source bounds exceed owned audio',
    )
    expect(() =>
      validateStudioProject(
        song(two),
        assets.filter((asset) => asset.id !== 'take-1'),
      ),
    ).toThrow('Owned source is missing')
    expect(() =>
      validateStudioProject(
        song({ ...two, midi: { sequenceId: 's', renderKey: 'k' } }),
      ),
    ).toThrow('A MIDI clip has one take')
  })

  it.each(['passes', 'comp'])(
    'refuses a take not playing whose %s is null, as it refuses the playing take’s',
    (field) => {
      const { project, assets, first } = takesFixture()
      const two = studioClipWithTakes(
        [
          first,
          {
            ...first,
            assetId: 'take-2',
            sourceInFrame: 300,
            sourceOutFrame: 1100,
          },
        ],
        1,
      )
      const opened = (clip: unknown) => () =>
        validateStudioProject({ ...project, clips: [clip] }, assets)
      const waiting = { ...two, takes: [{ ...two.takes![0], [field]: null }] }

      expect(opened(two)).not.toThrow()
      expect(opened(waiting)).toThrow(`project.clips[0].takes[0].${field}`)
      expect(opened({ ...two, [field]: null })).toThrow(
        `project.clips[0].${field}`,
      )
    },
  )

  it('opens a song saved before takes, unchanged', () => {
    const { project, assets } = takesFixture()
    expect(validateStudioProject(project, assets)).toEqual(project)
  })
})

describe('choosing a take', () => {
  /** clip-1 of three takes, take-3 playing: take-1 and take-2 recorded, take-3 a loop take of three passes. */
  function threeTakes() {
    const fixture = takesFixture()
    const two = stack(
      fixture.project,
      fixture.assets,
      landed('take-2', 100, 300, 800),
    )
    // take-3 sang three passes of 400 frames; its third plays.
    const loop = {
      ...landed('take-3', 100, 900, 400),
      passes: { firstFrame: 100, frames: 400, count: 3 },
    }
    const three = stack(
      { ...two, clips: [{ ...clipAt(two, 100), sourceOutFrame: 700 }] },
      fixture.assets,
      loop,
    )
    return { ...fixture, project: three, clip: clipAt(three, 100) }
  }

  it('steps through every take, each pass of a loop take a step of its own and a comped one a single step', () => {
    const { clip } = threeTakes()
    expect(studioClipTakeSteps(clip)).toEqual([
      { take: 0 },
      { take: 1 },
      { take: 2, pass: 0 },
      { take: 2, pass: 1 },
      { take: 2, pass: 2 },
    ])
    // Playing take-3's third pass.
    expect(studioClipTakeStep(clip)).toBe(4)
    const comped = studioClipWithTakes(
      studioClipTakeList(clip).map((take, index) =>
        index === 2
          ? {
              ...take,
              comp: [
                { fromSourceFrame: 900, toSourceFrame: 1100, pass: 2 },
                { fromSourceFrame: 1100, toSourceFrame: 1300, pass: 0 },
              ],
            }
          : take,
      ),
      2,
    )
    expect(studioClipTakeSteps(comped)).toEqual([
      { take: 0 },
      { take: 1 },
      { take: 2 },
    ])
    expect(studioClipTakeStep(comped)).toBe(2)
  })

  it('plays the chosen take with every take still lined up, and choosing back gives the clip as it was', () => {
    const { project, assets, clip } = threeTakes()
    const before = heardAt(clip, 300)
    const first = apply(project, assets, {
      type: 'choose-take',
      clipId: 'clip-1',
      take: 0,
    })
    const chosen = clipAt(first, 100)
    expect(chosen).toMatchObject({
      assetId: 'take-1',
      activeTake: 0,
      gainDb: -3,
    })
    expect(heardAt(chosen, 300)).toEqual(before)
    const back = apply(first, assets, {
      type: 'choose-take',
      clipId: 'clip-1',
      take: 2,
    })
    expect(clipAt(back, 100)).toEqual(clip)
  })

  it('plays another pass of a loop take, whether or not it plays now, and refuses a take or a pass the clip lacks', () => {
    const { project, assets } = threeTakes()
    const onFirst = apply(project, assets, {
      type: 'choose-take',
      clipId: 'clip-1',
      take: 0,
    })
    const pass = apply(onFirst, assets, {
      type: 'choose-take',
      clipId: 'clip-1',
      take: 2,
      pass: 0,
    })
    const clip = clipAt(pass, 100)
    expect(clip).toMatchObject({ assetId: 'take-3', sourceInFrame: 100 })
    expect(studioClipTakeStep(clip)).toBe(2)
    for (const wrong of [
      { take: 3 },
      { take: -1 },
      { take: 0, pass: 0 },
      { take: 2, pass: 3 },
    ])
      expect(() =>
        apply(project, assets, {
          type: 'choose-take',
          clipId: 'clip-1',
          ...wrong,
        }),
      ).toThrow(/is not one of the/)
  })

  it('is one undo step, "choose take"', () => {
    const { project, assets } = threeTakes()
    const history = executeStudioCommand(
      createStudioHistory(project),
      { type: 'choose-take', clipId: 'clip-1', take: 1 },
      { assets, now: TEST_NOW },
    )
    expect(clipAt(history.present, 100).assetId).toBe('take-2')
    const undone = undoStudioCommand(history, { assets, now: TEST_NOW })
    expect(undone.present.clips).toEqual(project.clips)
  })
})
