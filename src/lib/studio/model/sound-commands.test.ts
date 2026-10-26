// Studio sound command tests — preset resolution, balance ownership and undo remain explicit.
import { describe, expect, it } from 'vitest'
import { defaultEffectParams } from '@/lib/studio-fx/chain-spec'
import { MIX_FLAVOURS } from '@/lib/studio-fx/mix-macros'
import { applyStudioCommand } from './commands'
import { createStudioHistory, executeStudioCommand, undoStudioCommand, } from './history'
import { studioFixture } from './model.test-fixtures'

describe('Studio sound commands', () => {
  it('treats empty measured balance as a no-op without a revision or undo entry', () => {
    const { project, asset } = studioFixture()
    const history = createStudioHistory(project)
    const next = executeStudioCommand(
      history,
      {
        type: 'apply-auto-balance',
        sourceRevision: project.revision,
        balanceGainDbByTrack: {},
      },
      { assets: [asset] },
    )
    expect(next).toBe(history)
    expect(next.present.revision).toBe(project.revision)
  })
  it('resolves each flavour from a complete base EQ and clears Lo-fi cuts when Natural returns', () => {
    const { project, asset } = studioFixture()
    const lofi = applyStudioCommand(
      project,
      { type: 'set-sound-flavour', flavourId: 'lofi' },
      { assets: [asset] },
    )
    expect(lofi.master.masterEq).toMatchObject({
      lowCutHz: 120,
      highCutHz: 6500,
    })
    const warm = applyStudioCommand(
      lofi,
      { type: 'set-sound-flavour', flavourId: 'warm' },
      { assets: [asset] },
    )
    expect(warm.master.masterEq).toEqual({
      ...defaultEffectParams('eq'),
      lowCutHz: 25,
    })
    expect(warm.mix.macros).toEqual(
      MIX_FLAVOURS.find((item) => item.id === 'warm')?.macros,
    )
    const natural = applyStudioCommand(
      warm,
      { type: 'set-sound-flavour', flavourId: 'natural' },
      { assets: [asset] },
    )
    expect(natural.mix).toEqual(project.mix)
    expect(natural.tracks).toEqual(project.tracks)
    expect(natural.master.masterEq).toEqual(project.master.masterEq)
    expect(natural.master.presetId).toBe(project.master.presetId)
  })

  it('persists macros with one undo and rejects non-finite values instead of silently clamping', () => {
    const { project, asset } = studioFixture()
    const history = executeStudioCommand(
      createStudioHistory(project),
      {
        type: 'set-sound-macros',
        macros: { ...project.mix.macros, space: 70, tone: -30 },
      },
      { assets: [asset] },
    )
    expect(history.past).toHaveLength(1)
    expect(history.present.revision).toBe(1)
    expect(history.present.mix.macros.space).toBe(70)
    expect(undoStudioCommand(history, { assets: [asset] }).present.mix).toEqual(
      project.mix,
    )
    expect(() =>
      applyStudioCommand(
        project,
        {
          type: 'set-sound-macros',
          macros: { ...project.mix.macros, tone: NaN },
        },
        { assets: [asset] },
      ),
    ).toThrow()
  })

  it('sets only a supported master target without losing flavour EQ or track settings', () => {
    const { project, asset } = studioFixture()
    const next = applyStudioCommand(
      project,
      { type: 'set-master-preset', presetId: 'loud' },
      { assets: [asset] },
    )
    expect(next.master).toMatchObject({
      presetId: 'loud',
      targetLufs: -11,
      maxLimitingDb: 8,
      ceilingDbtp: -1.5,
      masterEq: project.master.masterEq,
    })
    expect(next.tracks).toEqual(project.tracks)
    expect(() =>
      applyStudioCommand(
        project,
        { type: 'set-master-preset', presetId: 'off' },
        { assets: [asset] },
      ),
    ).toThrow('Unknown master preset')
  })

  it('applies balance once at its measured revision while preserving all user mix controls', () => {
    const { project, asset } = studioFixture()
    const changed = {
      ...project,
      tracks: [
        { ...project.tracks[0], gainDb: -8, pan: 0.3, mute: true, solo: true },
      ],
    }
    const history = executeStudioCommand(
      createStudioHistory(changed),
      {
        type: 'apply-auto-balance',
        sourceRevision: 0,
        balanceGainDbByTrack: { 'track-1': 4 },
      },
      { assets: [asset] },
    )
    expect(history.present.tracks[0]).toEqual({
      ...changed.tracks[0],
      balanceGainDb: 4,
    })
    expect(history.present.mix.autoBalanceRevision).toBe(
      history.present.revision,
    )
    expect(
      undoStudioCommand(history, { assets: [asset] }).present.tracks,
    ).toEqual(changed.tracks)
    expect(() =>
      applyStudioCommand(
        history.present,
        {
          type: 'apply-auto-balance',
          sourceRevision: 0,
          balanceGainDbByTrack: { 'track-1': 2 },
        },
        { assets: [asset] },
      ),
    ).toThrow('The song changed')
    expect(() =>
      applyStudioCommand(
        project,
        {
          type: 'apply-auto-balance',
          sourceRevision: 0,
          balanceGainDbByTrack: { unknown: 2 },
        },
        { assets: [asset] },
      ),
    ).toThrow('Lane does not exist')
  })
})
