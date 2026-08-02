import { describe, expect, it, vi } from 'vitest'
import { createMediaProgressLoop, isMediaPlaybackActive, mediaProgressFromPointer, } from './media-progress-loop'

interface MutableMediaClock {
  currentTime: number
  duration: number
  paused: boolean
  ended: boolean
}

function createScheduler() {
  let nextId = 0
  const callbacks = new Map<number, FrameRequestCallback>()
  return {
    scheduler: {
      request: (callback: FrameRequestCallback) => {
        const id = ++nextId
        callbacks.set(id, callback)
        return id
      },
      cancel: (id: number) => callbacks.delete(id),
    },
    step: () => {
      const pending = [...callbacks.values()]
      callbacks.clear()
      for (const callback of pending) callback(performance.now())
    },
    pending: () => callbacks.size,
  }
}

describe('media progress loop', () => {
  it('maps pointer positions across the timeline and clamps either edge', () => {
    expect(mediaProgressFromPointer(150, 100, 200)).toBe(0.25)
    expect(mediaProgressFromPointer(40, 100, 200)).toBe(0)
    expect(mediaProgressFromPointer(400, 100, 200)).toBe(1)
    expect(mediaProgressFromPointer(150, 100, 0)).toBe(0)
  })

  it('samples playback on every animation frame', () => {
    const frames = createScheduler()
    const updates: number[] = []
    const media: MutableMediaClock = {
      currentTime: 0,
      duration: 10,
      paused: false,
      ended: false,
    }
    const loop = createMediaProgressLoop(
      (progress) => updates.push(progress),
      frames.scheduler,
    )

    loop.start(media)
    media.currentTime = 0.16
    frames.step()
    media.currentTime = 0.32
    frames.step()

    expect(updates).toEqual([0, 0.016, 0.032])
    expect(frames.pending()).toBe(1)
  })

  it('ignores stale frames after playback is stopped or replaced', () => {
    const request = vi.fn<(callback: FrameRequestCallback) => number>()
    const callbacks: FrameRequestCallback[] = []
    request.mockImplementation((callback) => {
      callbacks.push(callback)
      return callbacks.length
    })
    const updates: number[] = []
    const loop = createMediaProgressLoop((progress) => updates.push(progress), {
      request,
      cancel: vi.fn(),
    })
    const first = {
      currentTime: 2,
      duration: 10,
      paused: false,
      ended: false,
    }
    const second = {
      currentTime: 1,
      duration: 4,
      paused: false,
      ended: false,
    }

    loop.start(first)
    const staleFrame = callbacks[0]!
    loop.start(second)
    staleFrame(0)

    expect(updates).toEqual([0.2, 0.25])
    loop.stop()
    callbacks.at(-1)!(0)
    expect(updates).toEqual([0.2, 0.25])
  })

  it('clamps invalid and completed media values safely', () => {
    const frames = createScheduler()
    const updates: number[] = []
    const loop = createMediaProgressLoop(
      (progress) => updates.push(progress),
      frames.scheduler,
    )
    const media: MutableMediaClock = {
      currentTime: 20,
      duration: 10,
      paused: false,
      ended: false,
    }

    loop.start(media)
    media.currentTime = Number.NaN
    frames.step()
    media.currentTime = 10
    media.ended = true
    frames.step()

    expect(updates).toEqual([1, 1])
    expect(frames.pending()).toBe(0)
  })

  it('rejects a play continuation that resolves after a quick pause', async () => {
    let resolvePlay = (): void => undefined
    const play = new Promise<void>((resolve) => {
      resolvePlay = resolve
    })
    const media: MutableMediaClock = {
      currentTime: 0,
      duration: 10,
      paused: false,
      ended: false,
    }
    let committed = false
    const continuation = play.then(() => {
      if (isMediaPlaybackActive(media)) committed = true
    })

    media.paused = true
    resolvePlay()
    await continuation

    expect(committed).toBe(false)
  })
})
