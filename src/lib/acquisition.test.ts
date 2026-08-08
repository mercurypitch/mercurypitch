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

import { beforeEach, describe, expect, it } from 'vitest'
import { getFunnelAcquisition } from './acquisition'

const STORAGE_KEY = 'mirror.acquisition.v1'

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

    expect(getFunnelAcquisition()).toEqual({
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
    getFunnelAcquisition()

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      gclid: 'CjwKCA',
    })
  })

  it('finds params behind the hash router', () => {
    // An ad landing on /#/karaoke?gclid=… puts them where location.search
    // cannot see them, which is most of the app's deep links.
    visit('/#/karaoke-night?gclid=hashclick&utm_source=google')

    expect(getFunnelAcquisition()).toEqual({
      gclid: 'hashclick',
      utmSource: 'google',
    })
  })

  it('clamps a field long enough to bloat the row', () => {
    visit(`/?utm_campaign=${'x'.repeat(400)}`)

    expect(getFunnelAcquisition()?.utmCampaign).toHaveLength(128)
  })
})

describe('first meaningful touch wins', () => {
  it('does not let a later visit overwrite the first', () => {
    visit('/?gclid=first-click')
    expect(getFunnelAcquisition()).toEqual({ gclid: 'first-click' })

    visit('/?gclid=second-click&utm_source=newsletter')
    expect(getFunnelAcquisition()).toEqual({ gclid: 'first-click' })
  })

  it('leaves the slot open for a visit with nothing to record', () => {
    // Direct, no referrer: recording "direct" here would answer the
    // acquisition question wrongly for someone who arrives by ad later.
    expect(getFunnelAcquisition()).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    visit('/?gclid=arrived-later')
    expect(getFunnelAcquisition()).toEqual({ gclid: 'arrived-later' })
  })

  it('re-captures rather than trusting a corrupt entry', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    visit('/?gclid=recaptured')

    expect(getFunnelAcquisition()).toEqual({ gclid: 'recaptured' })
  })
})

describe('referrers', () => {
  it('records origin and path only', () => {
    // A referring URL's query can carry someone else's search terms or a
    // session token, none of which is acquisition data we asked for.
    visit('/', 'https://www.reddit.com/r/singing/?token=secret#comment')

    expect(getFunnelAcquisition()).toEqual({
      referrer: 'https://www.reddit.com/r/singing/',
    })
  })

  it('ignores our own pages', () => {
    visit('/', `${window.location.origin}/mirror`)

    expect(getFunnelAcquisition()).toBeUndefined()
  })

  it('ignores a referrer that will not parse', () => {
    visit('/', 'not-a-url')

    expect(getFunnelAcquisition()).toBeUndefined()
  })

  it('rides along with campaign params when both are present', () => {
    visit('/?utm_source=newsletter', 'https://mail.proton.me/inbox')

    expect(getFunnelAcquisition()).toEqual({
      utmSource: 'newsletter',
      referrer: 'https://mail.proton.me/inbox',
    })
  })
})
