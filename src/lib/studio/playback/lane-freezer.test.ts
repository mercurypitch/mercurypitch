// Studio lane freezer — renders a heavy song's lanes, lends them to runs, and lets an edited lane wait.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setStudioWorkingBytes, studioReservedMemoryBytes, } from '../memory-budget'
import type { StudioPlannedLane } from '../model/arrangement-plan'
import { createStudioTrack } from '../model/defaults'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioProject } from '../model/types'
import type { StudioBufferCache } from './buffer-cache'
import { encodeFrozenLane } from './lane-freeze'
import type { StudioLaneRenderOptions } from './lane-freeze-render'
import { createStudioLaneFreezer, FREEZE_SETTLE_MS, laneFreezeStatus, } from './lane-freezer'

function song() {
  const fixture = studioFixture()
  const tracks = ['track-2', 'track-3'].map((id, index) =>
    createStudioTrack({ id, name: id, order: index + 1, role: 'voice' }),
  )
  const project: StudioProject = {
    ...fixture.project,
    tracks: [...fixture.project.tracks, ...tracks],
    clips: [
      fixture.clip,
      ...tracks.map((track, index) => ({
        ...fixture.clip,
        id: `clip-${index + 2}`,
        trackId: track.id,
      })),
    ],
  }
  return { project, assets: [fixture.asset] }
}

function fakeCache(): StudioBufferCache {
  return {
    acquire: () => Promise.resolve({ buffers: new Map(), release: () => {} }),
    clear: () => {},
    dispose: () => {},
  } as unknown as StudioBufferCache
}

function freezerFor(clock: { now: number }, changed = vi.fn()) {
  const render = vi.fn(
    (
      lane: StudioPlannedLane,
      _buffers: ReadonlyMap<string, AudioBuffer>,
      options: StudioLaneRenderOptions,
    ) => {
      const audio = Float32Array.from({ length: 4800 }, () => 0.5)
      return Promise.resolve(
        encodeFrozenLane(
          {
            trackId: lane.track.id,
            key: options.key,
            spec: JSON.stringify(lane.spec),
          },
          [audio, audio],
          0,
        ),
      )
    },
  )
  const freezer = createStudioLaneFreezer({
    readCanonicalAsset: () => Promise.reject(new Error('unused')),
    changed,
    render,
    measure: () => Promise.resolve([0]),
    createCache: fakeCache,
    decodeContext: () => ({}) as BaseAudioContext,
    // A device so slow that no lane fits live.
    voiceChainUs: () => 3000,
    choice: () => 'auto',
    now: () => clock.now,
  })
  return { freezer, render, changed }
}

describe('Studio lane freezer', () => {
  beforeEach(() => setStudioWorkingBytes(1024 * 1024 * 1024))
  afterEach(() => setStudioWorkingBytes(null))

  it('renders a song too heavy to play live and lends the renders to a run', async () => {
    const { project, assets } = song()
    const clock = { now: 0 }
    const { freezer, render, changed } = freezerFor(clock)
    const before = studioReservedMemoryBytes()
    freezer.update(project, assets)
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(3))
    await vi.waitFor(() => expect(laneFreezeStatus().rendering).toBe(false))
    expect(laneFreezeStatus()).toMatchObject({ wanted: 3, ready: 3 })
    expect(changed).toHaveBeenCalled()
    expect(studioReservedMemoryBytes()).toBeGreaterThan(before)

    const held = freezer.hold(project, assets)!
    expect([...held.lanes.keys()].sort()).toEqual([
      'track-1',
      'track-2',
      'track-3',
    ])
    expect(freezer.differs(project, assets, held.lanes)).toBe(false)
    expect(freezer.differs(project, assets, new Map())).toBe(true)
    held.release()
    freezer.dispose()
    expect(studioReservedMemoryBytes()).toBe(before)
  })

  it('lets an edited lane go once no run holds it, and renders it again only once it is left alone', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { project, assets } = song()
      const clock = { now: 0 }
      const { freezer, render } = freezerFor(clock)
      freezer.update(project, assets)
      await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(3))
      await vi.waitFor(() => expect(laneFreezeStatus().ready).toBe(3))
      const held = freezer.hold(project, assets)!

      // Trim the first lane's clip: its render no longer matches.
      clock.now = 10_000
      const edited = {
        ...project,
        revision: project.revision + 1,
        clips: project.clips.map((clip) =>
          clip.id === 'clip-1' ? { ...clip, sourceOutFrame: 900 } : clip,
        ),
      }
      freezer.update(edited, assets)
      expect(freezer.hold(edited, assets)?.lanes.has('track-1')).toBe(false)
      expect(freezer.differs(edited, assets, held.lanes)).toBe(true)
      // The run playing still holds the old render until it is released.
      expect(held.lanes.get('track-1')?.chunks.length).toBeGreaterThan(0)
      held.release()
      expect(render).toHaveBeenCalledTimes(3)

      clock.now += FREEZE_SETTLE_MS
      await vi.advanceTimersByTimeAsync(FREEZE_SETTLE_MS)
      await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(4))
      expect(render.mock.calls[3][0].track.id).toBe('track-1')
      freezer.dispose()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops rendering when the memory budget refuses a render', async () => {
    const { project, assets } = song()
    // Room for a render's working memory, not for what it keeps as well.
    setStudioWorkingBytes(4 * 1024 * 1024)
    const { freezer, render } = freezerFor({ now: 0 })
    freezer.update(project, assets)
    await vi.waitFor(() => expect(laneFreezeStatus().rendering).toBe(false))
    expect(render.mock.calls.length).toBeLessThanOrEqual(2)
    expect(freezer.hold(project, assets)).toBeNull()
    // The panel says no more renders are coming, not that they are on the way.
    expect(laneFreezeStatus().wanted).toBe(laneFreezeStatus().ready)
    freezer.dispose()
  })
})
