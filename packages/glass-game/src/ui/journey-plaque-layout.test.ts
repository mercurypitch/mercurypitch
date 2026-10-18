// Journey plaque layout tests — scene frames consume cached HUD bounds without layout reads.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createJourneyPlaqueLayout } from './journey-plaque-layout'

afterEach(() => vi.unstubAllGlobals())

describe('museum plaque measurement lifecycle', () => {
  it('remeasures on resize, reuses cached bounds during camera frames and retires pending work', () => {
    let queued: FrameRequestCallback | undefined
    let resized: (() => void) | undefined
    const observe = vi.fn()
    const disconnect = vi.fn()
    const cancel = vi.fn(() => {
      queued = undefined
    })
    const remove = vi.fn()
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: remove,
    })
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        queued = callback
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', cancel)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback
        }
        observe = observe
        unobserve = vi.fn()
        disconnect = disconnect
      },
    )
    const container = {
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 1440,
        height: 900,
      })),
    }
    const rail = {
      getBoundingClientRect: vi.fn(() => ({
        left: 28,
        top: 820,
        right: 385.609375,
        bottom: 874,
        width: 357.609375,
        height: 54,
      })),
    }
    const plaque = {
      getBoundingClientRect: vi.fn(() => ({ width: 150, height: 58.375 })),
    }
    const button = {
      dataset: { plaquePlacement: '' },
      querySelector: vi.fn(() => plaque),
      getBoundingClientRect: vi.fn(() => ({ width: 44, height: 44 })),
    }
    const layout = createJourneyPlaqueLayout({
      container: container as unknown as HTMLElement,
      labels: new Map([['first', button as unknown as HTMLButtonElement]]),
      plaqueSelector: '.plaque',
      obstacles: () => [rail as unknown as HTMLElement],
    })
    const flush = (): void => {
      const callback = queued
      queued = undefined
      callback?.(0)
    }
    flush()
    layout.update('first', 224, 728)
    expect(button.dataset.plaquePlacement).toBe('right')
    for (let frame = 0; frame < 60; frame++) layout.update('first', 224, 728)
    for (const element of [container, rail, plaque, button])
      expect(element.getBoundingClientRect).toHaveBeenCalledTimes(1)

    // A smaller HUD stops blocking the original below-badge placement.
    rail.getBoundingClientRect.mockReturnValue({
      left: 28,
      top: 870,
      right: 385.609375,
      bottom: 900,
      width: 357.609375,
      height: 30,
    })
    resized?.()
    flush()
    layout.update('first', 224, 728)
    expect(button.dataset.plaquePlacement).toBe('below')
    expect(rail.getBoundingClientRect).toHaveBeenCalledTimes(2)
    layout.refresh()
    layout.dispose()
    expect(cancel).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('resize', layout.refresh)
    expect(queued).toBeUndefined()
  })
})
