// Frame loop tests — a requestAnimationFrame loop that runs only while it has work, one frame past it, and starts again when work comes back.
import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createFrameLoop } from './frame-loop'

/** A fake display: frames run only when the test says so. */
function fakeFrames() {
  const queued = new Map<number, FrameRequestCallback>()
  let next = 1
  return {
    request: vi.fn((callback: FrameRequestCallback) => {
      queued.set(next, callback)
      return next++
    }),
    cancel: vi.fn((id: number) => {
      queued.delete(id)
    }),
    pending: () => queued.size,
    /** Run every frame asked for so far, as one display frame does. */
    run(): void {
      const due = [...queued]
      queued.clear()
      for (const [, callback] of due) callback(performance.now())
    },
  }
}

function mount(work: { active: () => boolean; frame: () => void }) {
  const frames = fakeFrames()
  const dispose = createRoot((dispose) => {
    createFrameLoop({
      ...work,
      requestFrame: frames.request,
      cancelFrame: frames.cancel,
    })
    return dispose
  })
  return { frames, dispose }
}

describe('createFrameLoop', () => {
  it('asks for no frame while there is no work', () => {
    const frame = vi.fn()
    const { frames, dispose } = mount({ active: () => false, frame })
    expect(frames.request).not.toHaveBeenCalled()
    expect(frame).not.toHaveBeenCalled()
    dispose()
  })

  it('runs every frame while there is work, one frame past it, then stops', () => {
    const [busy, setBusy] = createSignal(true)
    const frame = vi.fn()
    const { frames, dispose } = mount({ active: busy, frame })
    frames.run()
    frames.run()
    expect(frame).toHaveBeenCalledTimes(2)
    expect(frames.pending()).toBe(1)

    setBusy(false)
    // The frame already asked for runs, so it can show the idle state.
    frames.run()
    expect(frame).toHaveBeenCalledTimes(3)
    expect(frames.pending()).toBe(0)
    frames.run()
    expect(frame).toHaveBeenCalledTimes(3)
    dispose()
  })

  it('starts again on the next frame when work comes back', () => {
    const [busy, setBusy] = createSignal(false)
    const frame = vi.fn()
    const { frames, dispose } = mount({ active: busy, frame })
    expect(frames.pending()).toBe(0)
    setBusy(true)
    expect(frames.pending()).toBe(1)
    frames.run()
    expect(frame).toHaveBeenCalledOnce()
    // Work that stops and comes back between two frames keeps one loop.
    setBusy(false)
    setBusy(true)
    expect(frames.pending()).toBe(1)
    frames.run()
    expect(frame).toHaveBeenCalledTimes(2)
    expect(frames.pending()).toBe(1)
    dispose()
  })

  it('keeps one loop when a frame starts work of its own', () => {
    const [busy, setBusy] = createSignal(true)
    const frame = vi.fn(() => {
      setBusy(false)
      setBusy(true)
    })
    const { frames, dispose } = mount({ active: busy, frame })
    frames.run()
    expect(frames.pending()).toBe(1)
    dispose()
  })

  it('stops a frame the work ended inside, with no frame after it', () => {
    const [busy, setBusy] = createSignal(true)
    const frame = vi.fn(() => setBusy(false))
    const { frames, dispose } = mount({ active: busy, frame })
    frames.run()
    expect(frame).toHaveBeenCalledOnce()
    expect(frames.pending()).toBe(0)
    dispose()
  })

  it('cancels its frame when its owner goes, and a late frame does nothing', () => {
    const frames = fakeFrames()
    const frame = vi.fn()
    let late: FrameRequestCallback | undefined
    const dispose = createRoot((dispose) => {
      createFrameLoop({
        active: () => true,
        frame,
        requestFrame: (callback) => {
          late = callback
          return frames.request(callback)
        },
        cancelFrame: frames.cancel,
      })
      return dispose
    })
    expect(frames.pending()).toBe(1)
    dispose()
    expect(frames.cancel).toHaveBeenCalledOnce()
    expect(frames.pending()).toBe(0)
    late?.(0)
    expect(frame).not.toHaveBeenCalled()
  })
})
