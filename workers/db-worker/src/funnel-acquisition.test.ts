// ============================================================
// Acquisition ingest — what the Worker agrees to store
// ============================================================
//
// The acquisition object rides along on EVERY funnel event, from a public
// endpoint, so the sanitiser is the whole trust boundary: it decides what
// reaches the row and bounds how big it can be. These pin that it keeps
// the known fields, drops anything a client invents, and never writes a
// row that would say nothing.

import { describe, expect, it } from 'vitest'
import { sanitizeAcquisition } from './index'

describe('sanitizeAcquisition', () => {
  it('keeps the known fields', () => {
    expect(
      sanitizeAcquisition({
        gclid: 'CjwKCA',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'E — Karaoke Any Song',
        utmContent: 'rsa2',
        utmTerm: 'vocal remover',
        referrer: 'https://www.reddit.com/r/singing/',
      }),
    ).toEqual({
      gclid: 'CjwKCA',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'E — Karaoke Any Song',
      utmContent: 'rsa2',
      utmTerm: 'vocal remover',
      referrer: 'https://www.reddit.com/r/singing/',
    })
  })

  it('drops fields the catalog does not name', () => {
    expect(
      sanitizeAcquisition({ gclid: 'ok', email: 'someone@example.com' }),
    ).toEqual({ gclid: 'ok' })
  })

  it('drops values that are not strings', () => {
    expect(
      sanitizeAcquisition({ gclid: 'ok', utmSource: 42, utmMedium: null }),
    ).toEqual({ gclid: 'ok' })
  })

  it('bounds the fields so one client cannot bloat the table', () => {
    const clean = sanitizeAcquisition({
      utmCampaign: 'x'.repeat(500),
      referrer: `https://example.com/${'y'.repeat(500)}`,
    })

    expect(clean?.utmCampaign).toHaveLength(128)
    expect(clean?.referrer).toHaveLength(256)
  })

  it('returns null rather than writing an empty row', () => {
    expect(sanitizeAcquisition({})).toBeNull()
    expect(sanitizeAcquisition({ gclid: '   ' })).toBeNull()
    expect(sanitizeAcquisition({ unknown: 'field' })).toBeNull()
  })

  it('returns null for anything that is not an object', () => {
    // The field is optional on the wire: most events from a direct visitor
    // carry no `acq` at all.
    expect(sanitizeAcquisition(undefined)).toBeNull()
    expect(sanitizeAcquisition(null)).toBeNull()
    expect(sanitizeAcquisition('gclid=CjwKCA')).toBeNull()
    expect(sanitizeAcquisition(['gclid'])).toBeNull()
  })

  it('trims whitespace a hand-built URL leaves behind', () => {
    expect(sanitizeAcquisition({ utmSource: '  newsletter  ' })).toEqual({
      utmSource: 'newsletter',
    })
  })
})
