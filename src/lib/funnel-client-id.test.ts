// ============================================================
// The funnel's anonymous id — renewed 13 months after it was issued
// ============================================================
//
// Privacy plan 4.2: a new id 13 months after creation, not extended by
// visits. Without it, the server's sweep deletes a visitor's old rows and the
// next event, which re-sends the same id and the same acquisition, brings
// them back. An id stored before this rule existed has no issue date; it is
// dated "now" rather than replaced, so a deploy does not turn every returning
// visitor into a new one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunnelAcquisition } from './acquisition'
import { funnelEventBody, getFunnelClientId } from './funnel'

const ID_KEY = 'mirror.clientId.v1'
const LEGACY_ID_KEY = 'mp.analytics.clientId.v1'
const ISSUED_KEY = 'mirror.clientId.issuedAt.v1'
const ACQUISITION_KEY = 'mirror.acquisition.v1'

const DEPLOY = Date.parse('2026-10-11T08:00:00.000Z')
/** The first commit that wrote mirror.clientId.v1 (5a9158dc7). */
const LEGACY_ISSUED_AT = Date.parse('2026-07-01T00:00:00.000Z')

/**
 * Swap in a localStorage whose writes or removals fail for some keys, the
 * way a full or locked-down store fails. A stub of the global rather than a
 * spy on Storage.prototype: under Node 25 the global is Node's own storage,
 * not jsdom's, and a prototype spy never reaches it.
 */
function failingStorage(
  fails: (method: 'setItem' | 'removeItem', key: string) => boolean,
): void {
  const real = globalThis.localStorage
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => real.getItem(key),
    setItem: (key: string, value: string) => {
      if (fails('setItem', key)) throw new Error('QuotaExceededError')
      real.setItem(key, value)
    },
    removeItem: (key: string) => {
      if (fails('removeItem', key)) throw new Error('SecurityError')
      real.removeItem(key)
    },
    clear: () => real.clear(),
  })
}

function at(iso: string): number {
  const ms = Date.parse(iso)
  vi.setSystemTime(ms)
  return ms
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DEPLOY)
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('issuing', () => {
  it('dates a new id when it mints one', () => {
    const id = getFunnelClientId()

    expect(localStorage.getItem(ID_KEY)).toBe(id)
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })

  it('does not give a new id the date of an id that is gone', () => {
    localStorage.setItem(
      ISSUED_KEY,
      String(Date.parse('2025-01-01T00:00:00.000Z')),
    )

    getFunnelClientId()

    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })

  it('does not move the date on later visits', () => {
    const id = getFunnelClientId()
    at('2027-05-01T00:00:00.000Z')

    expect(getFunnelClientId()).toBe(id)
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })
})

