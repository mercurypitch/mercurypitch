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
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Punched Clock pointer readiness', () => {
  it('publishes readiness before contact and rearms only after the latest scroll is quiet', () => {
    vi.useFakeTimers()
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 440)
    vi.stubGlobal('visualViewport', null)
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 440)
    document.body.append(record)
    const onReadyChange = vi.fn<(ready: boolean) => void>()
    const readiness = createTimeDialPointerReadiness(record, {
      now: () => Date.now(),
      onReadyChange,
    })

    expect(onReadyChange.mock.calls).toEqual([[true]])
    window.dispatchEvent(new Event('scroll'))
    expect(onReadyChange.mock.calls).toEqual([[true], [false]])
    vi.advanceTimersByTime(100)
    window.dispatchEvent(new Event('scroll'))
    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(179)
    expect(onReadyChange.mock.calls).toEqual([[true], [false]])
    expect(readiness.isReady()).toBe(false)
    vi.advanceTimersByTime(1)
    expect(onReadyChange.mock.calls).toEqual([[true], [false], [true]])
    expect(readiness.isReady()).toBe(true)
    expect(readiness.revision()).toBe(2)
    expect(vi.getTimerCount()).toBe(0)
    readiness.dispose()
  })

  it('publishes real clipping changes from intersection and ancestor resize observations', () => {
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 440)
    vi.stubGlobal('visualViewport', null)
    let clippingHeight = 351
    const scroller = document.createElement('div')
    scroller.style.overflowY = 'auto'
    scroller.getBoundingClientRect = () => rect(0, 0, 440, clippingHeight)
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 440)
    scroller.append(record)
    document.body.append(scroller)
    let intersectionCallback = (): void => undefined
    let resizeCallback = (): void => undefined
    const intersectionObserve = vi.fn()
    const resizeObserve = vi.fn()
    const intersectionDisconnect = vi.fn()
    const resizeDisconnect = vi.fn()
    const intersectionOptions = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: () => void, options: IntersectionObserverInit) {
          intersectionCallback = callback
          intersectionOptions(options)
        }
        observe = intersectionObserve
        disconnect = intersectionDisconnect
      },
    )
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resizeCallback = callback
        }
        observe = resizeObserve
        disconnect = resizeDisconnect
      },
    )
    const onReadyChange = vi.fn<(ready: boolean) => void>()
    const readiness = createTimeDialPointerReadiness(record, { onReadyChange })

    expect(onReadyChange.mock.calls).toEqual([[false]])
    expect(intersectionOptions).toHaveBeenCalledWith({ threshold: [0, 0.8, 1] })
    expect(intersectionObserve).toHaveBeenCalledWith(record)
    expect(resizeObserve).toHaveBeenCalledWith(record)
    expect(resizeObserve).toHaveBeenCalledWith(scroller)
    clippingHeight = 352
    intersectionCallback()
    expect(onReadyChange.mock.calls).toEqual([[false], [true]])
    clippingHeight = 351
    resizeCallback()
    expect(onReadyChange.mock.calls).toEqual([[false], [true], [false]])
    // A repeated callback must not trigger redundant reactive DOM writes.
    intersectionCallback()
    expect(onReadyChange).toHaveBeenCalledTimes(3)

    readiness.dispose()
    expect(intersectionDisconnect).toHaveBeenCalledOnce()
    expect(resizeDisconnect).toHaveBeenCalledOnce()
    clippingHeight = 440
    intersectionCallback()
    resizeCallback()
    expect(onReadyChange).toHaveBeenCalledTimes(3)
  })

  it('reacts to window and visual viewport movement and owns its timer/listener cleanup', () => {
    vi.useFakeTimers()
    vi.stubGlobal('innerWidth', 440)
    vi.stubGlobal('innerHeight', 440)
    const viewport = Object.assign(new EventTarget(), {
      offsetLeft: 0,
      offsetTop: 0,
      width: 440,
      height: 440,
    })
    vi.stubGlobal('visualViewport', viewport)
    const record = document.createElement('div')
    record.getBoundingClientRect = () => rect(0, 0, 440, 440)
    document.body.append(record)
    const onReadyChange = vi.fn<(ready: boolean) => void>()
    const readiness = createTimeDialPointerReadiness(record, {
      now: () => Date.now(),
      onReadyChange,
    })

    window.dispatchEvent(new Event('resize'))
    expect(onReadyChange.mock.calls).toEqual([[true], [false]])
    viewport.height = 300
    viewport.dispatchEvent(new Event('resize'))
    vi.advanceTimersByTime(180)
    expect(readiness.isReady()).toBe(false)
    expect(onReadyChange).toHaveBeenCalledTimes(2)
    viewport.height = 440
    viewport.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(180)
    expect(onReadyChange.mock.calls).toEqual([[true], [false], [true]])

    window.dispatchEvent(new Event('scroll'))
    expect(vi.getTimerCount()).toBe(1)
    const revisionBeforeDispose = readiness.revision()
    const callsBeforeDispose = onReadyChange.mock.calls.length
    readiness.dispose()
    readiness.dispose()
    expect(vi.getTimerCount()).toBe(0)
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('scroll'))
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(500)
    expect(readiness.revision()).toBe(revisionBeforeDispose)
    expect(onReadyChange).toHaveBeenCalledTimes(callsBeforeDispose)
    expect(readiness.isReady()).toBe(false)
  })

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
