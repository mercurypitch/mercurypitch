// Loop-controller tests keep the marks honest and the wrap the host's business.
// ============================================================

import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { useGuitarNightLoopController } from './useGuitarNightLoopController'

describe('useGuitarNightLoopController', () => {
  it('has no loop until both marks make one', () => {
    createRoot((dispose) => {
      const loop = useGuitarNightLoopController({ limit: () => 60 })

      expect(loop.span()).toBeNull()
      expect(loop.isPending()).toBe(false)

      loop.markStart(10)
      expect(loop.span()).toBeNull()
      // A half-set loop is visibly half-set, not silently ignored.
      expect(loop.isPending()).toBe(true)

      loop.markEnd(20)
      expect(loop.span()).toEqual({ start: 10, end: 20 })
      expect(loop.isLooping()).toBe(true)
      dispose()
    })
  })

  it('re-marking A past B drops B rather than inverting the loop', () => {
    createRoot((dispose) => {
      const loop = useGuitarNightLoopController({ limit: () => 60 })
      loop.markStart(10)
      loop.markEnd(20)

      loop.markStart(30)

      expect(loop.markA()).toBe(30)
      expect(loop.markB()).toBeNull()
      expect(loop.span()).toBeNull()
      dispose()
    })
  })

  it('re-marking B before A drops A the same way', () => {
    createRoot((dispose) => {
      const loop = useGuitarNightLoopController({ limit: () => 60 })
      loop.markStart(10)
      loop.markEnd(20)

      loop.markEnd(5)

      expect(loop.markB()).toBe(5)
      expect(loop.markA()).toBeNull()
      dispose()
    })
  })

  it('follows the timeline it was given, so a stream that grows is respected', () => {
    createRoot((dispose) => {
      const [limit, setLimit] = createSignal(0)
      const loop = useGuitarNightLoopController({ limit })
      loop.markStart(10)
      loop.markEnd(120)
      // Duration unknown: the marks stand as given.
      expect(loop.span()).toEqual({ start: 10, end: 120 })

      setLimit(60)
      expect(loop.span()).toEqual({ start: 10, end: 60 })
      dispose()
    })
  })

  it('wraps the host only after the playhead has passed B', () => {
    createRoot((dispose) => {
      const onWrap = vi.fn()
      const loop = useGuitarNightLoopController({ limit: () => 60, onWrap })
      loop.markStart(10)
      loop.markEnd(20)

      expect(loop.follow(5)).toBe(false)
      expect(loop.follow(19.9)).toBe(false)
      expect(onWrap).not.toHaveBeenCalled()

      expect(loop.follow(20)).toBe(true)
      expect(onWrap).toHaveBeenCalledWith(10)
      dispose()
    })
  })

  it('never wraps a host that folds its own clock', () => {
    createRoot((dispose) => {
      // The tab room schedules the loop into the click: there is no seek.
      const loop = useGuitarNightLoopController({ limit: () => 60 })
      loop.markStart(10)
      loop.markEnd(20)

      expect(loop.follow(99)).toBe(false)
      dispose()
    })
  })

  it('clearing removes both marks', () => {
    createRoot((dispose) => {
      const loop = useGuitarNightLoopController({ limit: () => 60 })
      loop.markStart(10)
      loop.markEnd(20)

      loop.clear()

      expect(loop.markA()).toBeNull()
      expect(loop.markB()).toBeNull()
      expect(loop.isLooping()).toBe(false)
      expect(loop.isPending()).toBe(false)
      dispose()
    })
  })

  it('ignores a mark taken from an unusable playhead', () => {
    createRoot((dispose) => {
      const loop = useGuitarNightLoopController({ limit: () => 60 })
      loop.markStart(Number.NaN)
      expect(loop.markA()).toBeNull()
      dispose()
    })
  })
})
