// ============================================================
// room-measure: a room's measure of itself, on the page and on each resize
// ============================================================

import { createRoot } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMeasure, cssPx } from './room-measure'

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

/** A ResizeObserver the test resizes by hand. */
function stubObserver() {
  const seen = { observed: [] as Element[], disconnected: 0 }
  let resize: () => void = () => undefined
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe(el: Element): void {
        seen.observed.push(el)
      }
      disconnect(): void {
        seen.disconnected += 1
      }
    },
  )
  return { seen, resize: () => resize() }
}

describe('cssPx', () => {
  it("reads a room's custom property in px, and 0 when it is unset or not a length", () => {
    const el = document.createElement('div')
    el.style.setProperty('--chip-clear', '52.5px')
    el.style.setProperty('--odd', 'auto')
    document.body.append(el)
    const style = window.getComputedStyle(el)

    expect(cssPx(style, '--chip-clear')).toBe(52.5)
    expect(cssPx(style, '--odd')).toBe(0)
    expect(cssPx(style, '--missing')).toBe(0)
  })
})

describe('createMeasure', () => {
  it('is null until the room is on the page, then measured, and again on each resize', () => {
    const observer = stubObserver()
    const el = document.createElement('div')
    let width = 390
    let beforeMount: number | null = -1

    const { size, dispose } = createRoot((dispose) => {
      const size = createMeasure(
        () => el,
        () => width,
      )
      beforeMount = size()
      return { size, dispose }
    })

    expect(beforeMount).toBeNull()
    expect(size()).toBe(390)
    expect(observer.seen.observed).toEqual([el])
    width = 820
    observer.resize()
    expect(size()).toBe(820)
    dispose()
    expect(observer.seen.disconnected).toBe(1)
  })

  it('stays null with no element to measure', () => {
    const observer = stubObserver()
    let reads = 0

    const { size, dispose } = createRoot((dispose) => ({
      size: createMeasure(
        () => undefined,
        () => {
          reads += 1
          return 1
        },
      ),
      dispose,
    }))

    expect([size(), reads, observer.seen.observed.length]).toEqual([null, 0, 0])
    dispose()
  })
})
