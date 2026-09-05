// ============================================================
// The sing driver's lifecycle around a slow permission prompt: a
// stop() that lands while start() is still waiting must not leave
// a stream, a worker or a share of the audio lease behind, and a
// start() that fails gives back what it took.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const f0 = {
    startTask: vi.fn(),
    dispose: vi.fn(),
    latestSmoothed: vi.fn(() => null),
  }
  return {
    f0,
    acquire: vi.fn<(id: string) => Promise<MediaStream>>(),
    release: vi.fn<(id: string) => void>(),
    createF0Stream: vi.fn((_ctx: AudioContext, _stream: MediaStream) => f0),
    lease: {
      ensure: vi.fn<() => AudioContext | null>(
        () => ({ currentTime: 1 }) as unknown as AudioContext,
      ),
      unlock: vi.fn(async () => true),
      peek: vi.fn(() => null),
      release: vi.fn(),
    },
  }
})

vi.mock('@irchiinnuss/pitch-engine', () => ({
  CONF_MIN: 0.5,
  hzToCents: (hz: number) => hz,
  createF0Stream: (ctx: AudioContext, stream: MediaStream) =>
    mocks.createF0Stream(ctx, stream),
  micManager: {
    acquire: (id: string) => mocks.acquire(id),
    release: (id: string) => mocks.release(id),
  },
}))
vi.mock('@/audio/shared-audio-context', () => ({
  acquireSharedAudioContext: () => mocks.lease,
}))

import { createSingDriver } from './sing'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSingDriver', () => {
  it('runs the stream after a normal start and tears it down once', async () => {
    mocks.acquire.mockResolvedValue({} as MediaStream)
    const driver = createSingDriver('mic')
    await driver.start()
    expect(mocks.createF0Stream).toHaveBeenCalledTimes(1)
    expect(mocks.f0.startTask).toHaveBeenCalledTimes(1)
    driver.stop()
    expect(mocks.f0.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith('mic')
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('a stop() during the permission prompt hands the stream back', async () => {
    let grant!: (stream: MediaStream) => void
    mocks.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const driver = createSingDriver('mic')
    const started = driver.start()
    driver.stop()
    grant({} as MediaStream)
    await started
    // No stream wired up for nobody to stop; the mic reference start()
    // was given goes straight back.
    expect(mocks.createF0Stream).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenLastCalledWith('mic')
    expect(mocks.release).toHaveBeenCalledTimes(2)
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('a start() that fails gives the mic and the lease back', async () => {
    mocks.acquire.mockRejectedValue(new Error('denied'))
    const driver = createSingDriver('mic')
    await expect(driver.start()).rejects.toThrow('denied')
    // The stage drops a driver that never came up without calling stop().
    expect(mocks.release).toHaveBeenCalledWith('mic')
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('no Web Audio: the lease goes back with the error', async () => {
    mocks.lease.ensure.mockReturnValueOnce(null)
    const driver = createSingDriver('mic')
    await expect(driver.start()).rejects.toThrow(/no Web Audio/)
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })
})
