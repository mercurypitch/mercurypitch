// The lane's position must move at the rate the picture does, not at 4 Hz.
import { describe, expect, it, vi } from 'vitest'
import type { FrameScheduler } from '@/lib/jam/media-clock'
import { followMediaClock } from '@/lib/jam/media-clock'

function scheduler() {
  const queued: (() => void)[] = []
  const cancelled = new Set<number>()
  let next = 1
  const frames: FrameScheduler = {
    request(callback) {
      const handle = next++
      queued.push(() => {
        if (!cancelled.has(handle)) callback()
      })
      return handle
    },
    cancel(handle) {
      cancelled.add(handle)
    },
  }
  /** Run whatever is queued now, so a callback that re-requests does not spin. */
  const step = (count = 1): void => {
    for (let at = 0; at < count; at++) queued.splice(0).forEach((run) => run())
  }
  return { frames, step, pending: () => queued.length }
}

function element(paused = true) {
  const listeners = new Map<string, Set<() => void>>()
  return {
    currentTime: 0,
    paused,
    addEventListener(type: string, listener: () => void) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener)
    },
    emit(type: string) {
      listeners.get(type)?.forEach((listener) => listener())
    },
    listenerCount: () =>
      [...listeners.values()].reduce((total, set) => total + set.size, 0),
  }
}

describe('following a jam song element clock', () => {
  it('reports every frame while it plays', () => {
    const el = element()
    const report = vi.fn()
    const { frames, step } = scheduler()
    followMediaClock(el, report, frames)

    el.emit('playing')
    el.currentTime = 1.016
    step()
    el.currentTime = 1.032
    step()
    expect(report.mock.calls.map(([seconds]) => seconds)).toEqual([
      1.016, 1.032,
    ])
  })

  it('starts following an element that is already playing', () => {
    const el = element(false)
    const report = vi.fn()
    const { frames, step } = scheduler()
    followMediaClock(el, report, frames)

    el.currentTime = 4
    step()
    expect(report).toHaveBeenCalledWith(4)
  })

  it('keeps reporting a timeupdate, which is all a hidden tab gets', () => {
    // Animation frames stop when the tab is hidden; a phone with the room in
    // the background must still advance the song.
    const el = element()
    const report = vi.fn()
    const { frames } = scheduler()
    followMediaClock(el, report, frames)

    el.currentTime = 9.5
    el.emit('timeupdate')
    expect(report).toHaveBeenCalledWith(9.5)
  })

  it('stops at the position it paused on, and asks for no more frames', () => {
    const el = element()
    const report = vi.fn()
    const { frames, step, pending } = scheduler()
    followMediaClock(el, report, frames)

    el.emit('playing')
    step()
    el.currentTime = 12.25
    el.emit('pause')
    expect(report).toHaveBeenLastCalledWith(12.25)
    step()
    expect(pending()).toBe(0)
    expect(report).toHaveBeenLastCalledWith(12.25)
  })

  it('does not stack loops when playing fires again', () => {
    const el = element()
    const report = vi.fn()
    const { frames, step } = scheduler()
    followMediaClock(el, report, frames)

    el.emit('playing')
    el.emit('playing')
    el.currentTime = 2
    step()
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('releases the element on teardown', () => {
    const el = element()
    const report = vi.fn()
    const { frames, step, pending } = scheduler()
    const stop = followMediaClock(el, report, frames)

    el.emit('playing')
    stop()
    step()
    expect(pending()).toBe(0)
    expect(el.listenerCount()).toBe(0)
    el.emit('timeupdate')
    expect(report).not.toHaveBeenCalled()
  })
})
