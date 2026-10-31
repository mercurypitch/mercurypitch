// Studio lane freeze — chunks round-trip within 16-bit precision, line up on the timeline and play at unity.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import { studioFixture } from '../model/model.test-fixtures'
import { studioSegmentGain } from './edge-envelope'
import type { StudioFrozenLane } from './lane-freeze'
import { decodeFrozenChunk, encodeFrozenLane, FREEZE_CHUNK_FRAMES, FREEZE_JOIN_FRAMES, FREEZE_OVERLAP_FRAMES, freezesOutdated, freezeStudioPlan, frozenSegments, frozenSoundChanged, laneFreezeKey, StudioFrozenBuffers, } from './lane-freeze'

/** Enough of a context to make buffers: createBuffer and getChannelData. */
function bufferContext() {
  let made = 0
  const ctx = {
    createBuffer(channels: number, length: number, sampleRate: number) {
      made++
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length),
      )
      return {
        numberOfChannels: channels,
        length,
        sampleRate,
        getChannelData: (channel: number) => data[channel],
      } as unknown as AudioBuffer
    },
  } as unknown as BaseAudioContext
  return { ctx, made: () => made }
}

function tone(length: number, amplitude: number, phase = 0): Float32Array {
  return Float32Array.from(
    { length },
    (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / 48000 + phase),
  )
}

const LANE = { trackId: 'track-1', key: 'k', spec: '{}' }

describe('Studio lane freeze chunks', () => {
  it('round-trips a render within one step of its 16-bit scale and leaves silence out', () => {
    const length = FREEZE_CHUNK_FRAMES * 2 + 5000
    const left = tone(length, 1.7)
    const right = tone(length, 0.25, 1)
    // The second chunk is silent: nothing is kept for it.
    left.fill(0, FREEZE_CHUNK_FRAMES, FREEZE_CHUNK_FRAMES * 2 + 10)
    right.fill(0, FREEZE_CHUNK_FRAMES, FREEZE_CHUNK_FRAMES * 2 + 10)
    const frozen = encodeFrozenLane(LANE, [left, right], 4800)
    expect(frozen.chunks.map((chunk) => chunk.startFrame)).toEqual([
      4800,
      4800 + FREEZE_CHUNK_FRAMES * 2,
    ])
    expect(frozen.chunks.map((chunk) => chunk.frames)).toEqual([
      FREEZE_CHUNK_FRAMES,
      5000,
    ])
    const { ctx } = bufferContext()
    let worst = 0
    const overlap = FREEZE_OVERLAP_FRAMES
    for (const chunk of frozen.chunks) {
      const buffer = decodeFrozenChunk(ctx, chunk)
      expect(buffer.length).toBe(chunk.frames + 2 * overlap)
      const at = chunk.startFrame - 4800
      for (const [channel, source] of [left, right].entries()) {
        const out = buffer.getChannelData(channel)
        for (let i = 0; i < chunk.frames; i++) {
          const error = Math.abs(out[overlap + i] - source[at + i])
          worst = Math.max(worst, error / chunk.scales[channel])
        }
      }
    }
    // Rounding to the nearest step: never more than half of one.
    expect(worst).toBeLessThanOrEqual(0.5 + 1e-6)
    // Above full scale, as a chain's output may be, it neither clips nor wraps.
    expect(frozen.chunks[0].scales[0] * 32767).toBeGreaterThan(1.69)
  })

  it('holds its neighbours’ edges, so adjacent chunks can cross over', () => {
    const length = FREEZE_CHUNK_FRAMES * 2
    // Off zero at the join: 440 Hz with no phase crosses zero on every chunk edge.
    const left = tone(length, 0.5, 0.3)
    const frozen = encodeFrozenLane(LANE, [left, left], 0)
    const { ctx } = bufferContext()
    const overlap = FREEZE_OVERLAP_FRAMES
    const [first, second] = frozen.chunks.map((chunk) =>
      decodeFrozenChunk(ctx, chunk).getChannelData(0),
    )
    for (let j = -overlap; j < overlap; j++) {
      const frame = FREEZE_CHUNK_FRAMES + j
      expect(first[overlap + frame]).toBeCloseTo(left[frame], 4)
      expect(second[overlap + j]).toBeCloseTo(left[frame], 4)
    }
    // The first chunk's lead is the silence before the render.
    expect(first[0]).toBe(0)
  })

  it('plays each chunk at unity, and two that meet sum to unity on every frame of their crossover', () => {
    const length = FREEZE_CHUNK_FRAMES * 3
    const frozen = encodeFrozenLane(
      LANE,
      [tone(length, 0.5), tone(length, 0.5)],
      1000,
    )
    const segments = frozenSegments(frozen, 0)
    expect(segments).toHaveLength(3)
    const gainAt = (frame: number) =>
      segments
        .filter(
          (segment) =>
            segment.startFrame <= frame &&
            frame <
              segment.startFrame +
                segment.sourceOutFrame -
                segment.sourceInFrame,
        )
        .reduce((sum, segment) => sum + studioSegmentGain(segment, frame), 0)
    const join = 1000 + FREEZE_CHUNK_FRAMES
    for (
      let frame = join - FREEZE_JOIN_FRAMES;
      frame < join + FREEZE_JOIN_FRAMES;
      frame++
    )
      expect(gainAt(frame)).toBeCloseTo(1, 12)
    for (const frame of [1000, 1001, 5000, join + 500, 1000 + length - 1])
      expect(gainAt(frame)).toBe(1)
    // The first chunk starts on the render's first frame; the last ends on its last.
    expect(segments[0].startFrame).toBe(1000)
    const last = segments[2]
    expect(last.startFrame + last.sourceOutFrame - last.sourceInFrame).toBe(
      1000 + length,
    )
  })

  it('plays from the plan start part-way into a chunk', () => {
    const length = FREEZE_CHUNK_FRAMES * 3
    const frozen = encodeFrozenLane(
      LANE,
      [tone(length, 0.5), tone(length, 0.5)],
      1000,
    )
    const from = 1000 + FREEZE_CHUNK_FRAMES + 777
    const segments = frozenSegments(frozen, from)
    expect(segments).toHaveLength(2)
    expect(segments[0]).toMatchObject({
      startFrame: from,
      sourceInFrame: FREEZE_OVERLAP_FRAMES + 777,
    })
  })
})

