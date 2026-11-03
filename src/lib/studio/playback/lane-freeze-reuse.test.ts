// Studio lane render reuse tests — a job holds a render only while it takes at most twice what its lane needs live.
import { describe, expect, it } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioAsset, StudioClip, StudioProject } from '../model/types'
import type { StudioFrozenLane } from './lane-freeze'
import { frozenLaneBytes } from './lane-freeze-plan'
import { liveLaneBytes, rendersWorthHolding } from './lane-freeze-reuse'

const SECOND = 48000
const MB = 1e6

/** A 5-minute song: one lane plays a 2 s take 150 times over, the other a 5-minute take once. */
function loopAndTake(): { project: StudioProject; assets: StudioAsset[] } {
  const { project, asset, clip } = studioFixture()
  const sized = (id: string, frames: number): StudioAsset => ({
    ...asset,
    id,
    normalizedFrameCount: frames,
    canonicalPcmByteLength: 32 + frames * 4,
  })
  const loop = sized('loop', 2 * SECOND)
  const take = sized('take', 300 * SECOND)
  const loops: StudioClip[] = Array.from({ length: 150 }, (_, index) => ({
    ...clip,
    id: `loop-${index}`,
    assetId: loop.id,
    startFrame: index * 2 * SECOND,
    sourceOutFrame: 2 * SECOND,
  }))
  const once: StudioClip = {
    ...clip,
    id: 'take-1',
    trackId: 'track-2',
    assetId: take.id,
    startFrame: 0,
    sourceOutFrame: 300 * SECOND,
  }
  return {
    project: {
      ...project,
      tracks: [
        ...project.tracks,
        createStudioTrack({ id: 'track-2', name: 'Voice', order: 1 }),
      ],
      clips: [...loops, once],
    },
    assets: [loop, take],
  }
}

/** A render of `trackId`'s lane as large as the freezer estimates it. */
function renderOf(
  project: StudioProject,
  assets: readonly StudioAsset[],
  trackId: string,
): StudioFrozenLane {
  const lane = compileStudioArrangement(project, assets).lanes.find(
    (planned) => planned.track.id === trackId,
  )!
  return {
    trackId,
    key: '',
    spec: '',
    chunks: [],
    bytes: frozenLaneBytes(lane),
  }
}

describe('Studio lane render reuse', () => {
  it('holds the render of a lane that plays its take once, not of one that repeats a short take across the song', () => {
    // Arrange
    const { project, assets } = loopAndTake()
    const lanes = compileStudioArrangement(project, assets).lanes
    const loop = renderOf(project, assets, 'track-1')
    const take = renderOf(project, assets, 'track-2')

    // Act
    const keep = rendersWorthHolding(project, assets)

    // Assert: both renders hold five minutes; live, the loop needs its 2 s.
    expect(loop.bytes).toBeGreaterThan(57 * MB)
    expect(take.bytes).toBeGreaterThan(57 * MB)
    expect(liveLaneBytes(lanes[0], assets)).toBeLessThan(loop.bytes / 4)
    expect(keep('track-1', loop)).toBe(false)
    expect(keep('track-2', take)).toBe(true)
  })

  it('holds nothing for a lane the song no longer has, or a song that does not compile', () => {
    const { project, assets } = loopAndTake()
    const take = renderOf(project, assets, 'track-2')

    expect(rendersWorthHolding(project, assets)('track-9', take)).toBe(false)
    expect(rendersWorthHolding(project, [])('track-2', take)).toBe(false)
  })
})
