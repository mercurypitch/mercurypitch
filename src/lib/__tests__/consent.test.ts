import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ConsentModule from '../consent'
import { isRestrictedTimezone } from '../consent'

// Simulate a build that ships the ad tag so the consent logic is active;
// IS_TEST stays true so no real gtag.js <script> is injected.
vi.mock('@/lib/defaults', () => ({
  GOOGLE_ADS_TAG_ID: 'AW-TEST',
  IS_TEST: true,
}))

interface TestWindow {
  dataLayer?: unknown[][]
  gtag?: (...args: unknown[]) => void
  __mpConsentBooted?: boolean
}

function testWindow(): TestWindow {
  return window as unknown as TestWindow
}

function dataLayer(): unknown[][] {
  return testWindow().dataLayer ?? []
}

function commands(name: string, sub?: string): unknown[][] {
  return dataLayer().filter(
    (e) => e[0] === name && (sub === undefined || e[1] === sub),
  )
}

function mockTimezone(tz: string): void {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () =>
      ({ resolvedOptions: () => ({ timeZone: tz }) }) as unknown as ReturnType<
        typeof Intl.DateTimeFormat
      >,
  )
}

/** Fresh consent module booted for a given timezone. */
async function boot(tz: string): Promise<typeof ConsentModule> {
  mockTimezone(tz)
  vi.resetModules()
  const mod = await import('../consent')
  mod.initConsent()
  return mod
}

beforeEach(() => {
  localStorage.clear()
  const w = testWindow()
  delete w.__mpConsentBooted
  // Reset the memoized canonical gtag too — it closes over the dataLayer array
  // created on first use, so leaving it would push to a stale array.
  delete w.gtag
  w.dataLayer = undefined
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isRestrictedTimezone', () => {
  it('flags EEA / UK / CH zones', () => {
    expect(isRestrictedTimezone('Europe/London')).toBe(true)
    expect(isRestrictedTimezone('Europe/Dublin')).toBe(true)
    expect(isRestrictedTimezone('Europe/Zurich')).toBe(true)
    expect(isRestrictedTimezone('Europe/Zagreb')).toBe(true)
  })

  it('does not flag non-EEA zones', () => {
    expect(isRestrictedTimezone('America/New_York')).toBe(false)
    expect(isRestrictedTimezone('Australia/Sydney')).toBe(false)
    expect(isRestrictedTimezone('Europe/Moscow')).toBe(false)
    expect(isRestrictedTimezone('Europe/Istanbul')).toBe(false)
  })

  it('is cautious when the zone is unknown', () => {
    expect(isRestrictedTimezone('')).toBe(true)
  })
})

describe('initConsent', () => {
  it('pushes granted + region-denied Consent Mode defaults', async () => {
    await boot('Europe/London')
    const defaults = commands('consent', 'default')
    expect(defaults).toHaveLength(2)
    expect((defaults[0][2] as { ad_storage: string }).ad_storage).toBe(
      'granted',
    )
    const denied = defaults[1][2] as { ad_storage: string; region: string[] }
    expect(denied.ad_storage).toBe('denied')
    expect(denied.region).toContain('GB')
    expect(denied.region).toContain('IE')
  })

  it('shows the banner and stays denied in the EEA with no prior choice', async () => {
    const mod = await boot('Europe/Dublin')
    expect(mod.isConsentBannerOpen()).toBe(true)
    expect(mod.consentStatus()).toBeNull()
    expect(localStorage.getItem('mp.consent.v1')).toBeNull()
  })

  it('grants silently and shows no banner outside the EEA', async () => {
    const mod = await boot('America/New_York')
    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentStatus()).toBe('granted')
    const stored = JSON.parse(
      localStorage.getItem('mp.consent.v1') ?? '{}',
    ) as { status: string; implicit: boolean }
    expect(stored.status).toBe('granted')
    expect(stored.implicit).toBe(true)
    expect(commands('consent', 'update')).toHaveLength(1)
  })

  it('re-applies a stored decision without re-asking', async () => {
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'granted', at: 1, implicit: false }),
    )
    const mod = await boot('Europe/London')
    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentStatus()).toBe('granted')
  })
})

describe('accept / decline', () => {
  it('acceptConsent grants, persists and closes the banner', async () => {
    const mod = await boot('Europe/London')
    mod.acceptConsent()
    expect(mod.consentStatus()).toBe('granted')
    expect(mod.isConsentBannerOpen()).toBe(false)
    const stored = JSON.parse(
      localStorage.getItem('mp.consent.v1') ?? '{}',
    ) as { status: string; implicit: boolean }
    expect(stored.status).toBe('granted')
    expect(stored.implicit).toBe(false)
    const updates = commands('consent', 'update')
    const last = updates[updates.length - 1][2] as { ad_storage: string }
    expect(last.ad_storage).toBe('granted')
  })

  it('declineConsent denies, persists and closes the banner', async () => {
    const mod = await boot('Europe/London')
    mod.declineConsent()
    expect(mod.consentStatus()).toBe('denied')
    expect(mod.isConsentBannerOpen()).toBe(false)
    const stored = JSON.parse(
      localStorage.getItem('mp.consent.v1') ?? '{}',
    ) as { status: string }
    expect(stored.status).toBe('denied')
    const updates = commands('consent', 'update')
    const last = updates[updates.length - 1][2] as { ad_storage: string }
    expect(last.ad_storage).toBe('denied')
  })

  it('openConsentSettings re-opens the banner', async () => {
    const mod = await boot('America/New_York')
    expect(mod.isConsentBannerOpen()).toBe(false)
    mod.openConsentSettings()
    expect(mod.isConsentBannerOpen()).toBe(true)
  })
})
