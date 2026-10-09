import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ConsentModule from '../consent'
import { isRestrictedTimezone } from '../consent'

// Simulate a build that ships the ad tag so the consent logic is active;
// IS_TEST stays true so no real gtag.js <script> is injected.
vi.mock('@/lib/defaults', () => ({
  GOOGLE_ADS_TAG_ID: 'AW-TEST',
  GA4_MEASUREMENT_ID: 'G-TEST',
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
  sessionStorage.clear()
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

  it.each([
    'Atlantic/Reykjavik',
    'Asia/Nicosia',
    'Asia/Famagusta',
    'Atlantic/Canary',
    'Africa/Ceuta',
    'Atlantic/Madeira',
    'Atlantic/Azores',
    'America/Cayenne',
    'America/Guadeloupe',
    'America/Marigot',
    'America/Martinique',
    'Indian/Reunion',
    'Indian/Mayotte',
  ])('flags %s, an EEA zone outside Europe/*', (tz) => {
    expect(isRestrictedTimezone(tz)).toBe(true)
  })

  it('does not flag non-EEA zones', () => {
    expect(isRestrictedTimezone('America/New_York')).toBe(false)
    expect(isRestrictedTimezone('Australia/Sydney')).toBe(false)
    expect(isRestrictedTimezone('Europe/Moscow')).toBe(false)
    expect(isRestrictedTimezone('Europe/Istanbul')).toBe(false)
    expect(isRestrictedTimezone('Atlantic/Faroe')).toBe(false)
  })

  it('is cautious when the zone is unknown or names no place', () => {
    expect(isRestrictedTimezone('')).toBe(true)
    expect(isRestrictedTimezone('UTC')).toBe(true)
    expect(isRestrictedTimezone('Etc/UTC')).toBe(true)
    expect(isRestrictedTimezone('Etc/GMT')).toBe(true)
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
    // EU territory with its own ISO code: Åland and the outermost regions.
    for (const code of ['AX', 'GF', 'GP', 'MF', 'MQ', 'RE', 'YT']) {
      expect(denied.region).toContain(code)
    }
  })

  it('redacts ad click ids from the first hit, before any choice', async () => {
    await boot('Europe/Dublin')
    expect(commands('set', 'ads_data_redaction').map((c) => c[2])).toEqual([
      true,
    ])
    const all = dataLayer()
    const redaction = all.findIndex(
      (e) => e[0] === 'set' && e[1] === 'ads_data_redaction',
    )
    expect(redaction).toBeLessThan(all.findIndex((e) => e[0] === 'js'))
  })

  it('shows the banner and stays denied in the EEA with no prior choice', async () => {
    const mod = await boot('Europe/Dublin')
    expect(mod.isConsentBannerOpen()).toBe(true)
    expect(mod.consentStatus()).toBeNull()
    expect(localStorage.getItem('mp.consent.v1')).toBeNull()
    expect(commands('consent', 'update')).toHaveLength(0)
  })

  // A `consent update` overrides the IP-based region default everywhere, so
  // a phone in Germany set to America/New_York used to be granted unasked.
  it('never grants on the visitor’s behalf outside the banner scope', async () => {
    const mod = await boot('America/New_York')
    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentStatus()).toBeNull()
    expect(localStorage.getItem('mp.consent.v1')).toBeNull()
    expect(commands('consent', 'update')).toHaveLength(0)
  })

  it('drops a silent grant stored by an earlier version', async () => {
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'granted', at: 1, implicit: true }),
    )
    const mod = await boot('America/New_York')
    expect(mod.consentStatus()).toBeNull()
    expect(commands('consent', 'update')).toHaveLength(0)
    expect(localStorage.getItem('mp.consent.v1')).toBeNull()
  })

  it('asks again where an old silent grant sits inside the scope', async () => {
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'granted', at: 1, implicit: true }),
    )
    const mod = await boot('Asia/Nicosia')
    expect(mod.isConsentBannerOpen()).toBe(true)
    expect(commands('consent', 'update')).toHaveLength(0)
  })

  it('re-applies a stored decision without re-asking', async () => {
    localStorage.setItem(
      'mp.consent.v1',
      JSON.stringify({ status: 'granted', at: 1, implicit: false }),
    )
    const mod = await boot('Europe/London')
    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentStatus()).toBe('granted')
    expect(commands('consent', 'update')).toHaveLength(1)
    // Redacted from the first hit, then lifted by the stored grant.
    expect(commands('set', 'ads_data_redaction').map((c) => c[2])).toEqual([
      true,
      false,
    ])
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
    expect(commands('set', 'ads_data_redaction').map((c) => c[2])).toEqual([
      true,
      true,
    ])
  })

  it('openConsentSettings re-opens the banner', async () => {
    const mod = await boot('America/New_York')
    expect(mod.isConsentBannerOpen()).toBe(false)
    mod.openConsentSettings()
    expect(mod.isConsentBannerOpen()).toBe(true)
  })
})

