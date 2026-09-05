// ============================================================
// Punched time dial readiness tests — real clipping and scroll quietness
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTimeDialPointerReadiness, visibleElementRatio, } from './punched-time-dial-readiness'

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Punched Clock pointer readiness', () => {
  it('accounts for a clipping ancestor and waits for nested scrolling to settle', () => {
    // Arrange
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 440)
    let clippingHeight = 351
    let now = 1_000
    const scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.getBoundingClientRect = () => rect(0, 0, 440, clippingHeight)
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 440)
    scroller.append(record)
    document.body.append(scroller)
    const readiness = createTimeDialPointerReadiness(record, {
      now: () => now,
    })

    // Act / Assert
    expect(visibleElementRatio(record)).toBeLessThan(0.8)
    expect(readiness.isReady()).toBe(false)

    clippingHeight = 440
    expect(readiness.isReady()).toBe(true)

    scroller.dispatchEvent(new Event('scroll'))
    expect(readiness.revision()).toBe(1)
    expect(readiness.isReady()).toBe(false)

    now += 181
    expect(readiness.isReady()).toBe(true)

    readiness.dispose()
    scroller.dispatchEvent(new Event('scroll'))
    expect(readiness.revision()).toBe(1)
  })

  it('uses the visual viewport as the outer visibility boundary', () => {
    // Arrange
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 440)
    vi.stubGlobal(
      'visualViewport',
      Object.assign(new EventTarget(), {
        offsetLeft: 0,
        offsetTop: 80,
        width: 440,
        height: 352,
      }),
    )
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 440)
    document.body.append(record)

    // Act
    const ratio = visibleElementRatio(record)

    // Assert
    expect(ratio).toBeCloseTo(0.8)
  })

  it('falls back to the layout viewport when visualViewport is null', () => {
    // Arrange
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 400)
    vi.stubGlobal('visualViewport', null)
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 500)
    document.body.append(record)

    // Act
    const ratio = visibleElementRatio(record)

    // Assert
    expect(ratio).toBeCloseTo(0.8)
  })
})
