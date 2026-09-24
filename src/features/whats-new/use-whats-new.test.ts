import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { APP_VERSION } from '@/lib/defaults'
import { createWhatsNewController } from './use-whats-new'
import { releaseLine, WHATS_NEW_SEEN_KEY } from './whats-new-release'

// The web announces a new release line to a returning visitor and records the
// line for a first-ever one. The native build does neither: it has no What's
// New surface, and a native install is never "returning", so every launch
// recorded the line as seen without ever showing it.

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#/singing'
})

afterEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe("What's New on the web", () => {
  it('announces a release line a returning visitor has not seen', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    createWhatsNewController().announceIfNew(true)
    expect(window.location.hash).toBe('#/whats-new')
  })

  it('records the line for a first-ever visitor without announcing it', () => {
    createWhatsNewController().announceIfNew(false)
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(
      releaseLine(APP_VERSION),
    )
    expect(window.location.hash).toBe('#/singing')
  })
})

describe("What's New under the native build", () => {
  it('announces nothing to a returning visitor', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    createWhatsNewController({ native: true }).announceIfNew(true)
    expect(window.location.hash).toBe('#/singing')
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe('0.0')
  })

  it('marks nothing seen on a launch', () => {
    createWhatsNewController({ native: true }).announceIfNew(false)
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBeNull()
  })
})