describe('tag detection', () => {
  it('reports ads, GA4 and any-tag from the configured ids', async () => {
    const mod = await import('../consent')
    expect(mod.hasAdTag()).toBe(true)
    expect(mod.hasGa4()).toBe(true)
    expect(mod.hasAnyTag()).toBe(true)
  })
})

describe('pending purchase (credits_purchase)', () => {
  it('stash writes a record with uppercased currency + a txn id', async () => {
    const mod = await import('../consent')
    mod.stashPendingPurchase(5, 'eur')
    const raw = sessionStorage.getItem('mp.pendingPurchase.v1')
    expect(raw).not.toBeNull()
    const rec = JSON.parse(raw ?? '{}') as {
      value: number
      currency: string
      txn: string
    }
    expect(rec.value).toBe(5)
    expect(rec.currency).toBe('EUR')
    expect(typeof rec.txn).toBe('string')
    expect(rec.txn.length).toBeGreaterThan(0)
  })

  it('flush clears the stash so a success-page refresh cannot double-count', async () => {
    const mod = await import('../consent')
    mod.stashPendingPurchase(5, 'EUR')
    mod.flushPendingPurchase()
    expect(sessionStorage.getItem('mp.pendingPurchase.v1')).toBeNull()
    // A second flush (e.g. a refresh) has nothing to fire.
    expect(() => mod.flushPendingPurchase()).not.toThrow()
  })

  it('flush without a stash is a no-op', async () => {
    const mod = await import('../consent')
    expect(() => mod.flushPendingPurchase()).not.toThrow()
    expect(sessionStorage.getItem('mp.pendingPurchase.v1')).toBeNull()
  })
})

// Plan section 3.3 points 4 and 5, copy C3: the same behaviour and words as
// the landing's banner (disjoint-colliders #100), so both hosts agree.
describe('Cookie settings', () => {
  function cookieNames(): string[] {
    return document.cookie
      .split(';')
      .map((pair) => pair.split('=')[0].trim())
      .filter((name) => name !== '')
      .sort()
  }

  afterEach(() => {
    for (const name of cookieNames()) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
    }
    vi.useRealTimers()
  })

  it('deletes Google’s cookies on Decline and leaves every other cookie', async () => {
    const mod = await boot('Europe/Zagreb')
    document.cookie = '_ga=GA1.1.123; Path=/'
    document.cookie = '_ga_ABC123=GS1.1.456; Path=/'
    document.cookie = '_gcl_au=1.1.789; Path=/'
    document.cookie = 'mp_theme=dark; Path=/'

    mod.declineConsent()

    expect(cookieNames()).toEqual(['mp_theme'])
  })

  it('also clears them on every parent domain, where GA4 writes them', async () => {
    const mod = await import('../consent')

    expect(mod.googleCookieDomains('about.mercurypitch.com')).toEqual([
      '',
      'about.mercurypitch.com',
      'mercurypitch.com',
    ])
    expect(mod.googleCookieDomains('mercurypitch.com')).toEqual([
      '',
      'mercurypitch.com',
    ])
    expect(mod.googleCookieDomains('localhost')).toEqual([''])
  })

  it('says there is no choice yet when reopened before one', async () => {
    const mod = await boot('America/New_York')

    mod.openConsentSettings()

    expect(mod.consentSettingsLine()).toBe(
      'You haven’t made a choice for this site yet.',
    )
  })

  it('states the current choice and its date when reopened', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 9, 21, 30))
    const mod = await boot('Europe/Zagreb')
    mod.declineConsent()

    mod.openConsentSettings()

    expect(mod.isConsentBannerOpen()).toBe(true)
    expect(mod.consentSettingsLine()).toBe(
      'You declined cookies on 9 October 2026.',
    )
  })

  it('stays open after Decline in Cookie settings, to confirm the cookies are off', async () => {
    const mod = await boot('Europe/Zagreb')
    mod.acceptConsent()
    mod.openConsentSettings()

    mod.declineConsent()

    expect(mod.isConsentBannerOpen()).toBe(true)
    expect(mod.consentSettingsLine()).toBe(
      'Google cookies are off for this site.',
    )
  })

  it('closes on the first ask, and the status line stays empty there', async () => {
    const mod = await boot('Europe/Zagreb')
    expect(mod.consentSettingsLine()).toBe('')

    mod.declineConsent()

    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentSettingsLine()).toBe('')
  })

  it('closes Cookie settings unchanged', async () => {
    const mod = await boot('Europe/Zagreb')
    mod.acceptConsent()
    mod.openConsentSettings()

    mod.closeConsentSettings()

    expect(mod.isConsentBannerOpen()).toBe(false)
    expect(mod.consentStatus()).toBe('granted')
    expect(mod.consentSettingsLine()).toBe('')
  })
})
