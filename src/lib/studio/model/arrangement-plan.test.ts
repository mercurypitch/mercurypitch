import { describe, expect, it } from 'vitest'
import { normalizeChainSpec } from '@/lib/studio-fx/chain-spec'
import { compileStudioArrangement, studioPanGains } from './arrangement-plan'
import { studioFixture } from './model.test-fixtures'

describe('shared Studio arrangement plan', () => {
  it('plays and exports a lane without its role safety limiter, which stays saved', () => {
    const { project, asset } = studioFixture()
    const baseSpec = normalizeChainSpec({
      effects: [
        { id: 'character', kind: 'compressor' },
        { id: 'safety', kind: 'limiter' },
        { id: 'tone', kind: 'tilt' },
      ],
    })
    const track = {
      ...project.tracks[0],
      fx: { ...project.tracks[0].fx, baseSpec },
    }
    const plan = compileStudioArrangement({ ...project, tracks: [track] }, [
      asset,
    ])
    expect(plan.lanes[0].spec.effects.map((effect) => effect.id)).toEqual([
      'character',
      'tone',
    ])
    expect(track.fx.baseSpec.effects).toHaveLength(3)
  })

  it('converts actual-context latency to seconds and preserves the 48 kHz project timebase', () => {
    const { project, asset, clip } = studioFixture()
    const two = {
      ...project,
      tracks: [
        ...project.tracks,
        { ...project.tracks[0], id: 'fast', order: 1 },
      ],
      clips: [clip, { ...clip, id: 'clip-2', trackId: 'fast' }],
    }
    const plan = compileStudioArrangement(two, [asset], {
      latencies: {
        sampleRate: 44100,
        framesByTrack: { 'track-1': 441, fast: 0 },
      },
    })
    expect(plan.sampleRate).toBe(48000)
    expect(plan.lanes.map((lane) => lane.compensationSeconds)).toEqual([
      0, 0.01,
    ])
    expect(plan.lanes[0].chainLatencySeconds).toBe(0.01)
    expect(plan.lanes[0].segments[0].startFrame).toBe(100)
  })

  it('marks latency unmeasured and rejects incomplete measured latency data', () => {
    const { project, asset } = studioFixture()
    expect(
      compileStudioArrangement(project, [asset]).lanes[0].compensationSeconds,
    ).toBeNull()
    expect(() =>
      compileStudioArrangement(project, [asset], {
        latencies: { sampleRate: 48000, framesByTrack: {} },
      }),
    ).toThrow()
  })

  it('clips a seek/range against source coordinates without restarting fades', () => {
    const { project, asset, clip } = studioFixture()
    const plan = compileStudioArrangement(project, [asset], {
      startFrame: 200,
      endFrame: 1000,
    })
    expect(plan.lanes[0].segments[0]).toMatchObject({
      startFrame: 200,
      sourceInFrame: 100,
      sourceOutFrame: 900,
      fades: clip.fades,
      preparationGainDb: 3,
    })
    expect(plan.endFrame).toBe(1000)
    expect(plan.tailFrames).toBeGreaterThan(0)
  })

  it('shares mute/solo semantics and does not coalesce changed fades or gain', () => {
    const { project, asset, clip } = studioFixture()
    const two = {
      ...project,
      tracks: [
        { ...project.tracks[0], solo: true, mute: true },
        { ...project.tracks[0], id: 'other', order: 1 },
      ],
      clips: [clip],
    }
    const plan = compileStudioArrangement(two, [asset])
    expect(plan.lanes.map((lane) => lane.audible)).toEqual([false, false])
    expect(plan.tailFrames).toBe(0)
    const split = {
      ...project,
      clips: [
        { ...clip, sourceOutFrame: 500 },
        {
          ...clip,
          id: 'next',
          startFrame: 600,
          sourceInFrame: 500,
          gainDb: -3,
        },
      ],
    }
    expect(
      compileStudioArrangement(split, [asset]).lanes[0].segments,
    ).toHaveLength(2)
  })

  it('uses stored per-source preparation and separate lane gain for quiet and loud sources', () => {
    const { project, asset, clip } = studioFixture()
    const loud = {
      ...asset,
      id: 'loud',
      preparation: { ...asset.preparation, gainDb: -9 },
    }
    const two = {
      ...project,
      clips: [
        clip,
        { ...clip, id: 'second', assetId: loud.id, startFrame: 1100 },
      ],
    }
    const plan = compileStudioArrangement(two, [asset, loud])
    expect(
      plan.lanes[0].segments.map((segment) => segment.preparationGainDb),
    ).toEqual([3, -9])
    expect(plan.lanes[0].track.balanceGainDb).toBe(-6)
    expect(plan.lanes[0].track.gainDb).toBe(0)
    expect(
      plan.lanes[0].spec.effects.find((effect) => effect.id === 'level-match')
        ?.params,
    ).toEqual({ gainDb: 0 })
  })

  it('has explicit centre and edge pan gains with no centre gain change', () => {
    expect(studioPanGains(0)).toEqual([1, 1])
    expect(studioPanGains(-1)).toEqual([1, 0])
    expect(studioPanGains(1)).toEqual([0, 1])
    expect(studioPanGains(0.5)[0]).toBeCloseTo(Math.SQRT1_2)
    expect(() => studioPanGains(NaN)).toThrow()
  })
})
