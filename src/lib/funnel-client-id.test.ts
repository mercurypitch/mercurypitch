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
import { getFunnelClientId } from './funnel'

const ID_KEY = 'mirror.clientId.v1'
const LEGACY_ID_KEY = 'mp.analytics.clientId.v1'
const ISSUED_KEY = 'mirror.clientId.issuedAt.v1'
const ACQUISITION_KEY = 'mirror.acquisition.v1'

const DEPLOY = Date.parse('2026-10-11T08:00:00.000Z')

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
  it('is kept and dated now, not replaced', () => {
    localStorage.setItem(ID_KEY, 'returning-visitor-1')
    localStorage.setItem(LEGACY_ID_KEY, 'returning-visitor-1')

    expect(getFunnelClientId()).toBe('returning-visitor-1')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })

  it('is kept when only the legacy app key holds it', () => {
    localStorage.setItem(LEGACY_ID_KEY, 'legacy-only-visitor')

    expect(getFunnelClientId()).toBe('legacy-only-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })

  it('treats a date it cannot read as no date', () => {
    localStorage.setItem(ID_KEY, 'garbled-date-visitor')
    localStorage.setItem(ISSUED_KEY, 'last tuesday')

    expect(getFunnelClientId()).toBe('garbled-date-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
  })

  it('pulls a date from the future back to now', () => {
    // A clock that was wrong once must not keep the id for years.
    localStorage.setItem(ID_KEY, 'future-clock-visitor')
    localStorage.setItem(
      ISSUED_KEY,
      String(Date.parse('2031-01-01T00:00:00.000Z')),
    )

    expect(getFunnelClientId()).toBe('future-clock-visitor')
    expect(localStorage.getItem(ISSUED_KEY)).toBe(String(DEPLOY))
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
    getFunnelClientId()
    at('2027-09-01T00:00:00.000Z')
    window.history.replaceState({}, '', '/?gclid=old-click&utm_source=google')
    expect(getFunnelAcquisition()).toEqual({
      gclid: 'old-click',
      utmSource: 'google',
    })

    window.history.replaceState({}, '', '/')
    at('2027-11-12T00:00:00.000Z')
    expect(localStorage.getItem(ACQUISITION_KEY)).not.toBeNull()
    getFunnelClientId()

    expect(localStorage.getItem(ACQUISITION_KEY)).toBeNull()
    expect(getFunnelAcquisition()).toBeUndefined()
  })

  it('renews an undated id 13 months after it was first dated', () => {
    localStorage.setItem(ID_KEY, 'returning-visitor-2')
    getFunnelClientId()
    at('2027-11-11T08:00:00.000Z')

    expect(getFunnelClientId()).not.toBe('returning-visitor-2')
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
