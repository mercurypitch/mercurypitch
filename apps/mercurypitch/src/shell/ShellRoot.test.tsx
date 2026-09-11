// ============================================================
// Reduced motion reaches the tokens, not just the media query
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderShell } from './render-for-test'
import { REDUCED_MOTION_QUERY, ShellRoot } from './ShellRoot'

let unmount: (() => void) | null = null
let listeners: ((event: MediaQueryListEvent) => void)[] = []

function stubMatchMedia(matches: boolean): void {
  listeners = []
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === REDUCED_MOTION_QUERY ? matches : false,
    media: query,
    addEventListener: (
      _: string,
      handler: (e: MediaQueryListEvent) => void,
    ) => {
      listeners.push(handler)
    },
    removeEventListener: (
      _: string,
      handler: (e: MediaQueryListEvent) => void,
    ) => {
      listeners = listeners.filter((entry) => entry !== handler)
    },
  }))
}

beforeEach(() => {
  stubMatchMedia(false)
})

afterEach(() => {
  unmount?.()
  unmount = null
  vi.unstubAllGlobals()
})

describe('ShellRoot', () => {
  it('animates normally when the phone has not asked otherwise', () => {
    const rendered = renderShell(() => <ShellRoot>{null}</ShellRoot>)
    unmount = rendered.unmount

    const root = rendered.container.querySelector('.mp-shell')
    expect(root?.classList.contains('mp-reduced')).toBe(false)
    expect(root?.getAttribute('data-reduced')).toBe('off')
  })

  it('collapses every transition to a crossfade when it has', () => {
    stubMatchMedia(true)

    const rendered = renderShell(() => <ShellRoot>{null}</ShellRoot>)
    unmount = rendered.unmount

    const root = rendered.container.querySelector('.mp-shell')
    expect(root?.classList.contains('mp-reduced')).toBe(true)
    expect(root?.getAttribute('data-reduced')).toBe('on')
  })

  it('follows the setting being changed while the app is open', () => {
    const rendered = renderShell(() => <ShellRoot>{null}</ShellRoot>)
    unmount = rendered.unmount

    listeners.forEach((handler) => {
      handler({ matches: true } as MediaQueryListEvent)
    })

    expect(
      rendered.container
        .querySelector('.mp-shell')
        ?.classList.contains('mp-reduced'),
    ).toBe(true)
  })
})
