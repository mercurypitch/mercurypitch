// Studio memory budget tests cover reclaimable caches and the pinned budget seam.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStudioMemoryRefusal, registerStudioMemoryReclaimer, reserveStudioMemory, setStudioWorkingBytes, StudioMemoryError, studioReservedMemoryBytes, } from './memory-budget'

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

  it('tells a lack of memory apart from damaged or missing audio', () => {
    setStudioWorkingBytes(10)
    let refusal: unknown
    try {
      reserveStudioMemory(11)
    } catch (error) {
      refusal = error
    }

    expect(refusal).toBeInstanceOf(StudioMemoryError)
    expect(isStudioMemoryRefusal(refusal)).toBe(true)
    expect(
      isStudioMemoryRefusal(
        new Error('Studio needs more memory to copy this song.'),
      ),
    ).toBe(true)
    expect(
      isStudioMemoryRefusal(new RangeError('Array buffer allocation failed')),
    ).toBe(true)
    expect(isStudioMemoryRefusal(new RangeError('Out of memory'))).toBe(true)
    // A damaged header reads past its end: that is damage, not memory.
    expect(
      isStudioMemoryRefusal(
        new RangeError('Offset is outside the bounds of the DataView'),
      ),
    ).toBe(false)
    expect(
      isStudioMemoryRefusal(new Error('This project audio is missing.')),
    ).toBe(false)
    expect(isStudioMemoryRefusal('Studio needs more memory')).toBe(false)
  })
})