describe('Studio frozen plan and audio', () => {
  function song() {
    const fixture = studioFixture()
    const second = createStudioTrack({
      id: 'track-2',
      name: 'Bass',
      order: 1,
      role: 'bass',
    })
    const project = {
      ...fixture.project,
      tracks: [...fixture.project.tracks, second],
      clips: [
        ...fixture.project.clips,
        { ...fixture.clip, id: 'clip-2', trackId: 'track-2', startFrame: 500 },
      ],
    }
    return { project, assets: [fixture.asset] }
  }

  function frozenFor(trackId: string, key: string): StudioFrozenLane {
    return encodeFrozenLane(
      { trackId, key, spec: '{}' },
      [tone(3000, 0.5), tone(3000, 0.5)],
      100,
    )
  }

  it('plays a frozen lane through no chain and leaves the others as planned', () => {
    const { project, assets } = song()
    const plan = compileStudioArrangement(project, assets)
    const frozen = frozenFor('track-1', laneFreezeKey(plan.lanes[0]))
    const next = freezeStudioPlan(plan, new Map([['track-1', frozen]]))
    expect(next.lanes[0].spec.effects).toEqual([])
    expect(next.lanes[0].frozen).toBe(true)
    expect(next.lanes[0].segments.map((segment) => segment.assetId)).toEqual(
      frozen.chunks.map((chunk) => chunk.id),
    )
    expect(next.lanes[1]).toBe(plan.lanes[1])
    expect(next.tailFrames).toBe(plan.tailFrames)
  })

  it('makes a chunk’s buffer only when it is asked for, and lists only the clips’ buffers', () => {
    const base = new Map([['asset-1', {} as AudioBuffer]])
    const frozen = frozenFor('track-1', 'k')
    const { ctx, made } = bufferContext()
    const buffers = new StudioFrozenBuffers(ctx, base, [frozen])
    expect(made()).toBe(0)
    const id = frozen.chunks[0].id
    expect(buffers.has(id)).toBe(true)
    expect(buffers.has('asset-1')).toBe(true)
    expect(buffers.get(id)?.length).toBe(3000 + 2 * FREEZE_OVERLAP_FRAMES)
    expect(buffers.get(id)).toBe(buffers.get(id))
    expect(made()).toBe(1)
    expect([...buffers.keys()]).toEqual(['asset-1'])
    expect(buffers.size).toBe(1)
  })

  it('outdates a render when its lane’s clips or sound change, not when another lane’s do', () => {
    const { project, assets } = song()
    const plan = compileStudioArrangement(project, assets)
    const key = laneFreezeKey(plan.lanes[0])
    const frozen = new Map([
      [
        'track-1',
        {
          ...frozenFor('track-1', key),
          spec: JSON.stringify(plan.lanes[0].spec),
        },
      ],
    ])
    expect(freezesOutdated(frozen, project, assets)).toBe(false)
    const otherMoved = {
      ...project,
      clips: project.clips.map((clip) =>
        clip.id === 'clip-2' ? { ...clip, startFrame: 900 } : clip,
      ),
    }
    expect(freezesOutdated(frozen, otherMoved, assets)).toBe(false)
    const moved = {
      ...project,
      clips: project.clips.map((clip) =>
        clip.id === 'clip-1' ? { ...clip, startFrame: 150 } : clip,
      ),
    }
    expect(freezesOutdated(frozen, moved, assets)).toBe(true)
    const warmer = {
      ...project,
      mix: {
        ...project.mix,
        macros: {
          ...project.mix.macros,
          space: Math.min(1, project.mix.macros.space + 0.25),
        },
      },
    }
    expect(frozenSoundChanged(frozen, project)).toBe(false)
    expect(frozenSoundChanged(frozen, warmer)).toBe(true)
    expect(freezesOutdated(frozen, warmer, assets)).toBe(true)
  })
})
