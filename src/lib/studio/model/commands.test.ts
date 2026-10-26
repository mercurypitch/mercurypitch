import { describe, expect, it } from 'vitest'
import { compileStudioArrangement, studioClipGainAtSourceFrame, } from './arrangement-plan'
import { applyStudioCommand } from './commands'
import { createStudioTrack } from './defaults'
import { createStudioHistory, executeStudioCommand, redoStudioCommand, undoStudioCommand, } from './history'
import { studioFixture, TEST_NOW } from './model.test-fixtures'

describe('non-destructive Studio commands', () => {
  it('changes role with its base sound and balance while preserving user mix controls and source preparation', () => {
    const { project, asset } = studioFixture()
    const old = {
      ...project.tracks[0],
      gainDb: -7,
      balanceGainDb: -9,
      pan: 0.4,
      mute: true,
      solo: true,
    }
    const edited = { ...project, tracks: [old] }
    const result = applyStudioCommand(
      edited,
      { type: 'set-track-role', trackId: old.id, role: 'voice' },
      { assets: [asset], now: TEST_NOW },
    )
    const expected = createStudioTrack({
      id: old.id,
      name: old.name,
      order: old.order,
      role: 'voice',
    })
    expect(result.tracks[0]).toEqual({
      ...old,
      role: 'voice',
      balanceGainDb: expected.balanceGainDb,
      fx: expected.fx,
    })
    expect(result.clips).toEqual(project.clips)
    expect(asset.preparation.gainDb).toBe(3)
    expect(
      applyStudioCommand(
        result,
        { type: 'set-track-role', trackId: old.id, role: 'voice' },
        { assets: [asset] },
      ),
    ).toBe(result)
    const level = expected.fx.baseSpec.effects.find(
      (effect) => effect.id === 'level-match',
    )
    expect(level).toBeDefined()
    expect(level?.params).toMatchObject({ gainDb: 0 })
  })
  it.each([200, 1000])(
    'splits within a fade at timeline frame %i without changing any sample gain or restarting the source',
    (atFrame) => {
      const { project, asset, clip } = studioFixture()
      const originalJson = JSON.stringify(project)
      const result = applyStudioCommand(
        project,
        { type: 'split-clip', clipId: clip.id, atFrame, newClipId: 'right' },
        { assets: [asset], now: TEST_NOW },
      )
      expect(result.clips).toHaveLength(2)
      for (
        let frame = clip.startFrame;
        frame < clip.startFrame + 1000;
        frame++
      ) {
        const segment = result.clips.find(
          (part) =>
            frame >= part.startFrame &&
            frame < part.startFrame + part.sourceOutFrame - part.sourceInFrame,
        )
        expect(segment).toBeDefined()
        if (!segment) throw new Error('Missing split segment')
        expect(
          studioClipGainAtSourceFrame(
            segment,
            segment.sourceInFrame + frame - segment.startFrame,
          ),
        ).toBe(studioClipGainAtSourceFrame(clip, frame - clip.startFrame))
      }
      const planned = compileStudioArrangement(result, [asset])
      expect(planned.lanes[0].segments).toHaveLength(1)
      expect(planned.lanes[0].segments[0]).toMatchObject({
        clipIds: ['clip-1', 'right'],
        sourceInFrame: 0,
        sourceOutFrame: 1000,
        startFrame: 100,
      })
      expect(JSON.stringify(project)).toBe(originalJson)
    },
  )

  it('head trim and untrim retain timeline alignment and the original envelope', () => {
    const { project, asset, clip } = studioFixture()
    const trimmed = applyStudioCommand(
      project,
      { type: 'trim-head', clipId: clip.id, sourceInFrame: 150 },
      { assets: [asset], now: TEST_NOW },
    )
    expect(trimmed.clips[0]).toMatchObject({
      startFrame: 250,
      sourceInFrame: 150,
      sourceOutFrame: 1000,
      fades: clip.fades,
    })
    expect(studioClipGainAtSourceFrame(trimmed.clips[0], 150)).toBe(
      studioClipGainAtSourceFrame(clip, 150),
    )
    const restored = applyStudioCommand(
      trimmed,
      { type: 'trim-head', clipId: clip.id, sourceInFrame: 0 },
      { assets: [asset], now: TEST_NOW },
    )
    expect(restored.clips).toEqual(project.clips)
    expect(restored.revision).toBe(2)
  })

  it('tail trim changes only source out and rejects an empty interval', () => {
    const { project, asset, clip } = studioFixture()
    const result = applyStudioCommand(
      project,
      { type: 'trim-tail', clipId: clip.id, sourceOutFrame: 900 },
      { assets: [asset], now: TEST_NOW },
    )
    expect(result.clips[0]).toEqual({ ...clip, sourceOutFrame: 900 })
    expect(() =>
      applyStudioCommand(
        project,
        { type: 'trim-tail', clipId: clip.id, sourceOutFrame: 0 },
        { assets: [asset] },
      ),
    ).toThrow()
  })

  it('rejects an occupied move atomically and allows touching edges', () => {
    const { project, asset, clip } = studioFixture()
    const two = {
      ...project,
      clips: [clip, { ...clip, id: 'next', startFrame: 1100 }],
    }
    expect(() =>
      applyStudioCommand(
        two,
        {
          type: 'move-clip',
          clipId: 'next',
          trackId: clip.trackId,
          startFrame: 1099,
        },
        { assets: [asset] },
      ),
    ).toThrow(/overlap/)
    expect(two.clips[1].startFrame).toBe(1100)
    expect(
      applyStudioCommand(
        two,
        {
          type: 'move-clip',
          clipId: 'next',
          trackId: clip.trackId,
          startFrame: 1100,
        },
        { assets: [asset] },
      ),
    ).toBe(two)
  })

  it('duplicates at the exact end and creates a new lane on conflict as one undo step', () => {
    const { project, asset, clip } = studioFixture()
    const two = {
      ...project,
      clips: [clip, { ...clip, id: 'next', startFrame: 1100 }],
    }
    const history = createStudioHistory(two)
    const duplicate = executeStudioCommand(
      history,
      {
        type: 'duplicate-clip',
        clipId: clip.id,
        newClipId: 'copy',
        newTrackId: 'copy-lane',
      },
      { assets: [asset], now: TEST_NOW },
    )
    expect(duplicate.present.clips.at(-1)).toEqual({
      ...clip,
      id: 'copy',
      trackId: 'copy-lane',
      startFrame: 1100,
    })
    expect(duplicate.present.tracks[1]).toEqual({
      ...project.tracks[0],
      id: 'copy-lane',
      order: 1,
    })
    expect(duplicate.present.revision).toBe(1)
    const undone = undoStudioCommand(duplicate, {
      assets: [asset],
      now: TEST_NOW,
    })
    expect(undone.present.clips).toEqual(two.clips)
    expect(undone.present.tracks).toEqual(two.tracks)
    expect(undone.present.revision).toBe(2)
  })

  it('duplicates without extra lane or asset when the exact destination is free', () => {
    const { project, asset, clip } = studioFixture()
    const result = applyStudioCommand(
      project,
      {
        type: 'duplicate-clip',
        clipId: clip.id,
        newClipId: 'copy',
        newTrackId: 'unused',
      },
      { assets: [asset], now: TEST_NOW },
    )
    expect(result.tracks).toEqual(project.tracks)
    expect(result.clips[1]).toEqual({ ...clip, id: 'copy', startFrame: 1100 })
  })

  it('rejects invalid source bounds, split boundaries and missing sources without mutating the snapshot', () => {
    const { project, asset, clip } = studioFixture()
    const before = structuredClone(project)
    expect(() =>
      applyStudioCommand(
        project,
        { type: 'trim-tail', clipId: clip.id, sourceOutFrame: 1001 },
        { assets: [asset] },
      ),
    ).toThrow(/bounds/)
    expect(() =>
      applyStudioCommand(
        project,
        {
          type: 'split-clip',
          clipId: clip.id,
          atFrame: 100,
          newClipId: 'right',
        },
        { assets: [asset] },
      ),
    ).toThrow(/inside/)
    expect(() =>
      applyStudioCommand(
        project,
        { type: 'rename-project', title: 'Lost audio' },
        { assets: [] },
      ),
    ).toThrow(/missing/)
    expect(project).toEqual(before)
  })
})