describe('an id stored before this rule', () => {
  // Its age cannot be known, so it takes the earliest day the key could
  // have been written (the first commit that wrote mirror.clientId.v1,
  // 2026-07-01), never "now": "now" would give an old id a fresh 13
  // months, and restart them on every read where the date fails to save.
  it('is kept and dated the day the key first existed', () => {
    localStorage.setItem(ID_KEY, 'returning-visitor-1')
    localStorage.setItem(LEGACY_ID_KEY, 'returning-visitor-1')

    expect(getFunnelClientId()).toBe('returning-visitor-1')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(LEGACY_ISSUED_AT))
  })

  it('is kept when only the legacy app key holds it', () => {
    localStorage.setItem(LEGACY_ID_KEY, 'legacy-only-visitor')

    expect(getFunnelClientId()).toBe('legacy-only-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(LEGACY_ISSUED_AT))
  })

  it('treats a date it cannot read as no date', () => {
    localStorage.setItem(ID_KEY, 'garbled-date-visitor')
    localStorage.setItem(ISSUED_KEY, 'last tuesday')

    expect(getFunnelClientId()).toBe('garbled-date-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(LEGACY_ISSUED_AT))
  })

  it('treats a date far in the future as no date', () => {
    // A clock that was wrong once must not keep the id for years.
    localStorage.setItem(ID_KEY, 'future-clock-visitor')
    localStorage.setItem(
      ISSUED_KEY,
      String(Date.parse('2031-01-01T00:00:00.000Z')),
    )

    expect(getFunnelClientId()).toBe('future-clock-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(LEGACY_ISSUED_AT))
  })

  it('keeps a date less than a day ahead, as clock skew', () => {
    const skewed = DEPLOY + 12 * 60 * 60 * 1000
    localStorage.setItem(ID_KEY, 'skewed-clock-visitor')
    localStorage.setItem(ISSUED_KEY, String(skewed))

    expect(getFunnelClientId()).toBe('skewed-clock-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(skewed))
  })

  it('renews 13 months after that day, not 13 months after the deploy', () => {
    localStorage.setItem(ID_KEY, 'returning-visitor-2')
    getFunnelClientId()

    at('2027-07-31T23:59:59.999Z')
    expect(getFunnelClientId()).toBe('returning-visitor-2')
    at('2027-08-01T00:00:00.000Z')
    expect(getFunnelClientId()).not.toBe('returning-visitor-2')
  })

  it('does not restart the clock when the date cannot be saved', () => {
    localStorage.setItem(ID_KEY, 'cannot-save-visitor')
    failingStorage((method, key) => method === 'setItem' && key === ISSUED_KEY)

    // The id still works without its date, and the date it lacks is the
    // fixed legacy one, so 13 months after that it is renewed.
    expect(getFunnelClientId()).toBe('cannot-save-visitor')
    at('2027-08-02T00:00:00.000Z')

    const renewed = getFunnelClientId()
    expect(renewed).not.toBe('cannot-save-visitor')
    expect(renewed).not.toBe('no-storage')
  })
})

describe('renewal', () => {
  it('keeps the id until 13 months have passed', () => {
    const id = getFunnelClientId()
    at('2027-11-11T07:59:59.999Z')

    expect(getFunnelClientId()).toBe(id)
  })

  it('mints a new id at 13 months, in both keys, with a new date', () => {
    const id = getFunnelClientId()
    const now = at('2027-11-11T08:00:00.000Z')

    const renewed = getFunnelClientId()

    expect(renewed).not.toBe(id)
    expect(renewed).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(localStorage.getItem(ID_KEY)).toBe(renewed)
    expect(localStorage.getItem(LEGACY_ID_KEY)).toBe(renewed)
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(now))
  })

  it("forgets the old id's acquisition with it", () => {
    // Sent under the new id, the old first touch would start a fresh
    // server row and outlive the one the sweep deletes.
    // Captured long after the id was issued, so its own clocks (90 days
    // for the click id, 13 months for the record) have not run out.
    const id = getFunnelClientId()
    at('2027-09-01T00:00:00.000Z')
    window.history.replaceState({}, '', '/?gclid=old-click&utm_source=google')
    expect(getFunnelAcquisition(id)).toEqual({
      gclid: 'old-click',
      utmSource: 'google',
    })

    window.history.replaceState({}, '', '/')
    at('2027-11-12T00:00:00.000Z')
    expect(localStorage.getItem(ACQUISITION_KEY)).not.toBeNull()
    const renewed = getFunnelClientId()

    expect(localStorage.getItem(ACQUISITION_KEY)).toBeNull()
    expect(getFunnelAcquisition(renewed)).toBeUndefined()
  })

  it("never sends the old id's acquisition with the new id, even when it could not be removed", () => {
    const id = getFunnelClientId()
    at('2027-09-01T00:00:00.000Z')
    window.history.replaceState({}, '', '/?gclid=old-click&utm_source=google')
    expect(getFunnelAcquisition(id)).toEqual({
      gclid: 'old-click',
      utmSource: 'google',
    })
    window.history.replaceState({}, '', '/')
    at('2027-11-12T00:00:00.000Z')
    failingStorage((method) => method === 'removeItem')

    const body = JSON.parse(funnelEventBody('mirror_view')) as {
      clientId: string
      acq?: unknown
    }

    expect(body.clientId).not.toBe(id)
    expect('acq' in body).toBe(false)
  })

  it('follows VITE_RETENTION_FUNNEL_ID_MONTHS', () => {
    vi.stubEnv('VITE_RETENTION_FUNNEL_ID_MONTHS', '6')
    const id = getFunnelClientId()
    at('2027-04-11T08:00:00.000Z')

    expect(getFunnelClientId()).not.toBe(id)
  })

  it('ignores a bad VITE_RETENTION_FUNNEL_ID_MONTHS rather than renewing early', () => {
    vi.stubEnv('VITE_RETENTION_FUNNEL_ID_MONTHS', '0')
    const id = getFunnelClientId()
    at('2027-04-11T08:00:00.000Z')

    expect(getFunnelClientId()).toBe(id)
  })
})
