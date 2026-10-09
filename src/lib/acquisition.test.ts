// ============================================================
// First-touch acquisition — capture rules
// ============================================================
//
// The behaviours worth pinning are the ones a reasonable refactor would
// get wrong: that the FIRST signal-bearing visit wins and later ones do
// not overwrite it, that a signal-free visit leaves the slot open rather
// than claiming it as "direct", that a hash-router landing URL still
// yields its params, and that a referrer never carries its query string
// into our database.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFunnelAcquisition } from './acquisition'

const STORAGE_KEY = 'mirror.acquisition.v1'
/** The funnel id the reads below belong to. */
const ID = 'client-1'

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

function visit(url: string, referrer = ''): void {
  window.history.replaceState({}, '', url)
  Object.defineProperty(document, 'referrer', {
    value: referrer,
    configurable: true,
  })
}

beforeEach(() => {
  localStorage.clear()
  visit('/')
})

describe('capturing from the landing URL', () => {
  it('keeps the click id and every utm field', () => {
    visit(
      '/?gclid=CjwKCA&utm_source=google&utm_medium=cpc&utm_campaign=E%20Karaoke&utm_content=rsa2&utm_term=vocal%20remover',
    )

    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'CjwKCA',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'E Karaoke',
      utmContent: 'rsa2',
      utmTerm: 'vocal remover',
    })
  })

  it('persists what it captured', () => {
    visit('/?gclid=CjwKCA')
    getFunnelAcquisition(ID)

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      gclid: 'CjwKCA',
      capturedAt: expect.any(Number),
      clientId: ID,
    })
  })

  it('finds params behind the hash router', () => {
    // An ad landing on /#/karaoke?gclid=… puts them where location.search
    // cannot see them, which is most of the app's deep links.
    visit('/#/karaoke-night?gclid=hashclick&utm_source=google')

    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'hashclick',
      utmSource: 'google',
    })
  })

  it('clamps a field long enough to bloat the row', () => {
    visit(`/?utm_campaign=${'x'.repeat(400)}`)

    expect(getFunnelAcquisition(ID)?.utmCampaign).toHaveLength(128)
  })
})

describe('first meaningful touch wins', () => {
  it('does not let a later visit overwrite the first', () => {
    visit('/?gclid=first-click')
    expect(getFunnelAcquisition(ID)).toEqual({ gclid: 'first-click' })

    visit('/?gclid=second-click&utm_source=newsletter')
    expect(getFunnelAcquisition(ID)).toEqual({ gclid: 'first-click' })
  })

  it('leaves the slot open for a visit with nothing to record', () => {
    // Direct, no referrer: recording "direct" here would answer the
    // acquisition question wrongly for someone who arrives by ad later.
    expect(getFunnelAcquisition(ID)).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    visit('/?gclid=arrived-later')
    expect(getFunnelAcquisition(ID)).toEqual({ gclid: 'arrived-later' })
  })

  it('re-captures rather than trusting a corrupt entry', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    visit('/?gclid=recaptured')

    expect(getFunnelAcquisition(ID)).toEqual({ gclid: 'recaptured' })
  })
})

describe('referrers', () => {
  it('records origin and path only', () => {
    // A referring URL's query can carry someone else's search terms or a
    // session token, none of which is acquisition data we asked for.
    visit('/', 'https://www.reddit.com/r/singing/?token=secret#comment')

    expect(getFunnelAcquisition(ID)).toEqual({
      referrer: 'https://www.reddit.com/r/singing/',
    })
  })

  it('ignores our own pages', () => {
    visit('/', `${window.location.origin}/mirror`)

    expect(getFunnelAcquisition(ID)).toBeUndefined()
  })

  it('ignores a referrer that will not parse', () => {
    visit('/', 'not-a-url')

    expect(getFunnelAcquisition(ID)).toBeUndefined()
  })

  it('rides along with campaign params when both are present', () => {
    visit('/?utm_source=newsletter', 'https://mail.proton.me/inbox')

    expect(getFunnelAcquisition(ID)).toEqual({
      utmSource: 'newsletter',
      referrer: 'https://mail.proton.me/inbox',
    })
  })
})