describe('Studio clipboard and explicit lane placement', () => {
  it('pastes at a free touching edge without creating another lane or changing source audio', () => {
    const { project, clip, asset } = studioFixture()
    const next = applyStudioCommand(
      project,
      {
        type: 'paste-clip',
        clip,
        trackId: clip.trackId,
        startFrame: 1100,
        newClipId: 'pasted',
        newTrackId: 'unused',
      },
      { assets: [asset] },
    )
    expect(next.tracks).toEqual(project.tracks)
    expect(next.clips[1]).toEqual({ ...clip, id: 'pasted', startFrame: 1100 })
    expect(next.revision).toBe(1)
  })

  it('pastes a trimmed copy into an occupied destination with destination sound as one undo and redo', () => {
    const { project, clip, asset } = studioFixture()
    const destination = {
      ...createStudioTrack({
        id: 'voice-lane',
        name: 'Voice',
        order: 1,
        role: 'voice',
      }),
      gainDb: -8,
      pan: -0.3,
    }
    const initial = {
      ...project,
      tracks: [...project.tracks, destination],
      clips: [
        ...project.clips,
        { ...clip, id: 'occupied', trackId: destination.id },
      ],
    }
    const copy = { ...clip, sourceInFrame: 150, sourceOutFrame: 900 }
    const options = { assets: [asset], now: TEST_NOW }
    const history = executeStudioCommand(
      createStudioHistory(initial),
      {
        type: 'paste-clip',
        clip: copy,
        trackId: destination.id,
        startFrame: 100,
        newClipId: 'pasted',
        newTrackId: 'fallback',
      },
      options,
    )
    expect(history.present.tracks[2]).toEqual({
      ...destination,
      id: 'fallback',
      order: 2,
    })
    expect(history.present.clips[2]).toEqual({
      ...copy,
      id: 'pasted',
      trackId: 'fallback',
      startFrame: 100,
    })
    expect(history.past).toHaveLength(1)
    const undo = undoStudioCommand(history, options)
    expect(undo.present.clips).toEqual(initial.clips)
    expect(undo.present.tracks).toEqual(initial.tracks)
    const redo = redoStudioCommand(undo, options)
    expect(redo.present.clips).toEqual(history.present.clips)
    expect(redo.present.tracks).toEqual(history.present.tracks)
    expect(redo.present.revision).toBe(3)
    expect(asset.preparation.gainDb).toBe(3)
  })

  it('keeps a copied descriptor usable after its original clip is removed', () => {
    const { project, clip, asset } = studioFixture()
    const next = applyStudioCommand(
      { ...project, clips: [] },
      {
        type: 'paste-clip',
        clip,
        trackId: clip.trackId,
        startFrame: 700,
        newClipId: 'pasted',
        newTrackId: 'unused',
      },
      { assets: [asset] },
    )
    expect(next.clips).toEqual([{ ...clip, id: 'pasted', startFrame: 700 }])
  })

  it('rejects a foreign or malformed copied source without changing the current project', () => {
    const { project, clip, asset } = studioFixture()
    const before = structuredClone(project)
    for (const copied of [
      { ...clip, assetId: 'foreign' },
      { ...clip, sourceOutFrame: 2000 },
    ]) {
      expect(() =>
        applyStudioCommand(
          project,
          {
            type: 'paste-clip',
            clip: copied,
            trackId: clip.trackId,
            startFrame: 100,
            newClipId: 'pasted',
            newTrackId: 'fallback',
          },
          { assets: [asset] },
        ),
      ).toThrow()
    }
    expect(project).toEqual(before)
  })

  it('moves to an explicitly requested new lane in one revision and restores both on undo', () => {
    const { project, clip, asset } = studioFixture()
    const options = { assets: [asset] }
    const history = executeStudioCommand(
      createStudioHistory(project),
      {
        type: 'move-clip-to-new-track',
        clipId: clip.id,
        startFrame: 900,
        newTrackId: 'new-lane',
      },
      options,
    )
    expect(history.present.clips).toEqual([
      { ...clip, trackId: 'new-lane', startFrame: 900 },
    ])
    expect(history.present.tracks[1]).toEqual({
      ...project.tracks[0],
      id: 'new-lane',
      order: 1,
    })
    expect(history.present.revision).toBe(1)
    const undone = undoStudioCommand(history, options)
    expect(undone.present.clips).toEqual(project.clips)
    expect(undone.present.tracks).toEqual(project.tracks)
  })
})

