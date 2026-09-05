// ============================================================
// useSingCapture around a slow permission prompt: one acquisition
// at a time, and a release() that lands while the prompt is still
// up hands the stream back instead of holding it for nobody.
// ============================================================

import { createRoot } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const f0 = {
    startTask: vi.fn(),
    dispose: vi.fn(),
    takeFrames: vi.fn(() => []),
    peekFrames: vi.fn(() => []),
    latestLevel: vi.fn(() => 0),
  }
  return {
    f0,
    acquire: vi.fn<(id: string) => Promise<MediaStream>>(),
    release: vi.fn<(id: string) => void>(),
    createF0Stream: vi.fn((_ctx: AudioContext, _stream: MediaStream) => f0),
  }
})

vi.mock('@/lib/mic-manager', () => ({
  micManager: {
    acquire: (id: string) => mocks.acquire(id),
    release: (id: string) => mocks.release(id),
  },
}))
vi.mock('@/lib/pitch-f0-stream', () => ({
  createF0Stream: (ctx: AudioContext, stream: MediaStream) =>
    mocks.createF0Stream(ctx, stream),
}))

import { useSingCapture } from './use-sing-capture'

const engine = {
  init: vi.fn(async () => undefined),
  resume: vi.fn(async () => undefined),
  getAudioContext: () => ({ currentTime: 0 }) as unknown as AudioContext,
}

function mount() {
  return createRoot((dispose) => ({
    capture: useSingCapture(engine, 'ear-lab'),
    dispose,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useSingCapture', () => {
  it('holds the stream after one acquisition and lets it go on release', async () => {
    mocks.acquire.mockResolvedValue({} as MediaStream)
    const { capture, dispose } = mount()
    await capture.acquire()
    expect(capture.held()).toBe(true)
    expect(mocks.createF0Stream).toHaveBeenCalledTimes(1)
    capture.release()
    expect(capture.held()).toBe(false)
    expect(mocks.f0.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith('ear-lab')
    dispose()
  })

  it('shares one acquisition between two Begins during the prompt', async () => {
    let grant!: (stream: MediaStream) => void
    mocks.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const { capture, dispose } = mount()
    const first = capture.acquire()
    const second = capture.acquire()
    grant({} as MediaStream)
    await Promise.all([first, second])
    expect(mocks.acquire).toHaveBeenCalledTimes(1)
    expect(mocks.createF0Stream).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('a release() during the prompt hands the stream straight back', async () => {
    let grant!: (stream: MediaStream) => void
    mocks.acquire.mockReturnValue(
      new Promise<MediaStream>((resolve) => {
        grant = resolve
      }),
    )
    const { capture, dispose } = mount()
    const pending = capture.acquire()
    // The drill left (unmount, or a switch to tapping) with the prompt up.
    capture.release()
    grant({} as MediaStream)
    await pending
    expect(capture.held()).toBe(false)
    expect(mocks.createF0Stream).not.toHaveBeenCalled()
    // Once for the release itself, once for the stream that arrived late.
    expect(mocks.release).toHaveBeenCalledTimes(2)
    expect(mocks.release).toHaveBeenLastCalledWith('ear-lab')
    dispose()
  })

  it('lets go on cleanup', async () => {
    mocks.acquire.mockResolvedValue({} as MediaStream)
    const { capture, dispose } = mount()
    await capture.acquire()
    dispose()
    expect(mocks.f0.dispose).toHaveBeenCalledTimes(1)
    expect(mocks.release).toHaveBeenCalledWith('ear-lab')
  })
})
