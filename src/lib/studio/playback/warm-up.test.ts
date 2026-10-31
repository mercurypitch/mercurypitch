// Studio playback warm-up tests — chains measured for the rate Play will use, before its clock exists.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileStudioArrangement } from '../model/arrangement-plan'
import { studioFixture } from '../model/model.test-fixtures'
import type { StudioBufferCache } from './buffer-cache'
import { encodeFrozenLane, laneFreezeKey } from './lane-freeze'
import { warmStudioPlayback } from './warm-up'

afterEach(() => vi.unstubAllGlobals())

/** A warm-up before the first press: no clock yet, perhaps a lease that knows its rate. */
function beforeThePress(sampleRate?: number) {
  // Buffers are made on an offline context until a live one exists.
  vi.stubGlobal(
    'OfflineAudioContext',
    class {
      readonly sampleRate = 48000
    },
  )
  const release = vi.fn()
  return {
    lease: {
      ensure: () => null,
      unlock: vi.fn().mockResolvedValue(false),
      sampleRate,
    },
    cache: {
      acquire: vi.fn().mockResolvedValue({ buffers: new Map(), release }),
    } as unknown as StudioBufferCache,
    measureLatencies: vi.fn().mockResolvedValue([0]),
    readCanonicalAsset: vi.fn(),
    busy: () => false,
  }
}

function measuredRates(options: ReturnType<typeof beforeThePress>) {
  return new Set(options.measureLatencies.mock.calls.map(([, rate]) => rate))
}

describe('Studio playback warm-up', () => {
  it('measures the chains for the rate its lease will play at, before that clock exists', async () => {
    const { project, asset } = studioFixture()
    const options = beforeThePress(48000)
    await warmStudioPlayback(
      project,
      [asset],
      new AbortController().signal,
      options,
    )
    expect(measuredRates(options)).toEqual(new Set([48000]))
    expect(options.cache.acquire).toHaveBeenCalledOnce()
  })

  it('measures them for both common device rates when nothing says which', async () => {
    const { project, asset } = studioFixture()
    const options = beforeThePress()
    await warmStudioPlayback(
      project,
      [asset],
      new AbortController().signal,
      options,
    )
    expect(measuredRates(options)).toEqual(new Set([48000, 44100]))
  })

  it('holds the lanes rendered ahead while it reads, and reads none of their clips', async () => {
    const { project, asset } = studioFixture()
    const options = beforeThePress(48000)
    const [lane] = compileStudioArrangement(project, [asset]).lanes
    const audio = new Float32Array(4800).fill(0.25)
    const frozen = encodeFrozenLane(
      {
        trackId: lane.track.id,
        key: laneFreezeKey(lane),
        spec: JSON.stringify(lane.spec),
      },
      [audio, audio],
      lane.segments[0].startFrame,
    )
    const release = vi.fn()
    const hold = vi.fn(() => ({
      lanes: new Map([[lane.track.id, frozen]]),
      release,
    }))
    await warmStudioPlayback(project, [asset], new AbortController().signal, {
      ...options,
      freezes: { hold, differs: () => false },
    })
    expect(hold).toHaveBeenCalledOnce()
    // The only lane plays its render: none of its clips' audio is read.
    expect(options.cache.acquire).toHaveBeenCalledOnce()
    expect(vi.mocked(options.cache.acquire).mock.calls[0][0]).toEqual([])
    expect(release).toHaveBeenCalledOnce()
  })
})
