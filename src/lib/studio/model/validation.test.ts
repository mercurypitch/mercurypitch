import { describe, expect, it } from 'vitest'
import { createStudioProject, createStudioTrack, summarizeStudioProject, } from './defaults'
import { studioFixture, TEST_NOW } from './model.test-fixtures'
import { validateStudioAsset, validateStudioProject } from './validation'

describe('strict Studio persistence validation', () => {
  it('retains a valid owned project and returns an independent snapshot', () => {
    const { project, asset } = studioFixture()
    const result = validateStudioProject(project, [asset])
    expect(result).toEqual(project)
    expect(result.tracks[0]).not.toBe(project.tracks[0])
    expect(summarizeStudioProject(result)).toMatchObject({
      revision: 0,
      trackCount: 1,
      clipCount: 1,
      durationFrames: 1100,
    })
    expect(validateStudioAsset(asset).provenance.sourceId).toBe(
      'guitar-take:kept-1',
    )
  })

  it('rejects unknown schema, engine, properties and source ownership instead of normalizing them', () => {
    const { project, asset } = studioFixture()
    expect(() =>
      validateStudioProject({ ...project, schemaVersion: 2 }, [asset]),
    ).toThrow(/version/)
    expect(() =>
      validateStudioProject(
        {
          ...project,
          master: { ...project.master, engineVersion: 'future-engine' },
        },
        [asset],
      ),
    ).toThrow(/version/)
    expect(() =>
      validateStudioProject({ ...project, cloudId: 'private' }, [asset]),
    ).toThrow(/Unknown field/)
    expect(() =>
      validateStudioProject(project, [{ ...asset, projectId: 'another' }]),
    ).toThrow(/another project/)
    expect(() => validateStudioProject(project, [])).toThrow(/missing/)
  })

  it('rejects unsupported effects, missing parameters and non-unity lane normalization', () => {
    const { project, asset } = studioFixture()
    const track = project.tracks[0]
    const withChain = (baseSpec: unknown) => ({
      ...project,
      tracks: [{ ...track, fx: { ...track.fx, baseSpec } }],
    })
    expect(() =>
      validateStudioProject(withChain({ version: 2, effects: [] }), [asset]),
    ).toThrow(/version/)
    expect(() =>
      validateStudioProject(
        withChain({
          version: 1,
          effects: [
            {
              id: 'foreign',
              kind: 'unknown-plugin',
              enabled: true,
              params: {},
            },
          ],
        }),
        [asset],
      ),
    ).toThrow(/version/)
    expect(() =>
      validateStudioProject(
        withChain({
          version: 1,
          effects: [
            {
              id: 'level-match',
              kind: 'gain',
              enabled: true,
              params: { gainDb: 3 },
            },
          ],
        }),
        [asset],
      ),
    ).toThrow(/outside the lane/)
    expect(() =>
      validateStudioProject(
        withChain({
          version: 1,
          effects: [{ id: 'gain', kind: 'gain', enabled: true, params: {} }],
        }),
        [asset],
      ),
    ).toThrow(/Required/)
    expect(() =>
      validateStudioProject(
        withChain({
          version: 1,
          effects: [
            {
              id: 'gain',
              kind: 'gain',
              enabled: true,
              params: { gainDb: 100 },
            },
          ],
        }),
        [asset],
      ),
    ).toThrow(/finite number/)
  })

  it('accepts source-anchored ramps outside a split fragment but rejects outside-asset and overlapping ramps', () => {
    const { project, asset, clip } = studioFixture()
    const fragment = { ...clip, sourceOutFrame: 100 }
    expect(
      validateStudioProject({ ...project, clips: [fragment] }, [asset]).clips[0]
        .fades,
    ).toEqual(clip.fades)
    expect(() =>
      validateStudioProject(
        {
          ...project,
          clips: [
            {
              ...clip,
              fades: {
                ...clip.fades,
                out: { fromSourceFrame: 800, toSourceFrame: 1001 },
              },
            },
          ],
        },
        [asset],
      ),
    ).toThrow(/exceeds owned/)
    expect(() =>
      validateStudioProject(
        {
          ...project,
          clips: [
            {
              ...clip,
              fades: {
                ...clip.fades,
                out: { fromSourceFrame: 199, toSourceFrame: 1000 },
              },
            },
          ],
        },
        [asset],
      ),
    ).toThrow(/overlap/)
  })

  it('rejects nonfinite or fractional frames, duplicate identities and missing lanes', () => {
    const { project, asset, clip } = studioFixture()
    for (const startFrame of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER])
      expect(() =>
        validateStudioProject(
          { ...project, clips: [{ ...clip, startFrame }] },
          [asset],
        ),
      ).toThrow()
    expect(() =>
      validateStudioProject(
        { ...project, clips: [clip, { ...clip, startFrame: 2000 }] },
        [asset],
      ),
    ).toThrow(/Duplicate/)
    expect(() =>
      validateStudioProject(
        { ...project, clips: [{ ...clip, trackId: 'missing' }] },
        [asset],
      ),
    ).toThrow(/Lane/)
  })

  it('requires canonical asset metadata and rejects hidden practice context', () => {
    const { asset } = studioFixture()
    expect(() =>
      validateStudioAsset({ ...asset, normalizedSampleRate: 24000 }),
    ).toThrow(/version/)
    expect(() =>
      validateStudioAsset({ ...asset, canonicalPcmByteLength: 2 }),
    ).toThrow(/payload/)
    expect(() =>
      validateStudioAsset({
        ...asset,
        preparation: { ...asset.preparation, gainDb: 37 },
      }),
    ).toThrow(/finite/)
    expect(() =>
      validateStudioAsset({
        ...asset,
        provenance: { ...asset.provenance, score: 99 },
      }),
    ).toThrow(/Unknown field/)
  })
})

