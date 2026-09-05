// ============================================================
// The sing driver's lifecycle around a slow permission prompt: a
// stop() that lands while start() is still waiting must not leave
// a stream, a worker or a share of the audio lease behind; a start()
// that fails gives back what it took; and every driver holds the
// microphone under its own consumer id, released exactly once, so a
// late release never touches the driver that replaced it.
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

const consumerOf = (call: number): string =>
  mocks.acquire.mock.calls[call]?.[0] ?? ''

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
    driver.stop()
    expect(mocks.f0.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith(consumerOf(0))
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('holds the mic under a consumer id of its own', async () => {
    mocks.acquire.mockResolvedValue({} as MediaStream)
    const first = createSingDriver('mic')
    const second = createSingDriver('mic')
    await first.start()
    await second.start()
    expect(consumerOf(0)).toMatch(/^mic#/u)
    expect(consumerOf(1)).toMatch(/^mic#/u)
    expect(consumerOf(0)).not.toBe(consumerOf(1))
    // The first driver letting go leaves the second's hold alone.
    first.stop()
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith(consumerOf(0))
  })

  it('a stop() during the permission prompt hands the stream back once', async () => {
    let grant!: (stream: MediaStream) => void
    mocks.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const driver = createSingDriver('mic')
    const started = driver.start()
    driver.stop()
    // Nothing to release yet: the reference arrives with the stream.
    expect(mocks.release).not.toHaveBeenCalled()
    grant({} as MediaStream)
    await started
    expect(mocks.createF0Stream).not.toHaveBeenCalled()
    expect(mocks.release).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith(consumerOf(0))
    expect(mocks.lease.release).toHaveBeenCalledTimes(1)
  })

  it('a start() after stop() opens nothing', async () => {
    mocks.acquire.mockResolvedValue({} as MediaStream)
    const driver = createSingDriver('mic')
    driver.stop()
    await driver.start()
    expect(mocks.acquire).not.toHaveBeenCalled()
    expect(mocks.createF0Stream).not.toHaveBeenCalled()
  })

  it('a start() that fails gives the mic and the lease back', async () => {
    mocks.acquire.mockRejectedValue(new Error('denied'))
    const driver = createSingDriver('mic')
    await expect(driver.start()).rejects.toThrow('denied')
    // The stage drops a driver that never came up without calling stop();
    // nothing was held, so nothing is released to the manager either.
    expect(mocks.release).not.toHaveBeenCalled()
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
