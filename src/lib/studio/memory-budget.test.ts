// Studio memory budget tests cover reclaimable caches and the pinned budget seam.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerStudioMemoryReclaimer, reserveStudioMemory, setStudioWorkingBytes, studioReservedMemoryBytes, } from './memory-budget'

afterEach(() => setStudioWorkingBytes(null))

describe('Studio memory budget', () => {
  it('asks reclaimers for room only when a reservation would not fit', () => {
    setStudioWorkingBytes(1000)
    let cached: (() => void) | null = reserveStudioMemory(600)
    const reclaim = vi.fn(() => {
      cached?.()
      cached = null
    })
    const unregister = registerStudioMemoryReclaimer(reclaim)
    const small = reserveStudioMemory(300)
    expect(reclaim).not.toHaveBeenCalled()
    small()
    const large = reserveStudioMemory(900)
    expect(reclaim).toHaveBeenCalledOnce()
    expect(studioReservedMemoryBytes()).toBe(900)
    large()
    unregister()
    expect(studioReservedMemoryBytes()).toBe(0)
  })

  it('still refuses when reclaimers cannot free enough', () => {
    setStudioWorkingBytes(1000)
    const held = reserveStudioMemory(800)
    const unregister = registerStudioMemoryReclaimer(() => undefined)
    expect(() => reserveStudioMemory(300)).toThrow('more memory')
    expect(studioReservedMemoryBytes()).toBe(800)
    unregister()
    held()
  })
})