describe('Studio defaults', () => {
  it('starts revision zero with explicit resolved master settings', () => {
    expect(
      createStudioProject({ id: 'new-project', now: new Date(TEST_NOW) }),
    ).toMatchObject({
      revision: 0,
      createdAt: TEST_NOW,
      sampleRate: 48000,
      tracks: [],
      clips: [],
      master: {
        targetLufs: -14,
        ceilingDbtp: -1.5,
        maxLimitingDb: 5,
        masterEq: {
          lowCutHz: 25,
          lowShelfHz: 120,
          lowShelfDb: 0,
          lowMidHz: 400,
          lowMidDb: 0,
          lowMidQ: 1,
          highMidHz: 3000,
          highMidDb: 0,
          highMidQ: 1,
          highShelfHz: 10000,
          highShelfDb: 0,
          highCutHz: 20000,
        },
      },
    })
  })

  it('rejects unresolved master EQ settings instead of using future defaults', () => {
    const project = createStudioProject({ id: 'new-project', now: TEST_NOW })
    expect(() =>
      validateStudioProject({
        ...project,
        master: { ...project.master, masterEq: {} },
      }),
    ).toThrow(/masterEq/)
    const partial = { ...project.master.masterEq }
    delete partial.highShelfHz
    expect(() =>
      validateStudioProject({
        ...project,
        master: { ...project.master, masterEq: partial },
      }),
    ).toThrow(/highShelfHz/)
  })

  it('keeps source preparation, role balance and user fader independent', () => {
    const track = createStudioTrack({
      id: 'piano',
      name: 'Piano',
      order: 0,
      role: 'piano',
    })
    expect(track).toMatchObject({ gainDb: 0, balanceGainDb: -6 })
    expect(
      track.fx.baseSpec.effects.find((effect) => effect.id === 'level-match')
        ?.params,
    ).toEqual({ gainDb: 0 })
    expect(
      track.fx.baseSpec.effects.find((effect) => effect.id === 'balance')
        ?.params,
    ).toEqual({ gainDb: 0 })
  })
})
