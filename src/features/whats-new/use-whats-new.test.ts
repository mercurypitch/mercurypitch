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

  it('holds back for a visitor sent for the credit-cost guide', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    window.location.hash = '#/settings/credits?open=costs'
    createWhatsNewController().announceIfNew(true)
    expect(window.location.hash).toBe('#/settings/credits?open=costs')
    // Kept for their next visit, rather than marked as told.
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe('0.0')
  })

  // The release page is a surface the router opens from the address, so it
  // is open from the start on a restored #/whats-new. That route is not on the
  // announcement's list (use-whats-new.ts): a first-ever visitor on it is still
  // caught up, which a place on that list would have stopped. The opening
  // takeover is held back there by App, which says so beside its own arrival.
  it('catches a first-ever visitor up on the release page itself', () => {
    window.location.hash = '#/whats-new'
    const whatsNew = createWhatsNewController()

    whatsNew.announceIfNew(false)

    expect(whatsNew.open()).toBe(true)
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(
      releaseLine(APP_VERSION),
    )
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

describe("What's New's due check", () => {
  it('reports due without opening the panel', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    const whatsNew = createWhatsNewController()

    expect(whatsNew.isDue(true)).toBe(true)

    // Asking is not announcing: nothing is opened and nothing is told.
    expect(window.location.hash).toBe('#/singing')
    expect(whatsNew.open()).toBe(false)
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe('0.0')
  })

  it('reports not due for a line this device has been told', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, releaseLine(APP_VERSION) ?? '')

    expect(createWhatsNewController().isDue(true)).toBe(false)
  })

  it('reports not due for a first-ever visitor, and records nothing', () => {
    expect(createWhatsNewController().isDue(false)).toBe(false)
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBeNull()
  })

  it('reports not due on a link somebody was sent', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    window.location.hash = '#/settings/credits?open=costs'

    expect(createWhatsNewController().isDue(true)).toBe(false)
  })

  it('reports not due under the native build', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')

    expect(createWhatsNewController({ native: true }).isDue(true)).toBe(false)
  })

  it('reports not due in an automated run', () => {
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    ;(window as unknown as Record<string, unknown>)['E2E_TEST_MODE'] = true
    try {
      expect(createWhatsNewController().isDue(true)).toBe(false)
    } finally {
      delete (window as unknown as Record<string, unknown>)['E2E_TEST_MODE']
    }
  })

  // announceIfNew is the check and then the panel; it says nothing the check
  // does not, and the first-ever visitor's catch-up is the one thing it adds.
  it.each<[string, boolean, string | null, boolean, string | null]>([
    ['a returning visitor, a line not yet told', true, '0.0', true, '0.0'],
    [
      'a returning visitor, a line already told',
      true,
      releaseLine(APP_VERSION),
      false,
      releaseLine(APP_VERSION),
    ],
    [
      'a first-ever visitor, who is caught up and shown nothing',
      false,
      null,
      false,
      releaseLine(APP_VERSION),
    ],
  ])(
    'announces exactly when it is due: %s',
    (_, returning, seen, opens, seenAfter) => {
      if (seen !== null) localStorage.setItem(WHATS_NEW_SEEN_KEY, seen)
      const whatsNew = createWhatsNewController()

      const due = whatsNew.isDue(returning)
      whatsNew.announceIfNew(returning)

      expect(due).toBe(opens)
      expect(window.location.hash === '#/whats-new').toBe(opens)
      expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(seenAfter)
    },
  )
})
