// ── The header measures itself, because it is not one height ─────────
//
// A constant was the obvious implementation and it is wrong in both
// directions: 50px puts a toast over the icon-tab row, 92px opens a gap under
// a one-row header. These tests pin the behaviour that replaces it, including
// the two cases a naive version gets wrong — no header, and teardown.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trackAppHeaderHeight } from '@/lib/app-header-height'

const VAR = '--app-header-height'

/** jsdom reports 0 for every offsetHeight, so state it per element. */
function headerOf(height: number): HTMLElement {
  const el = document.createElement('header')
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => height,
  })
  document.body.appendChild(el)
  return el
}

const published = (): string =>
  document.documentElement.style.getPropertyValue(VAR)

beforeEach(() => {
  document.documentElement.style.removeProperty(VAR)
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trackAppHeaderHeight', () => {
  it('publishes the header height straight away', () => {
    trackAppHeaderHeight(headerOf(92))
    expect(published()).toBe('92px')
  })

  it('removes the variable when there is no header to measure', () => {
    // A hidden header measures 0. Publishing "0px" would silently defeat every
    // consumer's fallback and put the toast back over the chrome; removing it
    // hands them back the placement they declare for themselves.
    document.documentElement.style.setProperty(VAR, '92px')
    trackAppHeaderHeight(headerOf(0))
    expect(published()).toBe('')
  })

  it('stops tracking and cleans up after itself', () => {
    const stop = trackAppHeaderHeight(headerOf(50))
    expect(published()).toBe('50px')
    stop()
    expect(published()).toBe('')
  })

  it('still publishes once where ResizeObserver does not exist', () => {
    // Older Safari, and any test environment without the polyfill. A single
    // correct measurement beats falling back to a constant.
    vi.stubGlobal('ResizeObserver', undefined)
    const stop = trackAppHeaderHeight(headerOf(50))
    expect(published()).toBe('50px')
    stop()
    expect(published()).toBe('')
  })

  it('republishes when the header changes height', () => {
    // The case the whole module exists for: the icon-tab strip appears and the
    // header grows from one row to two.
    const captured: { fire?: () => void } = {}
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          captured.fire = cb
        }
        observe(): void {}
        disconnect(): void {}
      },
    )
    let h = 50
    const el = document.createElement('header')
    Object.defineProperty(el, 'offsetHeight', { get: () => h })
    document.body.appendChild(el)

    trackAppHeaderHeight(el)
    expect(published()).toBe('50px')

    h = 92
    captured.fire?.()
    expect(published()).toBe('92px')
  })
})