describe('monotonic Studio undo history', () => {
  it('uses new revisions for undo/redo and invalidates redo after a new edit', () => {
    const { project, asset } = studioFixture()
    const options = { assets: [asset], now: TEST_NOW }
    const first = executeStudioCommand(
      createStudioHistory(project),
      { type: 'rename-project', title: 'A' },
      options,
    )
    const second = executeStudioCommand(
      first,
      { type: 'rename-project', title: 'B' },
      options,
    )
    const undo = undoStudioCommand(second, options)
    const redo = redoStudioCommand(undo, options)
    expect([
      first.present.revision,
      second.present.revision,
      undo.present.revision,
      redo.present.revision,
    ]).toEqual([1, 2, 3, 4])
    expect(undo.present.title).toBe('A')
    expect(redo.present.title).toBe('B')
    const changed = executeStudioCommand(
      undo,
      { type: 'rename-project', title: 'C' },
      options,
    )
    expect(changed.future).toEqual([])
    expect(redoStudioCommand(changed, options)).toBe(changed)
  })

  it('groups a gesture/batch into one revision and ignores a no-op', () => {
    const { project, asset, clip } = studioFixture()
    const options = { assets: [asset], now: TEST_NOW }
    const history = createStudioHistory(project)
    expect(
      executeStudioCommand(
        history,
        { type: 'rename-project', title: project.title },
        options,
      ),
    ).toBe(history)
    const changed = executeStudioCommand(
      history,
      {
        type: 'batch',
        commands: [
          { type: 'rename-project', title: 'Demo' },
          { type: 'set-clip-gain', clipId: clip.id, gainDb: -3 },
        ],
      },
      options,
    )
    expect(changed.present.revision).toBe(1)
    expect(changed.past).toHaveLength(1)
    expect(undoStudioCommand(changed, options).present.clips).toEqual(
      project.clips,
    )
  })
})