// Privacy plan 4.2 and 4.3: the browser keeps the click id 90 days and the
// whole record 13 months, counted from the capture. Every event re-sends
// what the browser holds, so without this a row the server sweep deleted
// would come back on the next event.
describe('expiry', () => {
  const CAPTURE = Date.parse('2026-10-11T08:00:00.000Z')

  function at(iso: string): void {
    vi.setSystemTime(Date.parse(iso))
  }

  function stored(): Record<string, unknown> {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Record<
      string,
      unknown
    >
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(CAPTURE)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('records when it captured, and never sends that date', () => {
    visit('/?gclid=CjwKCA&utm_source=google')

    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'CjwKCA',
      utmSource: 'google',
    })
    expect(stored().capturedAt).toBe(CAPTURE)
  })

  it('keeps the click id for 90 days', () => {
    visit('/?gclid=CjwKCA&utm_source=google')
    getFunnelAcquisition(ID)
    visit('/')
    at('2027-01-09T07:59:59.999Z')

    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'CjwKCA',
      utmSource: 'google',
    })
  })

  it('drops the click id after 90 days and keeps the rest', () => {
    visit('/?gclid=CjwKCA&utm_source=google')
    getFunnelAcquisition(ID)
    visit('/')
    at('2027-01-09T08:00:00.000Z')

    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
    expect(stored()).toEqual({
      utmSource: 'google',
      capturedAt: CAPTURE,
      clientId: ID,
    })
  })

  it('keeps the slot claimed when the click id was all there was', () => {
    // First touch was the ad. A later newsletter visit is not the first
    // touch, so it must not take the slot once the click id is gone.
    visit('/?gclid=only-a-click')
    getFunnelAcquisition(ID)
    at('2027-02-01T00:00:00.000Z')
    visit('/?utm_source=newsletter')

    expect(getFunnelAcquisition(ID)).toBeUndefined()
    expect(stored()).toEqual({ capturedAt: CAPTURE, clientId: ID })
  })

  it('drops the whole record after 13 months, which reopens the slot', () => {
    visit('/?utm_source=google&utm_campaign=E')
    getFunnelAcquisition(ID)
    visit('/')
    at('2027-11-11T08:00:00.000Z')

    expect(getFunnelAcquisition(ID)).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    visit('/?utm_source=newsletter')
    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'newsletter' })
  })

  // A record stored before the date existed cannot say how old it is. It
  // takes the earliest day the key could have been written (the first
  // commit that wrote mirror.acquisition.v1, 2026-08-08), never "now",
  // which would give an old click a fresh 90 days.
  const LEGACY_CAPTURED_AT = Date.parse('2026-08-08T00:00:00.000Z')

  it('dates a record stored before this rule the day the key first existed', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gclid: 'pre-rule-click', utmSource: 'google' }),
    )

    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'pre-rule-click',
      utmSource: 'google',
    })
    expect(stored().capturedAt).toBe(LEGACY_CAPTURED_AT)

    at('2026-11-05T23:59:59.999Z')
    expect(getFunnelAcquisition(ID)).toEqual({
      gclid: 'pre-rule-click',
      utmSource: 'google',
    })
    at('2026-11-06T00:00:00.000Z')
    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
  })

  it('treats a capture date far in the future as no date', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gclid: 'future-click',
        capturedAt: Date.parse('2031-01-01T00:00:00.000Z'),
        clientId: ID,
      }),
    )

    getFunnelAcquisition(ID)

    expect(stored().capturedAt).toBe(LEGACY_CAPTURED_AT)
  })

  it('does not restart the clock when the date cannot be saved', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ gclid: 'unsaved-click', utmSource: 'google' }),
    )
    failingStorage((method) => method === 'setItem')
    at('2026-11-07T00:00:00.000Z')

    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
  })

  it('follows VITE_RETENTION_CLICK_ID_DAYS', () => {
    vi.stubEnv('VITE_RETENTION_CLICK_ID_DAYS', '30')
    visit('/?gclid=CjwKCA&utm_source=google')
    getFunnelAcquisition(ID)
    visit('/')
    at('2026-11-10T08:00:00.000Z')

    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
  })

  it('ignores a bad VITE_RETENTION_CLICK_ID_DAYS rather than dropping early', () => {
    vi.stubEnv('VITE_RETENTION_CLICK_ID_DAYS', '-1')
    visit('/?gclid=CjwKCA')
    getFunnelAcquisition(ID)
    visit('/')
    at('2026-11-10T08:00:00.000Z')

    expect(getFunnelAcquisition(ID)).toEqual({ gclid: 'CjwKCA' })
  })
})

// The record belongs to the funnel id that captured it. When the id is
// renewed and the old record could not be removed, sending it under the
// new id would link the two; so a record for another id is dropped.
describe('the id a record belongs to', () => {
  it('drops a record that belongs to another id', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gclid: 'old-click',
        capturedAt: Date.now(),
        clientId: 'old-id',
      }),
    )

    expect(getFunnelAcquisition('new-id')).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not send it even when it cannot be removed', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        gclid: 'old-click',
        capturedAt: Date.now(),
        clientId: 'old-id',
      }),
    )
    failingStorage((method) => method === 'removeItem')

    expect(getFunnelAcquisition('new-id')).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('adopts a record from before the id was stored in it', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ utmSource: 'google' }))

    expect(getFunnelAcquisition(ID)).toEqual({ utmSource: 'google' })
    expect(
      (
        JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
          clientId?: string
        }
      ).clientId,
    ).toBe(ID)
  })
})
